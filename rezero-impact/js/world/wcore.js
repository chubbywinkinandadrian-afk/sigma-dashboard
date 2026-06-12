/* Re:Impact World — real-time simulation core (no rendering, no DOM).
   Drives exploration, combat, AI and quest flow; RZ.WRender/WHud consume events. */
(function () {
  const RZ = (globalThis.RZ = globalThis.RZ || {});
  const D = () => RZ.DATA;
  const WD = () => RZ.WDATA.WORLD;
  const T = () => RZ.Terrain;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  // ------------------------------------------------------------ creation
  function create(opts) {
    opts = opts || {};
    const saved = (RZ.Game.state && RZ.Game.state.world) || {};
    const W = {
      time: 0,
      rng: opts.rng || Math.random,
      player: {
        x: saved.x != null ? saved.x : -732, z: saved.z != null ? saved.z : 652, y: 0,
        yaw: 0, vx: 0, vz: 0, kx: 0, kz: 0,
        dodgeT: 0, dodgeCd: 0, dodgeDirX: 0, dodgeDirZ: 1,
        iframes: 0, attackCd: 0, swing: null,
      },
      partyIds: RZ.Game.state.party.slice(0, 4),
      activeIdx: clamp(saved.activeIdx || 0, 0, Math.max(0, RZ.Game.state.party.length - 1)),
      hp: {}, energy: {}, skillCd: {},
      buffs: [], shield: 0, shieldUntil: 0,
      lastHurt: -99, lastRegenTick: 0,
      enemies: [], bolts: [],
      camps: RZ.WDATA.MOB_CAMPS.map((c) => ({ ...c, deadUntil: 0, alive: 0, spawned: false })),
      quest: null, enc: null, waveT: 0,
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

  function ev(W, e) { W.events.push(e); }

  // ------------------------------------------------------------ enemies
  function mkEnemy(W, key, mult, x, z, opts) {
    const base = D().ENEMIES[key];
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
      caster: RZ.WDATA.CASTERS.includes(key),
      aggro: false, stagger: 0, telegraph: null,
      gimmick: base.gimmick || null, breather: false, breatherT: 0,
      atkCd: 1 + W.rng(), castCd: 1.5, slamCd: 5,
      aura: null, dots: [], debuffs: [], dotAcc: 0,
      dead: false, deathT: 0,
      enc: opts && opts.enc || false, campIdx: opts && opts.campIdx != null ? opts.campIdx : -1,
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

  // ------------------------------------------------------------ reactions (shared tables with the menu game)
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
    if (!e.aggro && !e.dead) { e.aggro = true; }
    if (opts.dot && !e.dead) e.dots.push({ dps: s.atk * opts.dot.mult * 0.5, until: W.time + opts.dot.turns * 2.5 });
    if (opts.stun && W.rng() < opts.stun && !e.dead) e.stagger = Math.max(e.stagger, 1.4);
    if (opts.selfheal) healParty(W, [activeId(W)], dmg * opts.selfheal);
    return dmg;
  }

  function damageEnemyRaw(W, e, dmg) {
    if (e.dead) return;
    e.hp -= dmg;
    if (e.hp <= 0) {
      e.hp = 0; e.dead = true; e.deathT = 1.0; e.telegraph = null;
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
      p.kx += (dx / l) * 6; p.kz += (dz / l) * 6;
    }
    if (W.hp[id] <= 0) {
      ev(W, { t: 'down', id });
      const next = W.partyIds.findIndex((cid) => W.hp[cid] > 0);
      if (next >= 0) {
        W.activeIdx = next;
        ev(W, { t: 'switch', id: W.partyIds[next], auto: true });
      } else {
        // total party defeat → Return by Death
        W.pendingRbd = true;
        if (W.enc) {
          W.det = RZ.Game.onStageDefeat(W.enc.stageId);
          clearEncounter(W, false);
        }
        ev(W, { t: 'rbd', det: W.det });
      }
    }
  }

  function healParty(W, ids, amount) {
    for (const id of ids) {
      if (W.hp[id] <= 0) continue; // no revives outside RbD
      const mx = maxHp(id, W.det);
      W.hp[id] = Math.min(mx, W.hp[id] + Math.round(amount));
    }
    ev(W, { t: 'heal', x: W.player.x, y: W.player.y + 2.2, z: W.player.z, amount: Math.round(amount) });
  }

  function respawnAfterDeath(W) {
    const p = W.player;
    let tx = -732, tz = 652;
    if (W.waypoints.length) {
      const last = RZ.WDATA.REGIONS.find((r) => r.id === W.waypoints[W.waypoints.length - 1]);
      if (last) { tx = last.anchor[0] + 4; tz = last.anchor[1] + 4; }
    }
    p.x = tx; p.z = tz; p.y = T().groundHeight(tx, tz);
    p.kx = p.kz = 0; p.swing = null; p.iframes = 1.5;
    for (const id of W.partyIds) { W.hp[id] = maxHp(id, W.det); W.energy[id] = 0; W.skillCd[id] = 0; }
    W.buffs = []; W.shield = 0;
    W.pendingRbd = false;
    W.lock = null;
    persist(W);
  }

  // ------------------------------------------------------------ encounters (story stages in the world)
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
      W.waveT = 1.2; // next wave spawns after a beat (handled in step)
      return;
    }
    // stage cleared!
    const r = RZ.Game.onStageVictory(enc.stageId, { lootCrystals: 0 });
    W.det = 0;
    ev(W, { t: 'stage-clear', stage: enc.stage, rewards: r });
    ev(W, { t: 'sfx', name: 'victory' });
    if (r.joined) ev(W, { t: 'joined', id: r.joined });
    // breather heal
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

  // ------------------------------------------------------------ player skills (adapts menu skill specs to real-time)
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
    const opts = {
      critGuaranteed: spec.critGuaranteed,
      dot: spec.dot, stun: spec.stun, selfheal: spec.selfheal,
    };
    let mult = spec.mult || 0;
    if (spec.randomMult) mult = spec.randomMult[0] + W.rng() * (spec.randomMult[1] - spec.randomMult[0]);
    if (isBurst) ev(W, { t: 'burst-fx', x: p.x, y: p.y, z: p.z, element: s.element });
    else ev(W, { t: 'skill-fx', x: p.x, y: p.y, z: p.z, element: s.element });

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
      case 'buff': case 'debuffall': break; // riders below
      default: break;
    }
    // riders shared with the menu game's spec format
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
  function fireBolt(W, from, side, dmgMult, element, tx, tz) {
    const dx = tx - from.x, dz = tz - from.z;
    const l = Math.hypot(dx, dz) || 1;
    W.bolts.push({
      x: from.x, y: from.y + (from.size ? from.size * 1.2 : 1.6), z: from.z,
      dx: dx / l, dz: dz / l, side, dmgMult, element,
      life: 2.2, srcAtk: side === 'enemy' ? eAtk(from) : 0,
    });
    ev(W, { t: 'sfx', name: 'whoosh' });
  }

  // ------------------------------------------------------------ main step
  function step(W, dt, input) {
    dt = Math.min(dt, 0.05);
    W.events = [];
    if (W.pendingRbd) return W.events; // frozen until respawn
    W.time += dt;
    const p = W.player;
    const s = activeStats(W);
    const id = activeId(W);

    // ---- timers
    p.iframes = Math.max(0, p.iframes - dt);
    p.dodgeCd = Math.max(0, p.dodgeCd - dt);
    p.attackCd = Math.max(0, p.attackCd - dt);
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

    // ---- movement
    const moving = Math.hypot(input.mx || 0, input.mz || 0) > 0.01;
    let nx = p.x, nz = p.z;
    if (p.dodgeT > 0) {
      p.dodgeT -= dt;
      nx += p.dodgeDirX * WD().dodgeSpeed * dt;
      nz += p.dodgeDirZ * WD().dodgeSpeed * dt;
    } else {
      if (input.dodge && p.dodgeCd <= 0) {
        p.dodgeT = 0.3; p.dodgeCd = WD().dodgeCd; p.iframes = WD().dodgeIframes;
        if (moving) { p.dodgeDirX = input.mx; p.dodgeDirZ = input.mz; }
        else { p.dodgeDirX = -Math.sin(p.yaw); p.dodgeDirZ = -Math.cos(p.yaw); }
        ev(W, { t: 'sfx', name: 'click' });
      } else if (moving) {
        const sp = WD().playerSpeed * (input.sprint ? WD().sprintMult : 1);
        nx += input.mx * sp * dt;
        nz += input.mz * sp * dt;
      }
    }
    // knockback decay
    nx += p.kx * dt; nz += p.kz * dt;
    p.kx *= Math.pow(0.02, dt); p.kz *= Math.pow(0.02, dt);
    // water + bounds: slide along blocked axes
    nx = clamp(nx, -1150, 1150); nz = clamp(nz, -1150, 1150);
    const wl = WD().waterY + 0.15;
    if (T().groundHeight(nx, nz) >= wl) { p.x = nx; p.z = nz; }
    else if (T().groundHeight(nx, p.z) >= wl) { p.x = nx; }
    else if (T().groundHeight(p.x, nz) >= wl) { p.z = nz; }
    p.y = T().groundHeight(p.x, p.z);

    // facing
    if (W.lock) p.yaw = Math.atan2(W.lock.x - p.x, W.lock.z - p.z);
    else if (moving && p.dodgeT <= 0) {
      const target = Math.atan2(input.mx, input.mz);
      let d = target - p.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      p.yaw += d * Math.min(1, dt * 12);
    }

    // ---- attacks
    if (input.attack && p.attackCd <= 0 && p.dodgeT <= 0) {
      p.attackCd = WD().attackRate;
      W.energy[id] = Math.min(100, W.energy[id] + WD().energyMelee);
      if (s.ranged) {
        let tx = p.x + Math.sin(p.yaw) * 20, tz = p.z + Math.cos(p.yaw) * 20;
        if (W.lock) { tx = W.lock.x; tz = W.lock.z; }
        fireBolt(W, { x: p.x, z: p.z, y: p.y }, 'player', 0.85, s.element, tx, tz);
        p.swing = { t: 0, dur: 0.22, hit: true };
      } else {
        p.swing = { t: 0, dur: 0.3, hit: false };
      }
      ev(W, { t: 'swing' });
    }
    if (p.swing) {
      p.swing.t += dt;
      if (!p.swing.hit && p.swing.t >= 0.14) {
        p.swing.hit = true;
        const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
        let landed = false;
        for (const e of W.enemies) {
          if (e.dead) continue;
          const dx = e.x - p.x, dz = e.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d < WD().attackRange + e.size && (dx * fx + dz * fz) / (d || 1) > WD().attackArc) {
            hitEnemy(W, e, 0.85, {});
            landed = true;
          }
        }
        if (landed) ev(W, { t: 'sfx', name: 'hit' });
      }
      if (p.swing.t >= p.swing.dur) p.swing = null;
    }

    // ---- skill / burst
    if (input.skill && W.skillCd[id] <= 0) {
      if (castSkill(W, s.skill, false)) {
        W.skillCd[id] = s.skill.cd * WD().skillCdMult;
        W.energy[id] = Math.min(100, W.energy[id] + WD().energySkill);
      }
    }
    if (input.burst && W.energy[id] >= 100) {
      if (castSkill(W, s.burst, true)) W.energy[id] = 0;
    }

    // ---- regen out of combat
    if (W.time - W.lastHurt > WD().regenDelay) {
      for (const cid of W.partyIds) {
        if (W.hp[cid] > 0) W.hp[cid] = Math.min(maxHp(cid, W.det), W.hp[cid] + maxHp(cid, W.det) * WD().regenRate * dt);
      }
    }

    // ---- bolts
    for (const b of W.bolts) {
      b.x += b.dx * WD().boltSpeed * dt;
      b.z += b.dz * WD().boltSpeed * dt;
      b.life -= dt;
      if (b.life <= 0) { b.dead = true; continue; }
      if (b.side === 'player') {
        for (const e of W.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - b.x, e.z - b.z) < 1.4 + e.size * 0.6) {
            hitEnemy(W, e, b.dmgMult, { element: b.element });
            b.dead = true; break;
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

    // ---- enemies
    for (const e of W.enemies) {
      if (e.dead) { e.deathT -= dt; continue; }
      // dots
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
        // 7s armored monologue → 3s gasping for air with zero DEF
        e.breatherT += dt;
        const wasBreather = e.breather;
        e.breather = (e.breatherT % 10) > 7;
        if (e.breather && !wasBreather) ev(W, { t: 'breather', e });
      }
      if (e.stagger > 0) { e.stagger -= dt; continue; }

      const dp = Math.hypot(p.x - e.x, p.z - e.z);
      if (!e.aggro) {
        if (dp < WD().aggroRadius) { e.aggro = true; ev(W, { t: 'aggro', e }); }
        else continue;
      }
      // leash for camp mobs (encounter enemies never give up)
      if (!e.enc) {
        const dh = Math.hypot(e.homeX - e.x, e.homeZ - e.z);
        if (dh > WD().leashRadius) {
          e.aggro = false; e.hp = e.maxhp;
          e.x = e.homeX; e.z = e.homeZ; e.y = T().groundHeight(e.x, e.z);
          continue;
        }
      }
      e.atkCd = Math.max(0, e.atkCd - dt);
      e.castCd = Math.max(0, e.castCd - dt);
      e.slamCd = Math.max(0, e.slamCd - dt);
      e.yaw = Math.atan2(p.x - e.x, p.z - e.z);

      // telegraphed attacks
      if (e.telegraph) {
        e.telegraph.t += dt;
        if (e.telegraph.t >= e.telegraph.dur) {
          if (e.telegraph.type === 'melee') {
            if (dp < 3.4 + e.size) damagePlayer(W, eAtk(e) * 0.95, e.x, e.z);
            e.atkCd = 1.7;
          } else { // slam
            if (dp < e.telegraph.r) {
              damagePlayer(W, eAtk(e) * 1.4, e.x, e.z);
              ev(W, { t: 'shake' });
            }
            e.slamCd = 8;
          }
          e.telegraph = null;
          if (W.pendingRbd) return W.events;
        }
        continue; // committed — stands still during windup
      }
      if (e.boss && e.slamCd <= 0 && dp < 8 + e.size) {
        e.telegraph = { type: 'slam', t: 0, dur: 1.25, r: 6 + e.size * 1.4 };
        ev(W, { t: 'telegraph', e, type: 'slam' });
        continue;
      }
      if (e.caster && dp > 5 && dp < 28 && e.castCd <= 0) {
        e.castCd = 2.4;
        fireBolt(W, e, 'enemy', 0.8, e.element, p.x, p.z);
        continue;
      }
      const reach = 2.2 + e.size * 0.8;
      if (dp < reach + 0.6) {
        if (e.atkCd <= 0) {
          e.telegraph = { type: 'melee', t: 0, dur: 0.85 };
          ev(W, { t: 'telegraph', e, type: 'melee' });
        }
      } else {
        // chase (casters keep mid distance)
        const want = e.caster ? 14 : reach * 0.7;
        if (dp > want) {
          const sp = e.speed * (e.boss ? 1.1 : 1);
          let ex = e.x + ((p.x - e.x) / dp) * sp * dt;
          let ez = e.z + ((p.z - e.z) / dp) * sp * dt;
          if (e.key === 'whale' || T().groundHeight(ex, ez) >= WD().waterY + 0.1) { e.x = ex; e.z = ez; }
          e.y = e.key === 'whale' ? T().groundHeight(e.x, e.z) + 5 : T().groundHeight(e.x, e.z);
        }
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

    // ---- quest encounter trigger / wave pacing / leash
    if (W.waveT > 0) {
      W.waveT -= dt;
      if (W.waveT <= 0 && W.enc) spawnWave(W);
    }
    if (!W.enc && W.quest) {
      const q = W.quest;
      if (Math.hypot(q.spot.x - p.x, q.spot.z - p.z) < WD().encounterRadius) startEncounter(W);
    } else if (W.enc) {
      if (Math.hypot(W.enc.spot.x - p.x, W.enc.spot.z - p.z) > WD().encLeash) clearEncounter(W, true);
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
    if (W.saveT > WD().saveEvery) { W.saveT = 0; persist(W); }

    return W.events;
  }

  // ------------------------------------------------------------ misc API
  function fastTravel(W, regionId) {
    if (!W.waypoints.includes(regionId)) return false;
    const r = RZ.WDATA.REGIONS.find((x) => x.id === regionId);
    if (!r) return false;
    if (W.enc) clearEncounter(W, true);
    W.player.x = r.anchor[0] + 5; W.player.z = r.anchor[1] + 5;
    W.player.y = T().groundHeight(W.player.x, W.player.z);
    W.player.kx = W.player.kz = 0;
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
    questInfo, activeId, activeStats, pstats, maxHp, nextStage,
  };
})();
