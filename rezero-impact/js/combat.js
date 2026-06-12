/* Re:Impact — turn-based combat engine with elemental auras & reactions. */
(function () {
  const RZ = (globalThis.RZ = globalThis.RZ || {});
  const D = () => RZ.DATA;

  const ROUND_CAP = 120;
  let st = null;

  // ------------------------------------------------------------ helpers
  const alive = (list) => list.filter((c) => c.alive);
  const rand = () => (st && st.rng ? st.rng() : Math.random());
  const vary = (n) => n * (0.92 + rand() * 0.16);

  function effStat(c, stat) {
    let mult = 1;
    for (const b of c.buffs) if (b.stat === stat) mult += b.val;
    let v = c[stat + '0'] * Math.max(0.1, mult);
    if (stat === 'def' && c.gimmick === 'breather' && st.round % 3 === 0) v = 0;
    return v;
  }

  function log(text, cls) {
    st.log.push({ text, cls: cls || '' });
    if (st.log.length > 200) st.log.shift();
  }

  // ------------------------------------------------------------ combatant factory
  function mkAlly(spec) {
    return {
      side: 'ally', id: spec.id, name: spec.name, icon: spec.icon,
      element: spec.element, rarity: spec.rarity,
      hp: spec.hp, maxhp: spec.hp,
      atk0: spec.atk, def0: spec.def, spd0: spec.spd, crit: spec.crit || 5,
      skill: spec.skill, burst: spec.burst, passive: spec.passive,
      energy: 0, cd: 0, buffs: [], dots: [], shield: 0, stun: 0, taunt: 0,
      alive: true,
    };
  }

  function mkEnemy(key, mult) {
    const base = D().ENEMIES[key];
    const soft = Math.sqrt(mult); // def/spd grow slower than hp/atk
    return {
      side: 'enemy', id: key, name: base.name, icon: base.icon, boss: !!base.boss,
      element: base.element || null,
      hp: Math.round(base.hp * mult), maxhp: Math.round(base.hp * mult),
      atk0: Math.round(base.atk * mult), def0: Math.round(base.def * soft),
      spd0: base.spd, crit: 5,
      skill: base.skill || null, gimmick: base.gimmick || null,
      selfheal: base.selfheal || 0,
      cd: base.skill ? 2 : 0, buffs: [], dots: [], shield: 0, stun: 0,
      aura: null, alive: true,
    };
  }

  // ------------------------------------------------------------ damage & reactions
  function reactionFor(a, b) {
    const R = D().REACTIONS;
    const key = [a, b].sort().join('+');
    if (R[key]) return R[key];
    if (a === 'yin' || b === 'yin') return D().YIN_REACTION;
    if (a === 'yang' || b === 'yang') return D().YANG_REACTION;
    return null;
  }

  // Applies element to target's aura; returns reaction (or null) to apply to this hit.
  function applyElement(target, el) {
    if (!el || target.side !== 'enemy') return null;
    if (!target.aura) { target.aura = el; return null; }
    if (target.aura === el) return null; // refresh
    const rx = reactionFor(target.aura, el);
    target.aura = null;
    return rx;
  }

  function dealDamage(actor, target, mult, opts) {
    opts = opts || {};
    if (!target.alive) return 0;
    const atk = effStat(actor, 'atk');
    const def = effStat(target, 'def');
    let dmg = vary(atk * mult) * (100 / (100 + def));
    const crit = opts.critGuaranteed || rand() * 100 < (actor.crit || 5);
    if (crit) dmg *= 1.5;

    let rxName = null;
    if (!opts.noReaction) {
      const rx = applyElement(target, opts.element || actor.element);
      if (rx) {
        dmg *= rx.mult;
        rxName = rx.name;
        if (rx.debuff) addBuff(target, rx.debuff.stat, rx.debuff.val, rx.debuff.turns);
        if (rx.stun && rand() < rx.stun) { target.stun = Math.max(target.stun, 1); log(`${target.name} is stunned by ${rx.name}!`, 'rx'); }
        if (rx.dot) addDot(target, Math.round(atk * rx.dot.mult), rx.dot.turns, rx.name);
        if (rx.splash) {
          for (const other of alive(st.enemies)) {
            if (other !== target) hpDamage(other, Math.round(dmg * rx.splash));
          }
        }
      }
    }

    dmg = Math.max(1, Math.round(dmg));
    hpDamage(target, dmg);
    if (target.side === 'ally') target.energy = Math.min(100, target.energy + 15);

    log(
      `${actor.icon} ${actor.name} hits ${target.name} for ${dmg}` +
      (crit ? ' (CRIT!)' : '') + (rxName ? ` — ${rxName}!` : ''),
      rxName ? 'rx' : (actor.side === 'ally' ? 'ally' : 'enemy')
    );
    return dmg;
  }

  function hpDamage(target, dmg) {
    if (!target.alive) return;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, dmg);
      target.shield -= absorbed;
      dmg -= absorbed;
    }
    target.hp -= dmg;
    if (target.hp <= 0) {
      target.hp = 0; target.alive = false; target.dots = []; target.buffs = [];
      log(`💀 ${target.name} falls!`, target.side === 'enemy' ? 'good' : 'bad');
    }
  }

  function heal(target, amount) {
    if (!target.alive) return;
    amount = Math.max(1, Math.round(vary(amount)));
    target.hp = Math.min(target.maxhp, target.hp + amount);
    log(`💚 ${target.name} recovers ${amount} HP.`, 'heal');
  }

  function addBuff(c, stat, val, turns) {
    if (!c.alive) return;
    c.buffs.push({ stat, val, turns });
    log(`${c.name}: ${stat.toUpperCase()} ${val > 0 ? '+' : ''}${Math.round(val * 100)}% (${turns}t)`, val > 0 ? 'buff' : 'debuff');
  }

  function addDot(c, dmg, turns, label) {
    if (!c.alive) return;
    c.dots.push({ dmg: Math.max(1, dmg), turns, label });
    log(`${c.name} is afflicted by ${label} (${turns}t).`, 'debuff');
  }

  // ------------------------------------------------------------ skill execution
  function execSkill(actor, spec, kindLabel, targetIdx) {
    const foes = actor.side === 'ally' ? st.enemies : st.allies;
    const team = actor.side === 'ally' ? st.allies : st.enemies;
    const liveFoes = alive(foes);
    if (!liveFoes.length) return;
    let target = foes[targetIdx];
    if (!target || !target.alive) target = lowestHp(liveFoes);

    log(`✨ ${actor.name} uses ${spec.name}!`, actor.side === 'ally' ? 'ally-skill' : 'enemy-skill');

    let mult = spec.mult;
    if (spec.randomMult) mult = spec.randomMult[0] + rand() * (spec.randomMult[1] - spec.randomMult[0]);
    const opts = { critGuaranteed: spec.critGuaranteed };

    switch (spec.kind) {
      case 'st':
        damageAndRiders(actor, target, mult, spec, opts); break;
      case 'stmulti':
        for (let i = 0; i < spec.hits; i++) if (target.alive) damageAndRiders(actor, target, mult, spec, opts);
        break;
      case 'multi':
        for (let i = 0; i < spec.hits; i++) {
          const lf = alive(foes); if (!lf.length) break;
          damageAndRiders(actor, lf[Math.floor(rand() * lf.length)], mult, spec, opts);
        }
        break;
      case 'aoe':
        for (const f of alive(foes)) damageAndRiders(actor, f, mult, spec, opts);
        break;
      case 'heal': {
        const t = lowestHpPct(alive(team));
        if (t) heal(t, effStat(actor, 'atk') * mult);
        break;
      }
      case 'healall':
        for (const t of alive(team)) heal(t, effStat(actor, 'atk') * mult);
        break;
      case 'shieldall': {
        const s = Math.round(effStat(actor, 'atk') * mult);
        for (const t of alive(team)) { t.shield += s; }
        log(`🛡️ The party gains a ${s} HP shield.`, 'buff');
        break;
      }
      case 'buff': break;     // riders only
      case 'debuffall': break;
      case 'taunt':
        actor.taunt = 2;
        log(`🛡️ ${actor.name} draws all attention! (2t)`, 'buff');
        break;
      default: break;
    }

    // riders shared across kinds
    if (spec.st && target.alive) damageAndRiders(actor, target, spec.st, {}, opts);
    if (spec.healall) for (const t of alive(team)) heal(t, effStat(actor, 'atk') * spec.healall);
    if (spec.shieldall) {
      const s = Math.round(effStat(actor, 'atk') * spec.shieldall);
      for (const t of alive(team)) t.shield += s;
      log(`🛡️ The party gains a ${s} HP shield.`, 'buff');
    }
    if (spec.selfshield) {
      const s = Math.round(effStat(actor, 'atk') * spec.selfshield);
      actor.shield += s;
      log(`🛡️ ${actor.name} gains a ${s} HP shield.`, 'buff');
    }
    if (spec.buff) for (const t of alive(team)) addBuff(t, spec.buff.stat, spec.buff.val, spec.buff.turns);
    if (spec.selfbuff) addBuff(actor, spec.selfbuff.stat, spec.selfbuff.val, spec.selfbuff.turns);
    if (spec.debuff && target.alive) addBuff(target, spec.debuff.stat, spec.debuff.val, spec.debuff.turns);
    if (spec.debuffAll) for (const f of alive(foes)) addBuff(f, spec.debuffAll.stat, spec.debuffAll.val, spec.debuffAll.turns);
    if (spec.energyTeam && actor.side === 'ally') {
      for (const t of alive(team)) t.energy = Math.min(100, t.energy + spec.energyTeam);
      log(`⚡ The party gains ${spec.energyTeam} energy.`, 'buff');
    }
    if (spec.loot && actor.side === 'ally') {
      st.lootCrystals += spec.loot;
      log(`💎 ${actor.name} pockets ${spec.loot} Witch Crystals!`, 'good');
    }
  }

  function damageAndRiders(actor, target, mult, spec, opts) {
    const dmg = dealDamage(actor, target, mult, opts);
    if (!target.alive) return;
    if (spec.dot) addDot(target, Math.round(effStat(actor, 'atk') * spec.dot.mult), spec.dot.turns, spec.dot.label || 'Bleed');
    if (spec.stun && rand() < spec.stun) { target.stun = Math.max(target.stun, 1); log(`${target.name} is stunned!`, 'rx'); }
    if (spec.selfheal) heal(actor, dmg * spec.selfheal);
  }

  function lowestHp(list) {
    return list.reduce((a, b) => (b.hp < a.hp ? b : a), list[0]);
  }
  function lowestHpPct(list) {
    if (!list.length) return null;
    return list.reduce((a, b) => (b.hp / b.maxhp < a.hp / a.maxhp ? b : a), list[0]);
  }

  // ------------------------------------------------------------ turn flow
  function newRound() {
    st.round += 1;
    const all = alive(st.allies).concat(alive(st.enemies));
    all.sort((a, b) => effStat(b, 'spd') - effStat(a, 'spd'));
    st.queue = all;
    st.qi = 0;
    if (st.round > 1) log(`— Round ${st.round} —`, 'round');
    for (const e of alive(st.enemies)) {
      if (e.gimmick === 'breather' && st.round % 3 === 0) {
        log(`${e.name} pauses mid-monologue to breathe — his guard drops this round!`, 'rx');
      }
    }
  }

  function tickTurnStart(c) {
    // dots
    if (c.dots.length) {
      let total = 0;
      for (const d of c.dots) { total += d.dmg; d.turns -= 1; }
      c.dots = c.dots.filter((d) => d.turns > 0);
      if (total > 0) {
        c.hp -= total;
        log(`☠️ ${c.name} suffers ${total} damage over time.`, 'debuff');
        if (c.hp <= 0) { c.hp = 0; c.alive = false; log(`💀 ${c.name} falls!`, c.side === 'enemy' ? 'good' : 'bad'); return false; }
      }
    }
    if (c.selfheal && c.hp < c.maxhp) {
      const h = Math.round(c.maxhp * c.selfheal);
      c.hp = Math.min(c.maxhp, c.hp + h);
      log(`${c.name} regenerates ${h} HP.`, 'enemy-skill');
    }
    if (c.cd > 0) c.cd -= 1;
    if (c.taunt > 0) c.taunt -= 1;
    if (c.stun > 0) {
      c.stun -= 1;
      log(`💫 ${c.name} is frozen/stunned and loses the turn!`, 'rx');
      return false;
    }
    return true;
  }

  function tickTurnEnd(c) {
    for (const b of c.buffs) b.turns -= 1;
    c.buffs = c.buffs.filter((b) => b.turns > 0);
  }

  function enemyAct(e) {
    const targets = alive(st.allies);
    if (!targets.length) return;
    const taunter = targets.find((t) => t.taunt > 0);
    if (e.skill && e.cd <= 0) {
      e.cd = e.skill.cd;
      const ti = taunter ? st.allies.indexOf(taunter) : st.allies.indexOf(targets[Math.floor(rand() * targets.length)]);
      execSkill(e, e.skill, 'skill', ti);
    } else {
      const t = taunter || targets[Math.floor(rand() * targets.length)];
      dealDamage(e, t, 1.0, { element: e.element });
    }
  }

  function allyAutoAction(a) {
    const foes = alive(st.enemies);
    const team = alive(st.allies);
    const targetIdx = st.enemies.indexOf(lowestHp(foes));
    const lowAlly = lowestHpPct(team);
    const needHeal = lowAlly && lowAlly.hp / lowAlly.maxhp < 0.75;
    const isHealSkill = (s) => s && (s.kind === 'heal' || s.kind === 'healall');

    if (a.energy >= 100 && !(isHealSkill(a.burst) && !needHeal)) return { type: 'burst', target: targetIdx };
    if (a.cd <= 0 && !(isHealSkill(a.skill) && !needHeal)) return { type: 'skill', target: targetIdx };
    return { type: 'attack', target: targetIdx };
  }

  function allyAct(a, action) {
    const foes = alive(st.enemies);
    if (!foes.length) return;
    let ti = action.target;
    if (ti == null || !st.enemies[ti] || !st.enemies[ti].alive) ti = st.enemies.indexOf(foes[0]);

    if (action.type === 'burst' && a.energy >= 100) {
      a.energy = 0;
      execSkill(a, a.burst, 'burst', ti);
    } else if (action.type === 'skill' && a.cd <= 0) {
      a.cd = a.skill.cd;
      execSkill(a, a.skill, 'skill', ti);
      a.energy = Math.min(100, a.energy + 25);
    } else {
      dealDamage(a, st.enemies[ti], 1.0, {});
      a.energy = Math.min(100, a.energy + 25);
    }
  }

  function checkWaveAndWipe() {
    if (!alive(st.enemies).length) {
      if (st.wave < st.waves.length - 1) {
        st.wave += 1;
        st.enemies = st.waves[st.wave].map((k) => mkEnemy(k, st.mult));
        log(`⚔️ Wave ${st.wave + 1}/${st.waves.length} approaches!`, 'round');
        newRound();
        return 'wave';
      }
      st.over = true; st.victory = true;
      return 'victory';
    }
    if (!alive(st.allies).length) {
      const subaru = st.allies.find((a) => a.passive && a.passive.kind === 'rbd');
      if (subaru && !st.rbdUsed) {
        st.rbdUsed = true;
        log('🕯️ The world lurches. The scent of the witch floods everything...', 'rbd');
        log('⏪ RETURN BY DEATH — Subaru drags the party back from the brink!', 'rbd');
        for (const a of st.allies) {
          a.alive = true; a.hp = Math.round(a.maxhp * 0.4);
          a.dots = []; a.buffs = []; a.stun = 0;
        }
        newRound();
        return 'rbd';
      }
      st.over = true; st.victory = false;
      return 'defeat';
    }
    return null;
  }

  // Processes exactly one combatant turn. Returns false if waiting for input or battle over.
  function step() {
    if (st.over) return false;
    if (st.round > ROUND_CAP) { st.over = true; st.victory = false; log('The battle drags on too long... the party withdraws.', 'bad'); return false; }
    if (st.qi >= st.queue.length) newRound();

    const c = st.queue[st.qi];
    if (!c || !c.alive) { st.qi += 1; return true; }

    if (c.side === 'ally' && !st.auto && !st.pendingAction) {
      st.awaiting = c;
      return false;
    }

    st.awaiting = null;
    const canAct = tickTurnStart(c);
    if (c.alive && canAct) {
      if (c.side === 'enemy') enemyAct(c);
      else {
        const action = (!st.auto && st.pendingAction) ? st.pendingAction : allyAutoAction(c);
        st.pendingAction = null;
        allyAct(c, action);
      }
    }
    st.pendingAction = null;
    if (c.alive) tickTurnEnd(c);
    st.qi += 1;

    const ev = checkWaveAndWipe();
    if (ev === 'victory' || ev === 'defeat') return false;
    return true;
  }

  function pump() {
    if (!st || st.over) { finish(); return; }
    let guard = 0;
    while (guard++ < 100000) {
      const cont = step();
      if (st.onUpdate) st.onUpdate(getState());
      if (st.over) { finish(); return; }
      if (!cont) return; // awaiting input
      if (st.delay > 0) {
        // pause between visible turns for readability
        setTimeout(pump, st.delay / (st.speed || 1));
        return;
      }
    }
  }

  function finish() {
    if (!st || st.finished) return;
    st.finished = true;
    if (st.onUpdate) st.onUpdate(getState());
    if (st.onEnd) st.onEnd({
      victory: !!st.victory,
      rounds: st.round,
      lootCrystals: st.lootCrystals,
      rbdUsed: st.rbdUsed,
    });
  }

  function getState() { return st; }

  // ------------------------------------------------------------ public API
  RZ.Combat = {
    start(cfg) {
      st = {
        allies: cfg.allies.map(mkAlly),
        waves: cfg.waves, wave: 0, mult: cfg.mult || 1,
        enemies: cfg.waves[0].map((k) => mkEnemy(k, cfg.mult || 1)),
        round: 0, queue: [], qi: 0,
        auto: !!cfg.auto, speed: 1, delay: cfg.delay != null ? cfg.delay : 350,
        pendingAction: null, awaiting: null,
        log: [], lootCrystals: 0, rbdUsed: false,
        over: false, victory: false, finished: false,
        onUpdate: cfg.onUpdate || null, onEnd: cfg.onEnd || null,
        rng: cfg.rng || null,
      };
      log(`⚔️ Battle start! Wave 1/${st.waves.length}`, 'round');
      newRound();
      pump();
      return st;
    },
    act(action) {
      if (!st || st.over || !st.awaiting) return;
      st.pendingAction = action;
      pump();
    },
    setAuto(v) {
      if (!st) return;
      st.auto = !!v;
      if (st.auto) pump();
    },
    setSpeed(v) { if (st) st.speed = v; },
    getState,
    // synchronous auto-resolution (used by tests/simulations)
    simulate(cfg) {
      const saved = st;
      let result = null;
      this.start({ ...cfg, auto: true, delay: 0, onUpdate: null, onEnd: (r) => { result = r; } });
      const out = { ...result, state: st };
      st = saved;
      return out;
    },
  };
})();
