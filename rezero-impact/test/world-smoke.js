#!/usr/bin/env node
/* Headless test for the 3D open-world mode: terrain sanity, placement, physics,
   weapon/enemy movesets, trials, and a full bot playthrough in real time.
   Run: node test/world-smoke.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

for (const f of ['data.js', 'gacha.js', 'game.js', 'world/wdata.js', 'world/terrain.js', 'world/wcore.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
}
const RZ = globalThis.RZ;
const D = RZ.DATA;
const WD = RZ.WDATA;

let failures = 0;
const check = (c, m) => { if (!c) { failures++; console.error('  ✗ ' + m); } };
const section = (n) => console.log('\n== ' + n);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- terrain
section('terrain');
{
  let bad = 0, waterFrac = 0, n = 0;
  for (let x = -1190; x <= 1190; x += 24) {
    for (let z = -1190; z <= 1190; z += 24) {
      const h = RZ.Terrain.height(x, z);
      const c = RZ.Terrain.colorAt(x, z);
      if (!isFinite(h) || c.some((v) => !isFinite(v) || v < 0 || v > 1)) bad++;
      if (h < WD.WORLD.waterY) waterFrac++;
      n++;
    }
  }
  check(bad === 0, `${bad} NaN/invalid terrain samples`);
  const frac = waterFrac / n;
  check(frac > 0.01 && frac < 0.25, `water coverage odd: ${(frac * 100).toFixed(1)}%`);
  // somewhere must be steep enough to require climbing
  let steep = 0;
  for (let x = 990; x < 1130; x += 4) {
    const s = (RZ.Terrain.height(x + 1, 0) - RZ.Terrain.height(x, 0));
    if (s > WD.WORLD.climbSlope) steep++;
  }
  check(steep > 0, 'no climb-steep slopes found on border mountains');
  console.log(`  ${n} samples, water ${(frac * 100).toFixed(1)}%, steep border samples: ${steep}`);
}

// ---------------------------------------------------------------- placement & data refs
section('placement & data refs');
{
  const stageIds = [];
  for (const ch of D.STORY) for (const st of ch.stages) stageIds.push(st.id);
  for (const sid of stageIds) check(WD.STAGE_SPOTS[sid], `missing world spot for ${sid}`);
  for (const sid of Object.keys(WD.STAGE_SPOTS)) check(stageIds.includes(sid), `orphan spot ${sid}`);
  for (const [sid, s] of Object.entries(WD.STAGE_SPOTS)) {
    const g = RZ.Terrain.groundHeight(s.x, s.z);
    check(g >= WD.WORLD.waterY + 0.1, `${sid} spot is underwater (g=${g.toFixed(2)})`);
    check(WD.REGIONS.some((r) => r.id === s.region), `${sid} bad region`);
  }
  for (const r of WD.REGIONS) {
    const g = RZ.Terrain.groundHeight(r.anchor[0] + 5, r.anchor[1] + 5);
    check(g >= WD.WORLD.waterY + 0.1, `waypoint ${r.id} spawn underwater`);
  }
  for (const c of WD.MOB_CAMPS) {
    check(D.ENEMIES[c.key], `camp enemy ${c.key} unknown`);
    check(RZ.Terrain.groundHeight(c.x, c.z) >= WD.WORLD.waterY, `camp at ${c.x},${c.z} underwater`);
  }
  for (const c of D.CHARACTERS) {
    const L = WD.LOOKS[c.id];
    check(L, `no look for ${c.id}`);
    if (L && !L.cat) {
      const ms = WD.RANGED.includes(c.id) ? WD.WEAPON_MOVES.caster : WD.WEAPON_MOVES[L.weapon];
      check(ms && ms.combo && ms.heavy && ms.plunge, `${c.id}: weapon '${L.weapon}' has no moveset`);
    }
  }
  for (const k of Object.keys(D.ENEMIES)) check(WD.ENEMY_LOOKS[k], `no enemy look for ${k}`);
  for (const id of WD.RANGED) check(D.charById[id], `RANGED unknown id ${id}`);
  for (const [k, list] of Object.entries(WD.MOVES)) {
    check(D.ENEMIES[k], `MOVES for unknown enemy ${k}`);
    for (const m of list) check(['melee', 'combo', 'slam', 'charge', 'volley', 'zones'].includes(m.t), `${k}: bad move ${m.t}`);
  }
  for (const t of WD.TRIALS) {
    check(RZ.Terrain.groundHeight(t.x, t.z) >= WD.WORLD.waterY + 0.1, `trial ${t.id} underwater`);
    check(D.ENEMIES[t.boss], `trial ${t.id} boss unknown`);
    for (const k of t.theme) check(D.ENEMIES[k], `trial ${t.id} theme enemy ${k} unknown`);
  }
  for (const npc of WD.NPCS) {
    check(WD.NPC_KINDS[npc.kind], `npc bad kind ${npc.kind}`);
    check(npc.line && npc.line.length > 4, 'npc missing line');
    check(RZ.Terrain.groundHeight(npc.x, npc.z) >= WD.WORLD.waterY, `npc at ${npc.x},${npc.z} underwater`);
  }
  for (const k of Object.keys(WD.XMAS)) {
    if (k !== 'default' && k !== 'trim') check(WD.LOOKS[k], `XMAS override for unknown char ${k}`);
  }
  console.log(`  ${stageIds.length} spots, ${WD.MOB_CAMPS.length} camps, ${WD.NPCS.length} NPCs, ${WD.TRIALS.length} trials OK`);
}

// ---------------------------------------------------------------- physics
section('physics: jump, climb, stamina, collision');
{
  RZ.Game.init();
  RZ.Game.resetSave();
  const W = RZ.World.create({ rng: mulberry32(5) });
  const DT = 1 / 60;
  const flat = { x: -716, z: 660 };
  W.player.x = flat.x; W.player.z = flat.z;
  W.player.y = RZ.Terrain.groundHeight(flat.x, flat.z);
  // jump: leaves ground, comes back
  RZ.World.step(W, DT, { mx: 0, mz: 0, jump: true });
  let air = false, t = 0;
  while (t < 2) {
    RZ.World.step(W, DT, {});
    if (!W.player.grounded) air = true;
    t += DT;
  }
  check(air, 'jump never left the ground');
  check(W.player.grounded, 'never landed after jump');
  // climbing: find a steep border column and push into it
  let cx = null;
  for (let x = 1000; x < 1140; x += 2) {
    if (RZ.Terrain.height(x + 1, 0) - RZ.Terrain.height(x, 0) > WD.WORLD.climbSlope + 0.2) { cx = x; break; }
  }
  check(cx != null, 'no steep climbing wall found');
  if (cx != null) {
    W.player.x = cx - 1; W.player.z = 0;
    W.player.y = RZ.Terrain.groundHeight(W.player.x, W.player.z);
    W.player.grounded = true; W.stamina = 100;
    const y0 = W.player.y;
    let climbed = false;
    for (let i = 0; i < 240; i++) {
      RZ.World.step(W, DT, { mx: 1, mz: 0 });
      if (W.player.climbing) climbed = true;
    }
    const gained = W.player.y - y0;
    check(climbed, 'climbing never engaged on steep wall');
    check(W.stamina < 100, 'climbing consumed no stamina');
    // out of stamina → blocked
    W.stamina = 0;
    const yBlocked = W.player.y;
    for (let i = 0; i < 60; i++) RZ.World.step(W, DT, { mx: 1, mz: 0 });
    check(W.player.y - yBlocked < gained * 0.5 + 0.4, 'no-stamina climb not blocked');
  }
  // collision: fountain circle is solid
  const cap = WD.REGIONS[0].anchor;
  W.player.x = cap[0] + 12; W.player.z = cap[1];
  W.player.y = RZ.Terrain.groundHeight(W.player.x, W.player.z);
  W.player.grounded = true; W.stamina = 100;
  for (let i = 0; i < 300; i++) RZ.World.step(W, DT, { mx: -1, mz: 0 });
  const dFromCenter = Math.hypot(W.player.x - cap[0], W.player.z - cap[1]);
  check(dFromCenter > 7.0, `walked through the fountain (d=${dFromCenter.toFixed(1)})`);
  console.log('  jump/climb/stamina/collision OK');
}

// ---------------------------------------------------------------- bot playthrough
section('bot playthrough (full quest chain, real-time)');
{
  RZ.Game.resetSave();
  const S = RZ.Game.state;
  const rng = mulberry32(777);
  const DT = 1 / 30;

  let W = RZ.World.create({ rng });
  const lines = [];
  let totalRetries = 0;
  const movesSeen = new Set();

  function botInput(W) {
    const p = W.player;
    const s = RZ.World.activeStats(W);
    const input = { mx: 0, mz: 0, attack: true, skill: true, burst: true, dodge: false, switchTo: -1 };
    let near = null, nd = 1e9;
    for (const e of W.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < nd) { nd = d; near = e; }
    }
    if (near) {
      if (!W.lock) input.lockToggle = true; // aim like a player would
      const want = s.ranged ? 11 : 2.0;
      const dx = near.x - p.x, dz = near.z - p.z, l = Math.hypot(dx, dz) || 1;
      if (nd > want + 1) { input.mx = dx / l; input.mz = dz / l; }
      else if (s.ranged && nd < 6) { input.mx = -dx / l; input.mz = -dz / l; }
      // stay inside the arena instead of kiting to the horizon
      const anchor = W.enc ? W.enc.spot : (W.trial ? W.trial.def : null);
      if (anchor) {
        const sx = anchor.x - p.x, sz = anchor.z - p.z, sl = Math.hypot(sx, sz) || 1;
        if (sl > 28) { input.mx = sx / sl; input.mz = sz / sl; }
      }
      // dodge a landing telegraph or an exploding zone underfoot
      if (near.telegraph && near.telegraph.t > near.telegraph.dur - 0.4 && nd < 9) input.dodge = true;
      for (const zn of W.zones) {
        if (!zn.done && zn.t > zn.dur - 0.35 && Math.hypot(zn.x - p.x, zn.z - p.z) < zn.r + 0.5) input.dodge = true;
      }
    }
    return input;
  }

  function refreshParty(chapterNum) {
    if (chapterNum === 2) { RZ.Game.grantChar('petra'); RZ.Game.grantChar('otto'); RZ.Game.setParty(['emilia', 'subaru', 'felt', 'petra']); }
    if (chapterNum === 4) { RZ.Game.grantChar('garfiel'); RZ.Game.setParty(['emilia', 'subaru', 'garfiel', 'petra']); }
    if (chapterNum === 5) { RZ.Game.grantChar('elsa'); RZ.Game.grantChar('ricardo'); RZ.Game.setParty(['emilia', 'elsa', 'subaru', 'petra']); }
    W = RZ.World.create({ rng });
  }

  let lastChapter = 1;
  let guard = 0;
  while (W.quest && guard++ < 40) {
    const q = W.quest;
    if (q.chapter.num !== lastChapter) { lastChapter = q.chapter.num; refreshParty(lastChapter); continue; }

    W.player.x = q.spot.x + 19; W.player.z = q.spot.z;
    W.player.y = RZ.Terrain.groundHeight(W.player.x, W.player.z);
    W.player.grounded = true;

    let t = 0, retries = 0, done = false;
    while (!done && t < 520) {
      const input = botInput(W);
      if (!W.enc) {
        const dx = q.spot.x - W.player.x, dz = q.spot.z - W.player.z, l = Math.hypot(dx, dz) || 1;
        if (l > 2) { input.mx = dx / l; input.mz = dz / l; }
      }
      const events = RZ.World.step(W, DT, input);
      t += DT;
      if (W.zones.length) movesSeen.add('zones');
      for (const e of events) {
        if (e.t === 'telegraph') movesSeen.add(e.kind);
        if (e.t === 'rbd') {
          retries++; totalRetries++;
          RZ.World.respawnAfterDeath(W);
          W.player.x = q.spot.x + 19; W.player.z = q.spot.z;
          W.player.y = RZ.Terrain.groundHeight(W.player.x, W.player.z);
          W.player.grounded = true;
        }
        if (e.t === 'stage-clear') done = true;
      }
      if (retries > 8) break;
      if (!isFinite(W.player.x) || !isFinite(W.player.y)) { check(false, `NaN player position at ${q.stageId}`); done = true; }
    }
    check(done, `${q.stageId} not cleared (t=${Math.round(t)}s retries=${retries})`);
    if (!done) break;
    const lvl = RZ.Game.levelFromXp(S.roster.subaru.xp).lvl;
    lines.push(`  ${q.stageId.padEnd(5)} ${q.stage.name.padEnd(26)} lvl ${String(lvl).padEnd(3)} ${String(Math.round(t)).padStart(3)}s retries ${retries}`);
    W.quest = RZ.World.nextStage();
  }
  console.log(lines.join('\n'));
  const clearedAll = D.STORY.every((ch) => ch.stages.every((st) => S.cleared[st.id]));
  check(clearedAll, 'full story not cleared in world mode');
  check(totalRetries <= 12, `too many deaths overall: ${totalRetries}`);
  for (const k of ['charge', 'combo', 'zones']) check(movesSeen.has(k), `enemy move variety missing: ${k}`);
  console.log(`  total retries: ${totalRetries} · enemy moves seen: ${[...movesSeen].sort().join(', ')}`);

  // ---- trial run (tier II at the sewers)
  const tdef = WD.TRIALS[0];
  W.player.x = tdef.x + 8; W.player.z = tdef.z;
  W.player.y = RZ.Terrain.groundHeight(W.player.x, W.player.z);
  const crystals0 = S.crystals;
  check(RZ.World.startTrial(W, tdef.id, 1), 'trial failed to start');
  let tt = 0, trialDone = false;
  while (!trialDone && tt < 300) {
    const events = RZ.World.step(W, 1 / 30, botInput(W));
    for (const e of events) {
      if (e.t === 'trial-clear') trialDone = true;
      if (e.t === 'rbd') { RZ.World.respawnAfterDeath(W); W.player.x = tdef.x + 8; W.player.z = tdef.z; }
    }
    tt += 1 / 30;
  }
  check(trialDone, `trial not cleared in ${Math.round(tt)}s`);
  check(S.crystals > crystals0, 'trial paid no crystals');
  console.log(`  trial II cleared in ${Math.round(tt)}s (+${S.crystals - crystals0}💎)`);

  // waypoints + fast travel
  for (const r of WD.REGIONS) {
    W.player.x = r.anchor[0] + 2; W.player.z = r.anchor[1] + 2;
    W.player.y = RZ.Terrain.groundHeight(W.player.x, W.player.z);
    W.player.grounded = true;
    RZ.World.step(W, 1 / 30, { mx: 0, mz: 0 });
  }
  check(W.waypoints.length === WD.REGIONS.length, `waypoints discovered: ${W.waypoints.length}/${WD.REGIONS.length}`);
  check(RZ.World.fastTravel(W, 'capital'), 'fast travel works');
  check(RZ.Game.state.world && isFinite(RZ.Game.state.world.x), 'world state persisted');
}

// ---------------------------------------------------------------- character rigs (headless THREE)
section('character rigs (headless THREE)');
{
  try {
    global.THREE = require(path.join(__dirname, '..', 'vendor', 'three.min.js'));
    global.window = { addEventListener() {}, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 };
    vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'world', 'wrender.js'), 'utf8'), { filename: 'wrender.js' });
    let built = 0;
    for (const mode of ['winter', 'classic']) {
      RZ.WRender.setOutfits(mode);
      for (const c of D.CHARACTERS) {
        const rig = RZ.WRender._buildChibi(c.id);
        check(rig && rig.userData && rig.userData.armR, `${c.id} rig missing anim refs (${mode})`);
        built++;
      }
    }
    console.log(`  built ${built} rigs (winter + classic) ✔`);
  } catch (e) {
    check(false, 'rig build crashed: ' + e.message);
  }
}

// ---------------------------------------------------------------- HUD execution (DOM shim)
section('HUD execution (shimmed DOM)');
{
  const mkCtx = () => new Proxy({}, { get: (t, k) => (k === 'canvas' ? {} : () => mkCtx()) });
  const mkEl = () => ({
    innerHTML: '', className: '', id: '', style: {}, width: 0, height: 0,
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild() {}, remove() {}, getContext() { return mkCtx(); },
    set onclick(f) {}, textContent: '', value: '',
  });
  global.document = {
    querySelector() { return mkEl(); },
    querySelectorAll() { return []; },
    createElement() { return mkEl(); },
    body: { classList: { add() {}, remove() {} }, offsetWidth: 0 },
  };
  RZ.WRender = { minimap: null, handleEvents() {} }; // render layer is browser-only
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'world', 'whud.js'), 'utf8'), { filename: 'whud.js' });
  try {
    RZ.WHud.init({});
    const W = RZ.World.create({});
    RZ.WHud.update(W);
    RZ.WHud.handleEvents(W, [
      { t: 'stage-intro', stage: RZ.DATA.STORY[0].stages[0], chapter: RZ.DATA.STORY[0] },
      { t: 'stage-clear', stage: RZ.DATA.STORY[0].stages[0], rewards: { crystals: 80, xpEach: 100, joined: 'felt' } },
      { t: 'wave', wave: 2, total: 2 }, { t: 'discover', region: RZ.WDATA.REGIONS[0] },
      { t: 'loot', crystals: 5, xp: 10 }, { t: 'rbd', det: 1 },
      { t: 'switch', id: 'subaru', auto: true }, { t: 'down', id: 'subaru' },
      { t: 'no-target' }, { t: 'shake' }, { t: 'retreat' }, { t: 'all-clear' },
      { t: 'trial-offer', def: RZ.WDATA.TRIALS[0] },
      { t: 'trial-start', def: RZ.WDATA.TRIALS[0], tier: 1 },
      { t: 'trial-clear', def: RZ.WDATA.TRIALS[0], tier: 1, crystals: 240, xp: 900 },
      { t: 'quest', quest: RZ.World.nextStage() || { stage: { name: 'x' } } },
      { t: 'dmg', side: 'player' }, { t: 'sfx', name: 'hit' },
      { t: 'swing', anim: 'slashR', kind: 'light' },
    ]);
    RZ.WHud.togglePause(true); RZ.WHud.togglePause(false);
    console.log('  HUD init/update/events execute ✔');
  } catch (e) {
    check(false, 'HUD execution: ' + e.message);
  }
}

console.log(failures ? `\nWORLD SMOKE FAILED (${failures})` : '\nWorld smoke passed ✔');
process.exit(failures ? 1 : 0);
