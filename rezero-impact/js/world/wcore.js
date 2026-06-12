/* Re:Impact World — real-time simulation core (no rendering, no DOM).
   Movement/physics, weapon movesets, enemy AI moves, quests, trials. */
(function () {
  const RZ = (globalThis.RZ = globalThis.RZ || {});
  const D = () => RZ.DATA;
  const WD = () => RZ.WDATA.WORLD;
  const T = () => RZ.Terrain;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ------------------------------------------------------------ creation
  function create(opts) {
    opts = opts || {};
    const saved = (RZ.Game.state && RZ.Game.state.world) || {};
    const W = {
      time: 0,
      rng: opts.rng || Math.random,
      player: {
        x: saved.x != null ? saved.x : -716, z: saved.z != null ? saved.z : 634, y: 0,
        yaw: 0, vy: 0, grounded: true, climbing: false, plunging: false,
        kx: 0, kz: 0,
        dodgeT: 0, dodgeCd: 0, dodgeDirX: 0, dodgeDirZ: 1,
        iframes: 0, attackCd: 0, swing: null, comboIdx: 0, comboT: 9,
      },
      partyIds: RZ.Game.state.party.slice(0, 4),
      activeIdx: clamp(saved.activeIdx || 0, 0, Math.max(0, RZ.Game.state.party.length - 1)),
      hp: {}, energy: {}, skillCd: {},
      buffs: [], shield: 0, shieldUntil: 0,
      stamina: WD().maxStamina, lastStam: -9,
      lastHurt: -99,
      enemies: [], bolts: [], zones: [],
      camps: RZ.WDATA.MOB_CAMPS.map((c) => ({ ...c, deadUntil: 0, alive: 0, spawned: false })),
      quest: null, enc: null, trial: null, waveT: 0,
      waypoints: (saved.waypoints || []).slice(),
      lock: null, pendingRbd: false,
      det: 0, saveT: 0, events: [],
    };
    for (const id of W.partyIds) {
      W.hp[id] = maxHp(id, 0);
      W.energy[id] = 0;
      W.skillCd[id] = 0;
    }
    W.player.y = T().groundHeight(W.player.x, W.player.z);
    W.quest = nextStage();
    return W;
  }

  function nextStage() {
    for (const ch of D().STORY) {
      for (const st of ch.stages) {
        if (!RZ.Game.state.cleared[st.id]) {
          return { stageId: st.id, stage: st, chapter: ch, spot: RZ.WDATA.STAGE_SPOTS[st.id] };
        }
      }
    }
    return null;
  }

  // ------------------------------------------------------------ stats
  function maxHp(id, det) {
    const cs = RZ.Game.charStats(id, det || 0);
    return Math.round(cs.hp * WD().playerHpScale);
  }
  function pstats(W, id) {
    const cs = RZ.Game.charStats(id, W.det);
    let atkMul = 1, defMul = 1;
    for (const b of W.buffs) {
      if (b.stat === 'atk') atkMul += b.val;
      if (b.stat === 'def') defMul += b.val;
    }
    return {
      ...cs,
      atk: cs.atk * Math.max(0.1, atkMul),
      def: cs.def * Math.max(0.1, defMul),
      ranged: RZ.WDATA.RANGED.includes(id),
    };
  }
  function activeId(W) { return W.partyIds[W.activeIdx]; }
  function activeStats(W) { return pstats(W, activeId(W)); }
  function moveset(W) {
    const id = activeId(W);
    const looks = RZ.WDATA.LOOKS[id] || {};
    if (RZ.WDATA.RANGED.includes(id)) return RZ.WDATA.WEAPON_MOVES.caster;
    return RZ.WDATA.WEAPON_MOVES[looks.weapon] || RZ.WDATA.WEAPON_MOVES.sword;
  }

  function ev(W, e) { W.events.push(e); }

  // ------------------------------------------------------------ stamina
  function spendStamina(W, amt) {
    if (W.stamina <= 0) return false;
    W.stamina = Math.max(0, W.stamina - amt);
    W.lastStam = W.time;
    return true;
  }
  function drainStamina(W, perSec, dt) {
    W.stamina = Math.max(0, W.stamina - perSec * dt);
    W.lastStam = W.time;
  }

  // ------------------------------------------------------------ enemies
  function mkEnemy(W, key, mult, x, z, opts) {
    const base = D().ENEMIES[key];
    [x, z] = T().collide(x, z, 1.0);
    const moves = (RZ.WDATA.MOVES[key] ||
      (base.boss ? [{ t: 'slam', cd: 8 }, { t: 'melee' }] : [{ t: 'melee' }]))
      .map((m) => ({ ...m, cdLeft: (m.cd || 1.6) * (0.4 + W.rng() * 0.5) }));
    const e = {
      key, name: base.name, boss: !!base.boss,
      element: base.element || null,
      x, z, y: T().groundHeight(x, z), yaw: W.rng() * 6.28,
      homeX: x, homeZ: z,
      hp: Math.round(base.hp * mult * WD().enemyHpScale),
      maxhp: Math.round(base.hp * mult * WD().enemyHpScale),
      atk: base.atk * mult, def: base.def * Math.sqrt(mult),
      speed: clamp(base.spd * 0.055, 3.6, 6.4),
      size: base.boss ? (key === 'whale' ? 4.5 : 2.0) : 1.0,
      moves,
      aggro: false, stagger: 0, telegraph: null, charging: null,
      gimmick: base.gimmick || null, breather: false, breatherT: 0,
      aura: null, dots: [], debuffs: [], dotAcc: 0,
      dead: false, deathT: 0,
      enc: opts && opts.enc || false, trial: opts && opts.trial || false,
      campIdx: opts && opts.campIdx != null ? opts.campIdx : -1,
      selfheal: base.selfheal || 0,
    };
    W.enemies.push(e);
    ev(W, { t: 'spawn', e });
    return e;
  }

  function eDef(e) {
    if (e.breather) return 0; // Regulus pauses for breath — guard down
    let mul = 1;
    for (const d of e.debuffs) if (d.stat === 'def') mul += d.val;
    return Math.max(0, e.def * Math.max(0.1, mul));
  }
  function eAtk(e) {
    let mul = 1;
    for (const d of e.debuffs) if (d.stat === 'atk') mul += d.val;
    return e.atk * Math.max(0.1, mul);
  }

  // ------------------------------------------------------------ reactions (shared with menu game)
  function reactionFor(a, b) {
    const key = [a, b].sort().join('+');
    if (D().REACTIONS[key]) return D().REACTIONS[key];
    if (a === 'yin' || b === 'yin') return D().YIN_REACTION;
    if (a === 'yang' || b === 'yang') return D().YANG_REACTION;
    return null;
  }

  function hitEnemy(W, e, mult, opts) {
    if (!e || e.dead) return 0;
    opts = opts || {};
    const s = activeStats(W);
    let dmg = s.atk * mult * (0.92 + W.rng() * 0.16) * (100 / (100 + eDef(e)));
    const crit = opts.critGuaranteed || W.rng() * 100 < s.crit;
    if (crit) dmg *= 1.5;
    let rxName = null;
    const el = opts.element || s.element;
    if (el) {
      if (!e.aura) e.aura = el;
      else if (e.aura !== el) {
        const rx = reactionFor(e.aura, el);
        e.aura = null;
        if (rx) {
          dmg *= rx.mult; rxName = rx.name;
          if (rx.debuff) e.debuffs.push({ stat: rx.debuff.stat, val: rx.debuff.val, until: W.time + rx.debuff.turns * 3 });
          if (rx.stun && W.rng() < rx.stun) e.stagger = Math.max(e.stagger, 1.4);
          if (rx.dot) e.dots.push({ dps: s.atk * rx.dot.mult * 0.5, until: W.time + rx.dot.turns * 2.5 });
          if (rx.splash) {
            for (const o of W.enemies) {
              if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 6) damageEnemyRaw(W, o, dmg * rx.splash);
            }
          }
        }
      }
    }
    dmg = Math.max(1, Math.round(dmg));
    ev(W, { t: 'dmg', x: e.x, y: e.y + e.size * 1.6, z: e.z, amount: dmg, crit, rx: rxName, side: 'enemy' });
    if (rxName) ev(W, { t: 'sfx', name: 'hit' });
    damageEnemyRaw(W, e, dmg);
    if (!e.aggro && !e.dead) e.aggro = true;
    if (opts.stagger && !e.dead && !e.boss && W.rng() < opts.stagger) e.stagger = Math.max(e.stagger, 1.0);
    if (opts.dot && !e.dead) e.dots.push({ dps: s.atk * opts.dot.mult * 0.5, until: W.time + opts.dot.turns * 2.5 });
    if (opts.stun && W.rng() < opts.stun && !e.dead) e.stagger = Math.max(e.stagger, 1.4);
    if (opts.selfheal) healParty(W, [activeId(W)], dmg * opts.selfheal);
    return dmg;
  }

  function damageEnemyRaw(W, e, dmg) {
    if (e.dead) return;
    e.hp -= dmg;
    if (e.hp <= 0) {
      e.hp = 0; e.dead = true; e.deathT = 1.0; e.telegraph = null; e.charging = null;
      ev(W, { t: 'death', e });
      if (e.campIdx >= 0) {
        const camp = W.camps[e.campIdx];
        camp.alive -= 1;
        if (camp.alive <= 0) { camp.spawned = false; camp.deadUntil = W.time + WD().mobRespawn; }
        const crystals = Math.max(1, Math.round((1 + W.rng() * 2) * camp.mult));
        const xp = Math.round(10 * camp.mult);
        RZ.Game.state.crystals += crystals;
        for (const id of W.partyIds) if (RZ.Game.state.roster[id]) RZ.Game.state.roster[id].xp += xp;
        ev(W, { t: 'loot', crystals, xp });
      }
      if (e.enc) checkEncounter(W);
      if (e.trial) checkTrial(W);
    }
  }

  // ------------------------------------------------------------ player damage / death
  function damagePlayer(W, raw, srcX, srcZ, opts) {
    const p = W.player;
    if (p.iframes > 0) { ev(W, { t: 'dodged', x: p.x, y: p.y + 2, z: p.z }); return; }
    const s = activeStats(W);
    let dmg = raw * (0.92 + W.rng() * 0.16) * (100 / (100 + s.def));
    dmg = Math.max(1, Math.round(dmg));
    if (W.shield > 0) {
      const ab = Math.min(W.shield, dmg);
      W.shield -= ab; dmg -= ab;
    }
    const id = activeId(W);
    W.hp[id] = Math.max(0, W.hp[id] - dmg);
    W.lastHurt = W.time;
    W.energy[id] = Math.min(100, W.energy[id] + WD().energyHurt);
    ev(W, { t: 'dmg', x: p.x, y: p.y + 2.2, z: p.z, amount: dmg, side: 'player' });
    if (srcX != null && (!opts || !opts.noKnock)) {
      const dx = p.x - srcX, dz = p.z - srcZ, l = Math.hypot(dx, dz) || 1;
      const kb = (opts && opts.knock) || 6;
      p.kx += (dx / l) * kb; p.kz += (dz / l) * kb;
    }
    if (W.hp[id] <= 0) {
      ev(W, { t: 'down', id });
      const next = W.partyIds.findIndex((cid) => W.hp[cid] > 0);
      if (next >= 0) {
        W.activeIdx = next;
        ev(W, { t: 'switch', id: W.partyIds[next], auto: true });
      } else {
        W.pendingRbd = true;
        if (W.enc) {
          W.det = RZ.Game.onStageDefeat(W.enc.stageId);
          clearEncounter(W, false);
        }
        if (W.trial) clearTrial(W, false);
        ev(W, { t: 'rbd', det: W.det });
      }
    }
  }

  function healParty(W, ids, amount) {
    for (const id of ids) {
      if (W.hp[id] <= 0) continue;
      const mx = maxHp(id, W.det);
      W.hp[id] = Math.min(mx, W.hp[id] + Math.round(amount));
    }
    ev(W, { t: 'heal', x: W.player.x, y: W.player.y + 2.2, z: W.player.z, amount: Math.round(amount) });
  }

  function respawnAfterDeath(W) {
    const p = W.player;
    let tx = -716, tz = 634;
    if (W.waypoints.length) {
      const last = RZ.WDATA.REGIONS.find((r) => r.id === W.waypoints[W.waypoints.length - 1]);
      if (last) { tx = last.anchor[0] + 4; tz = last.anchor[1] + 4; }
    }
    p.x = tx; p.z = tz; p.y = T().groundHeight(tx, tz);
    p.kx = p.kz = 0; p.swing = null; p.iframes = 1.5;
    p.vy = 0; p.grounded = true; p.plunging = false;
    for (const id of W.partyIds) { W.hp[id] = maxHp(id, W.det); W.energy[id] = 0; W.skillCd[id] = 0; }
    W.buffs = []; W.shield = 0; W.stamina = WD().maxStamina;
    W.pendingRbd = false;
    W.lock = null;
    persist(W);
  }

  // ------------------------------------------------------------ story encounters
  function startEncounter(W) {
    const q = W.quest;
    W.det = RZ.Game.state.determination[q.stageId] || 0;
    W.enc = { stageId: q.stageId, stage: q.stage, chapter: q.chapter, spot: q.spot, wave: 0 };
    spawnWave(W);
    ev(W, { t: 'stage-intro', stage: q.stage, chapter: q.chapter });
    ev(W, { t: 'sfx', name: 'whoosh' });
  }

  function spawnWave(W) {
    const enc = W.enc;
    const wave = enc.stage.enemies[enc.wave];
    const n = wave.length;
    wave.forEach((key, i) => {
      const ang = (i / n) * Math.PI * 2 + 0.6;
      const r = 9 + (D().ENEMIES[key].boss ? 4 : 0);
      let x = enc.spot.x + Math.cos(ang) * r;
      let z = enc.spot.z + Math.sin(ang) * r;
      if (T().groundHeight(x, z) < WD().waterY + 0.2) { x = enc.spot.x; z = enc.spot.z; }
      mkEnemy(W, key, enc.chapter.mult, x, z, { enc: true }).aggro = true;
    });
    if (enc.wave > 0) ev(W, { t: 'wave', wave: enc.wave + 1, total: enc.stage.enemies.length });
  }

  function checkEncounter(W) {
    const enc = W.enc;
    if (!enc) return;
    if (W.enemies.some((e) => e.enc && !e.dead)) return;
    if (enc.wave < enc.stage.enemies.length - 1) {
      enc.wave += 1;
      W.waveT = 1.2;
      return;
    }
    const r = RZ.Game.onStageVictory(enc.stageId, { lootCrystals: 0 });
    W.det = 0;
    ev(W, { t: 'stage-clear', stage: enc.stage, rewards: r });
    ev(W, { t: 'sfx', name: 'victory' });
    if (r.joined) ev(W, { t: 'joined', id: r.joined });
    for (const id of W.partyIds) {
      if (W.hp[id] > 0) W.hp[id] = Math.min(maxHp(id, 0), W.hp[id] + Math.round(maxHp(id, 0) * 0.35));
    }
    W.enc = null;
    W.quest = nextStage();
    if (W.quest) ev(W, { t: 'quest', quest: W.quest });
    else ev(W, { t: 'all-clear' });
    persist(W);
  }

  function clearEncounter(W, retreat) {
    for (const e of W.enemies) if (e.enc && !e.dead) { e.dead = true; e.deathT = 0.01; }
    if (retreat) ev(W, { t: 'retreat' });
    W.enc = null;
  }

  // ------------------------------------------------------------ trials (repeatable dungeons)
  function nearTrial(W) {
    for (const t of RZ.WDATA.TRIALS) {
      if (Math.hypot(t.x - W.player.x, t.z - W.player.z) < 6) return t;
    }
    return null;
  }

  function startTrial(W, id, tier) {
    if (W.enc || W.trial || W.pendingRbd) return false;
    const def = RZ.WDATA.TRIALS.find((t) => t.id === id);
    const tierDef = RZ.WDATA.TRIAL_TIERS[tier];
    if (!def || !tierDef) return false;
    W.events = []; // may be invoked outside step(); caller forwards these
    W.trial = { id, def, tier, tierDef, wave: 0, mult: def.baseMult * tierDef.mult };
    spawnTrialWave(W);
    ev(W, { t: 'trial-start', def, tier });
    ev(W, { t: 'sfx', name: 'whoosh' });
    return true;
  }

  function spawnTrialWave(W) {
    const tr = W.trial;
    const keys = [];
    if (tr.wave < 2) {
      const n = 3 + tr.wave;
      for (let i = 0; i < n; i++) keys.push(tr.def.theme[Math.floor(W.rng() * tr.def.theme.length)]);
    } else {
      keys.push(tr.def.boss, tr.def.theme[0]);
    }
    keys.forEach((key, i) => {
      const ang = (i / keys.length) * Math.PI * 2 + 0.4;
      const e = mkEnemy(W, key, tr.mult, tr.def.x + Math.cos(ang) * 10, tr.def.z + Math.sin(ang) * 10, { trial: true });
      e.aggro = true;
    });
    if (tr.wave > 0) ev(W, { t: 'wave', wave: tr.wave + 1, total: 3 });
  }

  function checkTrial(W) {
    const tr = W.trial;
    if (!tr) return;
    if (W.enemies.some((e) => e.trial && !e.dead)) return;
    if (tr.wave < 2) {
      tr.wave += 1;
      W.waveT = 1.2;
      return;
    }
    const { crystals, xp } = tr.tierDef;
    RZ.Game.state.crystals += crystals;
    for (const id of W.partyIds) if (RZ.Game.state.roster[id]) RZ.Game.state.roster[id].xp += xp;
    RZ.Game.save();
    ev(W, { t: 'trial-clear', def: tr.def, tier: tr.tier, crystals, xp });
    ev(W, { t: 'sfx', name: 'victory' });
    W.trial = null;
  }

  function clearTrial(W, retreat) {
    for (const e of W.enemies) if (e.trial && !e.dead) { e.dead = true; e.deathT = 0.01; }
    if (retreat) ev(W, { t: 'retreat' });
    W.trial = null;
  }

  // ------------------------------------------------------------ player skills (menu kit → real-time)
  function castSkill(W, spec, isBurst) {
    const s = activeStats(W);
    const p = W.player;
    const dmgKinds = ['st', 'stmulti', 'multi', 'aoe', 'taunt'];
    const range = spec.kind === 'aoe' ? 9 : 8;
    const inRange = W.enemies.filter((e) => !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < range + e.size);
    if (dmgKinds.includes(spec.kind) && spec.kind !== 'taunt' && !inRange.length) {
      ev(W, { t: 'no-target' });
      return false;
    }
    const opts = { critGuaranteed: spec.critGuaranteed, dot: spec.dot, stun: spec.stun, selfheal: spec.selfheal };
    let mult = spec.mult || 0;
    if (spec.randomMult) mult = spec.randomMult[0] + W.rng() * (spec.randomMult[1] - spec.randomMult[0]);
    ev(W, { t: isBurst ? 'burst-fx' : 'skill-fx', x: p.x, y: p.y, z: p.z, element: s.element });

    inRange.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    switch (spec.kind) {
      case 'st': hitEnemy(W, inRange[0], mult, opts); break;
      case 'stmulti': for (let i = 0; i < spec.hits; i++) hitEnemy(W, inRange[0], mult, opts); break;
      case 'multi': for (let i = 0; i < spec.hits; i++) hitEnemy(W, inRange[i % inRange.length], mult, opts); break;
      case 'aoe': for (const e of inRange) hitEnemy(W, e, mult, opts); break;
      case 'taunt':
        for (const e of inRange) if (!e.boss) e.stagger = Math.max(e.stagger, 1.3);
        break;
      case 'heal': {
        let low = null;
        for (const id of W.partyIds) {
          if (W.hp[id] <= 0) continue;
          if (!low || W.hp[id] / maxHp(id, W.det) < W.hp[low] / maxHp(low, W.det)) low = id;
        }
        if (low) healParty(W, [low], s.atk * mult * WD().playerHpScale);
        break;
      }
      case 'healall': healParty(W, W.partyIds, s.atk * mult * WD().playerHpScale); break;
      case 'shieldall': W.shield += s.atk * mult * WD().playerHpScale; W.shieldUntil = W.time + 12; break;
      default: break;
    }
    if (spec.st && inRange.length) hitEnemy(W, inRange[0], spec.st, opts);
    if (spec.healall) healParty(W, W.partyIds, s.atk * spec.healall * WD().playerHpScale);
    if (spec.shieldall) { W.shield += s.atk * spec.shieldall * WD().playerHpScale; W.shieldUntil = W.time + 12; }
    if (spec.selfshield) { W.shield += s.atk * spec.selfshield * WD().playerHpScale; W.shieldUntil = W.time + 12; }
    if (spec.buff) W.buffs.push({ stat: spec.buff.stat, val: spec.buff.val, until: W.time + spec.buff.turns * 5 });
    if (spec.selfbuff) W.buffs.push({ stat: spec.selfbuff.stat, val: spec.selfbuff.val, until: W.time + spec.selfbuff.turns * 5 });
    if (spec.debuff && inRange.length) inRange[0].debuffs.push({ stat: spec.debuff.stat, val: spec.debuff.val, until: W.time + spec.debuff.turns * 3 });
    if (spec.debuffAll) for (const e of inRange) e.debuffs.push({ stat: spec.debuffAll.stat, val: spec.debuffAll.val, until: W.time + spec.debuffAll.turns * 3 });
    if (spec.energyTeam) for (const id of W.partyIds) W.energy[id] = Math.min(100, W.energy[id] + spec.energyTeam);
    if (spec.loot) { RZ.Game.state.crystals += spec.loot; ev(W, { t: 'loot', crystals: spec.loot, xp: 0 }); }
    return true;
  }

  // ------------------------------------------------------------ bolts
  function fireBolt(W, from, side, dmgMult, element, tx, tz, extra) {
    const dx = tx - from.x, dz = tz - from.z;
    const l = Math.hypot(dx, dz) || 1;
    W.bolts.push({
      x: from.x, y: from.y + (from.size ? from.size * 1.2 : 1.6), z: from.z,
      dx: dx / l, dz: dz / l, side, dmgMult, element,
      speed: (extra && extra.speed) || WD().boltSpeed,
      big: !!(extra && extra.big), pierce: !!(extra && extra.pierce),
      hitSet: null,
      life: 2.2, srcAtk: side === 'enemy' ? eAtk(from) : 0,
    });
    ev(W, { t: 'sfx', name: 'whoosh' });
  }

  // ------------------------------------------------------------ player attacks (weapon movesets)
  function meleeStrike(W, mv) {
    const p = W.player;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    let landed = false;
    for (const e of W.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dz = e.z - p.z;
      const d = Math.hypot(dx, dz);
      const inArc = mv.arc < 0 || (dx * fx + dz * fz) / (d || 1) > mv.arc;
      if (d < (mv.range || WD().attackRange) + e.size && inArc) {
        hitEnemy(W, e, mv.mult, { stagger: mv.stagger });
        landed = true;
      }
    }
    if (landed) ev(W, { t: 'sfx', name: 'hit' });
    return landed;
  }

  function startAttack(W, input) {
    const p = W.player;
    const s = activeStats(W);
    const ms = moveset(W);
    const id = activeId(W);
    const moving = Math.hypot(input.mx || 0, input.mz || 0) > 0.01;
    if (p.comboT > 1.3) p.comboIdx = 0;

    // plunge: attack while airborne
    if (!p.grounded) {
      if (!p.plunging && spendStamina(W, 8)) {
        p.plunging = true;
        ev(W, { t: 'swing', anim: 'over', kind: 'plunge' });
      }
      return;
    }
    let mv, kind = 'light', cost = 5;
    if (input.heavy && ms.heavy) { mv = ms.heavy; kind = 'heavy'; cost = 16; p.comboIdx = 0; }
    else if (input.sprint && moving && ms.sprintAtk) { mv = ms.sprintAtk; kind = 'sprint'; cost = 9; p.comboIdx = 0; }
    else { mv = ms.combo[p.comboIdx % ms.combo.length]; }
    if (!spendStamina(W, cost)) return;

    p.attackCd = mv.rate || WD().attackRate;
    p.comboT = 0;
    if (kind === 'light') p.comboIdx += 1;
    W.energy[id] = Math.min(100, W.energy[id] + WD().energyMelee);

    if (mv.bolt) {
      // caster attack: fire mv.bolt projectiles
      let tx = p.x + Math.sin(p.yaw) * 20, tz = p.z + Math.cos(p.yaw) * 20;
      if (W.lock && !W.lock.dead) { tx = W.lock.x; tz = W.lock.z; }
      for (let i = 0; i < mv.bolt; i++) {
        const sp = (i - (mv.bolt - 1) / 2) * (mv.spread || 0.16);
        const ca = Math.cos(sp), sa = Math.sin(sp);
        const dx = tx - p.x, dz = tz - p.z;
        fireBolt(W, { x: p.x, z: p.z, y: p.y }, 'player', mv.mult, s.element,
          p.x + dx * ca - dz * sa, p.z + dx * sa + dz * ca,
          { big: kind === 'heavy', pierce: mv.pierce, speed: mv.speed });
      }
      p.swing = { t: 0, dur: 0.22, hit: true, anim: mv.anim || 'cast', kind };
    } else {
      p.swing = { t: 0, dur: mv.dur || (kind === 'heavy' ? 0.45 : 0.3), hit: false, mv, anim: mv.anim, kind };
      if (mv.lunge) {
        p.kx += Math.sin(p.yaw) * mv.lunge * 3;
        p.kz += Math.cos(p.yaw) * mv.lunge * 3;
      }
    }
    ev(W, { t: 'swing', anim: mv.anim || 'cast', kind });
  }

  // ------------------------------------------------------------ main step
  function step(W, dt, input) {
    dt = Math.min(dt, 0.05);
    W.events = [];
    if (W.pendingRbd) return W.events;
    W.time += dt;
    const p = W.player;
    const s = activeStats(W);
    const id = activeId(W);
    const W0 = WD();

    // ---- timers
    p.iframes = Math.max(0, p.iframes - dt);
    p.dodgeCd = Math.max(0, p.dodgeCd - dt);
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.comboT += dt;
    for (const cid of W.partyIds) W.skillCd[cid] = Math.max(0, W.skillCd[cid] - dt);
    W.buffs = W.buffs.filter((b) => b.until > W.time);
    if (W.shield > 0 && W.time > W.shieldUntil) W.shield = 0;

    // ---- party switch
    if (input.switchTo != null && input.switchTo >= 0 && input.switchTo < W.partyIds.length &&
        input.switchTo !== W.activeIdx && W.hp[W.partyIds[input.switchTo]] > 0) {
      W.activeIdx = input.switchTo;
      ev(W, { t: 'switch', id: activeId(W) });
    }

    // ---- lock-on
    if (input.lockToggle) {
      if (W.lock) W.lock = null;
      else {
        let best = null, bd = 34;
        for (const e of W.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.x - p.x, e.z - p.z);
          if (d < bd) { bd = d; best = e; }
        }
        W.lock = best;
      }
    }
    if (W.lock && (W.lock.dead || Math.hypot(W.lock.x - p.x, W.lock.z - p.z) > 42)) W.lock = null;

    // ---- horizontal movement intent
    const moving = Math.hypot(input.mx || 0, input.mz || 0) > 0.01;
    let ix = 0, iz = 0;
    let sprinting = false;
    if (p.dodgeT > 0) {
      p.dodgeT -= dt;
      ix = p.dodgeDirX * W0.dodgeSpeed * dt;
      iz = p.dodgeDirZ * W0.dodgeSpeed * dt;
    } else if (input.dodge && p.dodgeCd <= 0 && p.grounded && spendStamina(W, 12)) {
      p.dodgeT = 0.3; p.dodgeCd = W0.dodgeCd; p.iframes = W0.dodgeIframes;
      if (moving) { p.dodgeDirX = input.mx; p.dodgeDirZ = input.mz; }
      else { p.dodgeDirX = -Math.sin(p.yaw); p.dodgeDirZ = -Math.cos(p.yaw); }
      ev(W, { t: 'sfx', name: 'click' });
    } else if (moving) {
      let sp = W0.playerSpeed;
      if (input.sprint && W.stamina > 0 && p.grounded && !p.swing) {
        sp *= W0.sprintMult; sprinting = true;
        drainStamina(W, W0.sprintDrain, dt);
      }
      if (p.swing && p.grounded) sp *= 0.35; // attacks root you mostly
      ix = input.mx * sp * dt;
      iz = input.mz * sp * dt;
    }
    ix += p.kx * dt; iz += p.kz * dt;
    p.kx *= Math.pow(0.02, dt); p.kz *= Math.pow(0.02, dt);

    let nx = clamp(p.x + ix, -1150, 1150);
    let nz = clamp(p.z + iz, -1150, 1150);

    // ---- slope / climbing
    p.climbing = false;
    if (p.grounded) {
      const g0 = T().groundHeight(p.x, p.z);
      const g1 = T().groundHeight(nx, nz);
      const run = Math.hypot(nx - p.x, nz - p.z);
      if (run > 1e-5 && (g1 - g0) / run > W0.climbSlope) {
        if (moving && W.stamina > 1) {
          p.climbing = true;
          const k = W0.climbSpeed / W0.playerSpeed;
          nx = p.x + (nx - p.x) * k;
          nz = p.z + (nz - p.z) * k;
          drainStamina(W, W0.climbDrain, dt);
        } else { nx = p.x; nz = p.z; }
      }
    } else if (T().groundHeight(nx, nz) > p.y + 0.5) {
      nx = p.x; nz = p.z; // can't drift through walls mid-air
    }

    // ---- water blocks, then solid collision
    const wl = W0.waterY + 0.15;
    if (T().groundHeight(nx, nz) < wl) {
      if (T().groundHeight(nx, p.z) >= wl) nz = p.z;
      else if (T().groundHeight(p.x, nz) >= wl) nx = p.x;
      else { nx = p.x; nz = p.z; }
    }
    [nx, nz] = T().collide(nx, nz, 0.6);
    p.x = clamp(nx, -1150, 1150); p.z = clamp(nz, -1150, 1150);

    // ---- vertical: jump / gravity / landing
    if (p.grounded) {
      const g = T().groundHeight(p.x, p.z);
      if (input.jump && p.dodgeT <= 0) {
        p.vy = W0.jumpVel; p.grounded = false; p.y = g + 0.05;
        ev(W, { t: 'sfx', name: 'click' });
      } else if (g < p.y - 0.5 && !p.climbing) {
        p.grounded = false; p.vy = 0;
      } else {
        p.y = g;
      }
    }
    if (!p.grounded) {
      p.vy -= W0.gravity * dt;
      if (p.plunging) p.vy = Math.min(p.vy, -20);
      p.y += p.vy * dt;
      const g = T().groundHeight(p.x, p.z);
      if (p.y <= g) {
        p.y = g; p.vy = 0; p.grounded = true;
        if (p.plunging) {
          p.plunging = false;
          const ms = moveset(W);
          const pl = ms.plunge || { mult: 1.6, r: 3.4 };
          let landedAny = false;
          for (const e of W.enemies) {
            if (e.dead) continue;
            if (Math.hypot(e.x - p.x, e.z - p.z) < pl.r + e.size) {
              hitEnemy(W, e, pl.mult, { stagger: 0.5 });
              landedAny = true;
            }
          }
          ev(W, { t: 'plunge-fx', x: p.x, y: p.y, z: p.z, element: s.element });
          if (landedAny) ev(W, { t: 'sfx', name: 'hit' });
        }
      }
    }

    // ---- stamina regen
    if (W.time - W.lastStam > 0.5 && !sprinting && !p.climbing) {
      W.stamina = Math.min(W0.maxStamina, W.stamina + W0.staminaRegen * dt);
    }

    // ---- facing
    if (W.lock) p.yaw = Math.atan2(W.lock.x - p.x, W.lock.z - p.z);
    else if (moving && p.dodgeT <= 0) {
      const target = Math.atan2(input.mx, input.mz);
      let d = target - p.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      p.yaw += d * Math.min(1, dt * 12);
    }

    // ---- attacks
    if ((input.attack || input.heavy) && p.attackCd <= 0 && !p.swing && p.dodgeT <= 0) {
      startAttack(W, input);
    }
    if (p.swing) {
      p.swing.t += dt;
      if (!p.swing.hit && p.swing.t >= p.swing.dur * 0.45) {
        p.swing.hit = true;
        if (p.swing.mv) meleeStrike(W, p.swing.mv);
      }
      if (p.swing.t >= p.swing.dur) p.swing = null;
    }

    // ---- skill / burst
    if (input.skill && W.skillCd[id] <= 0) {
      if (castSkill(W, s.skill, false)) {
        W.skillCd[id] = s.skill.cd * W0.skillCdMult;
        W.energy[id] = Math.min(100, W.energy[id] + W0.energySkill);
      }
    }
    if (input.burst && W.energy[id] >= 100) {
      if (castSkill(W, s.burst, true)) W.energy[id] = 0;
    }

    // ---- interact (trials)
    if (input.interact && !W.enc && !W.trial) {
      const tr = nearTrial(W);
      if (tr) ev(W, { t: 'trial-offer', def: tr });
    }

    // ---- out-of-combat regen
    if (W.time - W.lastHurt > W0.regenDelay) {
      for (const cid of W.partyIds) {
        if (W.hp[cid] > 0) W.hp[cid] = Math.min(maxHp(cid, W.det), W.hp[cid] + maxHp(cid, W.det) * W0.regenRate * dt);
      }
    }

    // ---- bolts
    for (const b of W.bolts) {
      b.x += b.dx * b.speed * dt;
      b.z += b.dz * b.speed * dt;
      b.life -= dt;
      if (b.life <= 0) { b.dead = true; continue; }
      if (b.side === 'player') {
        for (const e of W.enemies) {
          if (e.dead) continue;
          if (b.pierce && b.hitSet && b.hitSet.includes(e)) continue;
          if (Math.hypot(e.x - b.x, e.z - b.z) < (b.big ? 2.0 : 1.4) + e.size * 0.6) {
            hitEnemy(W, e, b.dmgMult, { element: b.element });
            if (b.pierce) { b.hitSet = b.hitSet || []; b.hitSet.push(e); }
            else { b.dead = true; break; }
          }
        }
      } else if (Math.hypot(p.x - b.x, p.z - b.z) < 1.3) {
        damagePlayer(W, b.srcAtk * b.dmgMult, b.x, b.z, { noKnock: true });
        b.dead = true;
      }
      if (W.pendingRbd) break;
    }
    W.bolts = W.bolts.filter((b) => !b.dead);
    if (W.pendingRbd) return W.events;

    // ---- ground zones (telegraphed AoE)
    for (const zn of W.zones) {
      zn.t += dt;
      if (!zn.done && zn.t >= zn.dur) {
        zn.done = true;
        if (Math.hypot(p.x - zn.x, p.z - zn.z) < zn.r && p.iframes <= 0) {
          damagePlayer(W, zn.atk * zn.mult, zn.x, zn.z);
          ev(W, { t: 'shake' });
        } else if (Math.hypot(p.x - zn.x, p.z - zn.z) < zn.r) {
          ev(W, { t: 'dodged', x: p.x, y: p.y + 2, z: p.z });
        }
      }
    }
    W.zones = W.zones.filter((zn) => zn.t < zn.dur + 0.3);
    if (W.pendingRbd) return W.events;

    // ---- enemies
    for (const e of W.enemies) {
      if (e.dead) { e.deathT -= dt; continue; }
      if (e.dots.length) {
        let dps = 0;
        e.dots = e.dots.filter((d) => d.until > W.time);
        for (const d of e.dots) dps += d.dps;
        if (dps > 0) {
          e.dotAcc += dps * dt;
          if (e.dotAcc >= 1) {
            const dd = Math.floor(e.dotAcc); e.dotAcc -= dd;
            ev(W, { t: 'dmg', x: e.x, y: e.y + e.size * 1.6, z: e.z, amount: dd, dot: true, side: 'enemy' });
            damageEnemyRaw(W, e, dd);
            if (e.dead) continue;
          }
        }
      }
      e.debuffs = e.debuffs.filter((d) => d.until > W.time);
      if (e.selfheal && e.hp < e.maxhp) e.hp = Math.min(e.maxhp, e.hp + e.maxhp * e.selfheal * dt * 0.2);
      if (e.gimmick === 'breather' && e.aggro) {
        e.breatherT += dt;
        const was = e.breather;
        e.breather = (e.breatherT % 10) > 7;
        if (e.breather && !was) ev(W, { t: 'breather', e });
      }
      if (e.stagger > 0) { e.stagger -= dt; e.telegraph = null; e.charging = null; continue; }

      const dp = Math.hypot(p.x - e.x, p.z - e.z);
      if (!e.aggro) {
        if (dp < W0.aggroRadius) { e.aggro = true; ev(W, { t: 'aggro', e }); }
        else continue;
      }
      if (!e.enc && !e.trial) {
        const dh = Math.hypot(e.homeX - e.x, e.homeZ - e.z);
        if (dh > W0.leashRadius) {
          e.aggro = false; e.hp = e.maxhp;
          e.x = e.homeX; e.z = e.homeZ; e.y = T().groundHeight(e.x, e.z);
          continue;
        }
      }
      for (const m of e.moves) m.cdLeft = Math.max(0, m.cdLeft - dt);
      e.yaw = Math.atan2(p.x - e.x, p.z - e.z);

      // charging dash in progress
      if (e.charging) {
        const c = e.charging;
        c.t += dt;
        let ex = e.x + c.dx * c.speed * dt;
        let ez = e.z + c.dz * c.speed * dt;
        [ex, ez] = T().collide(ex, ez, e.size * 0.7);
        if (e.key === 'whale' || T().groundHeight(ex, ez) >= W0.waterY + 0.1) { e.x = ex; e.z = ez; }
        e.y = e.key === 'whale' ? T().groundHeight(e.x, e.z) + 5 : T().groundHeight(e.x, e.z);
        if (!c.hit && dp < 1.7 + e.size) {
          c.hit = true;
          damagePlayer(W, eAtk(e) * c.mult, e.x, e.z, { knock: 11 });
          if (W.pendingRbd) return W.events;
        }
        if (c.t >= c.dur) e.charging = null;
        continue;
      }

      // telegraphed attack in progress
      if (e.telegraph) {
        const tg = e.telegraph;
        tg.t += dt;
        if (tg.t >= tg.dur) {
          const mv = tg.move || {};
          if (tg.kind === 'melee' || tg.kind === 'combo') {
            if (dp < 3.4 + e.size) damagePlayer(W, eAtk(e) * (mv.mult || 0.95), e.x, e.z);
            if (W.pendingRbd) return W.events;
            if (tg.kind === 'combo') {
              tg.struck = (tg.struck || 0) + 1;
              if (tg.struck < (mv.hits || 2)) { tg.t = tg.dur - (mv.interval || 0.38); continue; }
            }
            mv.cdLeft = mv.cd || 1.7;
          } else if (tg.kind === 'slam') {
            const r = mv.r || 6 + e.size * 1.4;
            if (dp < r && p.iframes <= 0) {
              damagePlayer(W, eAtk(e) * (mv.mult || 1.4), e.x, e.z);
              ev(W, { t: 'shake' });
              if (W.pendingRbd) return W.events;
            }
            mv.cdLeft = mv.cd || 8;
          } else if (tg.kind === 'charge') {
            e.charging = {
              dx: Math.sin(e.yaw), dz: Math.cos(e.yaw),
              speed: mv.speed || 18, mult: mv.mult || 1.3, t: 0, dur: 0.6, hit: false,
            };
            mv.cdLeft = mv.cd || 6;
          } else if (tg.kind === 'volley') {
            const n = mv.count || 3;
            for (let i = 0; i < n; i++) {
              const sp = (i - (n - 1) / 2) * (mv.spread || 0.22);
              const dx = p.x - e.x, dz = p.z - e.z;
              const ca = Math.cos(sp), sa = Math.sin(sp);
              fireBolt(W, e, 'enemy', mv.mult || 0.8, e.element,
                e.x + dx * ca - dz * sa, e.z + dx * sa + dz * ca);
            }
            mv.cdLeft = mv.cd || 4;
          }
          e.telegraph = null;
        }
        continue; // committed during windup
      }

      // pick a move
      const reach = 2.2 + e.size * 0.8;
      let chosen = null;
      for (const mv of e.moves) {
        if (mv.cdLeft > 0) continue;
        if (mv.t === 'melee' && dp < reach + 0.6) { chosen = { kind: 'melee', move: mv, dur: 0.85 }; break; }
        if (mv.t === 'combo' && dp < reach + 0.8) { chosen = { kind: 'combo', move: mv, dur: 0.8 }; break; }
        if (mv.t === 'slam' && dp < (mv.r || 6 + e.size * 1.4) + 1.5) { chosen = { kind: 'slam', move: mv, dur: 1.25 }; break; }
        if (mv.t === 'charge' && dp > 5 && dp < 22) { chosen = { kind: 'charge', move: mv, dur: 0.7 }; break; }
        if (mv.t === 'volley' && dp > 5 && dp < 30) { chosen = { kind: 'volley', move: mv, dur: 0.5 }; break; }
        if (mv.t === 'zones' && dp < 26) {
          const n = mv.count || 2;
          for (let i = 0; i < n; i++) {
            const ang = W.rng() * Math.PI * 2, rr = i === 0 ? 0 : W.rng() * 4.5;
            W.zones.push({
              x: p.x + Math.cos(ang) * rr, z: p.z + Math.sin(ang) * rr,
              r: mv.r || 3.2, mult: mv.mult || 1.2, atk: eAtk(e),
              t: 0, dur: mv.dur || 1.15, done: false,
            });
          }
          mv.cdLeft = mv.cd || 6;
          ev(W, { t: 'sfx', name: 'whoosh' });
          chosen = null;
          break;
        }
      }
      if (chosen) {
        e.telegraph = { kind: chosen.kind, move: chosen.move, t: 0, dur: chosen.dur, struck: 0 };
        ev(W, { t: 'telegraph', e, kind: chosen.kind });
        continue;
      }

      // chase / kite
      const hasMelee = e.moves.some((m) => m.t === 'melee' || m.t === 'combo');
      const want = hasMelee ? reach * 0.7 : 14;
      if (dp > want) {
        const sp = e.speed * (e.boss ? 1.1 : 1);
        let ex = e.x + ((p.x - e.x) / dp) * sp * dt;
        let ez = e.z + ((p.z - e.z) / dp) * sp * dt;
        [ex, ez] = T().collide(ex, ez, e.size * 0.7);
        if (e.key === 'whale' || T().groundHeight(ex, ez) >= W0.waterY + 0.1) { e.x = ex; e.z = ez; }
        e.y = e.key === 'whale' ? T().groundHeight(e.x, e.z) + 5 : T().groundHeight(e.x, e.z);
      } else if (!hasMelee && dp < 8) {
        let ex = e.x - ((p.x - e.x) / dp) * e.speed * 0.7 * dt;
        let ez = e.z - ((p.z - e.z) / dp) * e.speed * 0.7 * dt;
        [ex, ez] = T().collide(ex, ez, e.size * 0.7);
        if (T().groundHeight(ex, ez) >= W0.waterY + 0.1) { e.x = ex; e.z = ez; }
        e.y = T().groundHeight(e.x, e.z);
      }
    }
    W.enemies = W.enemies.filter((e) => !e.dead || e.deathT > 0);

    // ---- camps spawn/respawn near the player
    W.camps.forEach((camp, ci) => {
      if (camp.spawned || W.time < camp.deadUntil) return;
      const d = Math.hypot(camp.x - p.x, camp.z - p.z);
      if (d < 160 && d > 30) {
        camp.spawned = true; camp.alive = camp.n;
        for (let i = 0; i < camp.n; i++) {
          const a = W.rng() * 6.28, r = 3 + W.rng() * 6;
          mkEnemy(W, camp.key, camp.mult, camp.x + Math.cos(a) * r, camp.z + Math.sin(a) * r, { campIdx: ci });
        }
      }
    });

    // ---- quest encounter / trial wave pacing / leashes
    if (W.waveT > 0) {
      W.waveT -= dt;
      if (W.waveT <= 0) {
        if (W.enc) spawnWave(W);
        else if (W.trial) spawnTrialWave(W);
      }
    }
    if (!W.enc && !W.trial && W.quest) {
      const q = W.quest;
      if (Math.hypot(q.spot.x - p.x, q.spot.z - p.z) < W0.encounterRadius) startEncounter(W);
    } else if (W.enc) {
      if (Math.hypot(W.enc.spot.x - p.x, W.enc.spot.z - p.z) > W0.encLeash) clearEncounter(W, true);
    } else if (W.trial) {
      if (Math.hypot(W.trial.def.x - p.x, W.trial.def.z - p.z) > 60) clearTrial(W, true);
    }

    // ---- waypoint discovery
    for (const r of RZ.WDATA.REGIONS) {
      if (!W.waypoints.includes(r.id) &&
          Math.hypot(r.anchor[0] - p.x, r.anchor[1] - p.z) < 14) {
        W.waypoints.push(r.id);
        ev(W, { t: 'discover', region: r });
        ev(W, { t: 'sfx', name: 'reveal4' });
        persist(W);
      }
    }

    // ---- periodic persistence
    W.saveT += dt;
    if (W.saveT > W0.saveEvery) { W.saveT = 0; persist(W); }

    return W.events;
  }

  // ------------------------------------------------------------ misc API
  function fastTravel(W, regionId) {
    if (!W.waypoints.includes(regionId)) return false;
    const r = RZ.WDATA.REGIONS.find((x) => x.id === regionId);
    if (!r) return false;
    if (W.enc) clearEncounter(W, true);
    if (W.trial) clearTrial(W, true);
    W.player.x = r.anchor[0] + 5; W.player.z = r.anchor[1] + 5;
    W.player.y = T().groundHeight(W.player.x, W.player.z);
    W.player.kx = W.player.kz = 0; W.player.vy = 0; W.player.grounded = true;
    W.lock = null;
    persist(W);
    return true;
  }

  function persist(W) {
    RZ.Game.state.world = {
      x: Math.round(W.player.x * 10) / 10,
      z: Math.round(W.player.z * 10) / 10,
      activeIdx: W.activeIdx,
      waypoints: W.waypoints,
    };
    RZ.Game.save();
  }

  function questInfo(W) {
    if (!W.quest) return null;
    const d = Math.hypot(W.quest.spot.x - W.player.x, W.quest.spot.z - W.player.z);
    return { ...W.quest, dist: Math.round(d) };
  }

  RZ.World = {
    create, step, fastTravel, respawnAfterDeath, persist,
    questInfo, activeId, activeStats, pstats, maxHp, nextStage, moveset,
    nearTrial, startTrial,
  };
})();
