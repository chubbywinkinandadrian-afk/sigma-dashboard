#!/usr/bin/env node
/* Headless test for the 3D open-world mode: terrain sanity, stage placement,
   and a full bot playthrough of the quest chain in real-time combat.
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
  check(frac > 0.01 && frac < 0.4, `water coverage odd: ${(frac * 100).toFixed(1)}%`);
  console.log(`  ${n} samples, water ${(frac * 100).toFixed(1)}%`);
}

// ---------------------------------------------------------------- placement
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
  for (const c of D.CHARACTERS) check(WD.LOOKS[c.id], `no look for ${c.id}`);
  for (const k of Object.keys(D.ENEMIES)) check(WD.ENEMY_LOOKS[k], `no enemy look for ${k}`);
  for (const id of WD.RANGED) check(D.charById[id], `RANGED unknown id ${id}`);
  for (const k of WD.CASTERS) check(D.ENEMIES[k], `CASTERS unknown key ${k}`);
  console.log(`  ${stageIds.length} spots, ${WD.MOB_CAMPS.length} camps, ${Object.keys(WD.LOOKS).length} looks OK`);
}

// ---------------------------------------------------------------- bot playthrough
section('bot playthrough (full quest chain, real-time)');
{
  RZ.Game.init();
  RZ.Game.resetSave();
  const S = RZ.Game.state;
  const rng = mulberry32(777);
  const DT = 1 / 30;

  let W = RZ.World.create({ rng });
  const lines = [];
  let totalRetries = 0;

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
      if (W.enc) {
        const sx = W.enc.spot.x - p.x, sz = W.enc.spot.z - p.z, sl = Math.hypot(sx, sz) || 1;
        if (sl > 28) { input.mx = sx / sl; input.mz = sz / sl; }
      }
      // dodge a landing telegraph
      if (near.telegraph && near.telegraph.t > near.telegraph.dur - 0.4 && nd < 9) input.dodge = true;
    }
    return input;
  }

  function refreshParty(chapterNum) {
    if (chapterNum === 2) { RZ.Game.grantChar('petra'); RZ.Game.grantChar('otto'); RZ.Game.setParty(['emilia', 'subaru', 'felt', 'petra']); }
    if (chapterNum === 4) { RZ.Game.grantChar('garfiel'); RZ.Game.setParty(['emilia', 'subaru', 'garfiel', 'petra']); }
    if (chapterNum === 5) { RZ.Game.grantChar('elsa'); RZ.Game.grantChar('ricardo'); RZ.Game.setParty(['emilia', 'elsa', 'subaru', 'petra']); }
    const saved = RZ.Game.state.world || {};
    W = RZ.World.create({ rng });
  }

  let lastChapter = 1;
  let guard = 0;
  while (W.quest && guard++ < 40) {
    const q = W.quest;
    if (q.chapter.num !== lastChapter) { lastChapter = q.chapter.num; refreshParty(lastChapter); continue; }

    // "travel": park just outside the trigger radius, then walk in
    W.player.x = q.spot.x + 19; W.player.z = q.spot.z;
    W.player.y = RZ.Terrain.groundHeight(W.player.x, W.player.z);

    let t = 0, retries = 0, done = false;
    while (!done && t < 500) {
      const input = botInput(W);
      if (!W.enc) { // walk toward the spot to trigger it
        const dx = q.spot.x - W.player.x, dz = q.spot.z - W.player.z, l = Math.hypot(dx, dz) || 1;
        if (l > 2) { input.mx = dx / l; input.mz = dz / l; }
      }
      const events = RZ.World.step(W, DT, input);
      t += DT;
      for (const e of events) {
        if (e.t === 'rbd') {
          retries++; totalRetries++;
          RZ.World.respawnAfterDeath(W);
          W.player.x = q.spot.x + 19; W.player.z = q.spot.z;
          W.player.y = RZ.Terrain.groundHeight(W.player.x, W.player.z);
        }
        if (e.t === 'stage-clear') done = true;
      }
      if (retries > 8) break;
      if (!isFinite(W.player.x) || !isFinite(W.player.z)) { check(false, `NaN player position at ${q.stageId}`); done = true; }
    }
    check(done, `${q.stageId} not cleared (t=${Math.round(t)}s retries=${retries})`);
    if (!done) break;
    const lvl = RZ.Game.levelFromXp(S.roster.subaru.xp).lvl;
    lines.push(`  ${q.stageId.padEnd(5)} ${q.stage.name.padEnd(26)} lvl ${String(lvl).padEnd(3)} ${String(Math.round(t)).padStart(3)}s retries ${retries}`);
    W.quest = RZ.World.nextStage(); // re-read (already advanced by stage-clear, but be explicit)
  }
  console.log(lines.join('\n'));
  const clearedAll = D.STORY.every((ch) => ch.stages.every((st) => S.cleared[st.id]));
  check(clearedAll, 'full story not cleared in world mode');
  check(totalRetries <= 12, `too many deaths overall: ${totalRetries}`);
  console.log(`  total retries: ${totalRetries}`);

  // waypoints + fast travel
  for (const r of WD.REGIONS) {
    W.player.x = r.anchor[0] + 2; W.player.z = r.anchor[1] + 2;
    RZ.World.step(W, DT, { mx: 0, mz: 0 });
  }
  check(W.waypoints.length === WD.REGIONS.length, `waypoints discovered: ${W.waypoints.length}/${WD.REGIONS.length}`);
  check(RZ.World.fastTravel(W, 'capital'), 'fast travel works');
  check(RZ.Game.state.world && isFinite(RZ.Game.state.world.x), 'world state persisted');
}

// ---------------------------------------------------------------- HUD execution (DOM shim)
section('HUD execution (shimmed DOM)');
{
  const mkCtx = () => new Proxy({}, { get: (t, k) => (k === 'canvas' ? {} : () => mkCtx()) });
  const mkEl = () => ({
    innerHTML: '', className: '', id: '', style: {}, width: 0, height: 0,
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild() {}, remove() {}, getContext() { return mkCtx(); },
    set onclick(f) {}, textContent: '',
  });
  global.document = {
    querySelector() { return mkEl(); },
    createElement() { return mkEl(); },
    body: { classList: { add() {}, remove() {} }, offsetWidth: 0 },
  };
  global.setTimeout = global.setTimeout;
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
      { t: 'quest', quest: RZ.World.nextStage() || { stage: { name: 'x' } } },
      { t: 'dmg', side: 'player' }, { t: 'sfx', name: 'hit' },
    ]);
    RZ.WHud.togglePause(true); RZ.WHud.togglePause(false);
    console.log('  HUD init/update/events execute ✔');
  } catch (e) {
    check(false, 'HUD execution: ' + e.message);
  }
}

console.log(failures ? `\nWORLD SMOKE FAILED (${failures})` : '\nWorld smoke passed ✔');
process.exit(failures ? 1 : 0);
