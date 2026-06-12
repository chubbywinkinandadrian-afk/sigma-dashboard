#!/usr/bin/env node
/* Headless smoke test + balance simulation for Re:Impact.
   Run: node test/smoke.js  (exit 0 = pass) */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

for (const f of ['data.js', 'gacha.js', 'combat.js', 'game.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
}
const RZ = globalThis.RZ;
const D = RZ.DATA;

let failures = 0;
function check(cond, msg) {
  if (!cond) { failures += 1; console.error('  ✗ ' + msg); }
}
function section(name) { console.log('\n== ' + name); }

// deterministic rng
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- data integrity
section('data integrity');
{
  const ids = new Set();
  for (const c of D.CHARACTERS) {
    check(!ids.has(c.id), `duplicate char id ${c.id}`);
    ids.add(c.id);
    check(D.ELEMENTS[c.element], `${c.id}: unknown element ${c.element}`);
    check([3, 4, 5].includes(c.rarity), `${c.id}: bad rarity`);
    check(c.skill && c.skill.kind && c.burst && c.burst.kind, `${c.id}: missing skill/burst`);
    const kinds = ['st', 'stmulti', 'multi', 'aoe', 'heal', 'healall', 'shieldall', 'buff', 'debuffall', 'taunt'];
    check(kinds.includes(c.skill.kind), `${c.id}: skill kind ${c.skill.kind}`);
    check(kinds.includes(c.burst.kind), `${c.id}: burst kind ${c.burst.kind}`);
    for (const k of ['hp', 'atk', 'def', 'spd']) check(c.base[k] > 0, `${c.id}: base.${k}`);
  }
  for (const id of D.GACHA.standard5) {
    check(D.charById[id] && D.charById[id].rarity === 5 && !D.charById[id].limited, `standard5 bad: ${id}`);
  }
  for (const id of D.GACHA.pool4) {
    check(D.charById[id] && D.charById[id].rarity === 4, `pool4 bad: ${id}`);
  }
  check(!D.GACHA.pool4.includes('subaru'), 'subaru must not be in gacha');
  for (const b of D.BANNERS) {
    if (b.type === 'limited') {
      check(D.charById[b.featured5] && D.charById[b.featured5].limited, `${b.id}: featured5`);
      for (const id of b.featured4) check(D.GACHA.pool4.includes(id), `${b.id}: featured4 ${id}`);
    }
  }
  const wids = new Set();
  for (const w of D.WEAPONS) { check(!wids.has(w.id), `dup weapon ${w.id}`); wids.add(w.id); }
  for (const ch of D.STORY) {
    for (const st of ch.stages) {
      for (const wave of st.enemies) for (const k of wave) check(D.ENEMIES[k], `${st.id}: unknown enemy ${k}`);
      if (st.join) check(D.charById[st.join], `${st.id}: unknown join ${st.join}`);
      check(st.crystals > 0 && st.xp > 0, `${st.id}: rewards`);
    }
  }
  for (const key of Object.keys(D.REACTIONS)) {
    const [a, b] = key.split('+');
    check(D.ELEMENTS[a] && D.ELEMENTS[b], `reaction key ${key}`);
    check([a, b].sort().join('+') === key, `reaction key not sorted: ${key}`);
  }
  console.log(`  ${D.CHARACTERS.length} characters, ${D.WEAPONS.length} weapons, ` +
    `${D.STORY.reduce((a, c) => a + c.stages.length, 0)} stages OK`);
}

// ---------------------------------------------------------------- gacha
section('gacha (20k pulls, seeded)');
{
  RZ.Gacha.setRng(mulberry32(12345));
  const banner = D.bannerById['sword-saint'];
  const pity = { limited5: 0, limited4: 0, standard5: 0, standard4: 0, guarantee: false };
  let n5 = 0, n4 = 0, n3 = 0, feat = 0, worst5 = 0, since5 = 0, worst4 = 0, since4 = 0;
  let lost5050 = 0, lostThenFeat = 0, awaitingFeat = false;
  for (let i = 0; i < 20000; i++) {
    const r = RZ.Gacha.rollOne(banner, pity);
    since5++; since4++;
    if (r.rarity === 5) {
      n5++; worst5 = Math.max(worst5, since5); since5 = 0; since4 = 0;
      if (r.id === banner.featured5) { feat++; if (awaitingFeat) { lostThenFeat++; awaitingFeat = false; } }
      else { lost5050++; awaitingFeat = true; }
      check(!D.GACHA.standard5.includes(banner.featured5), 'featured must be limited-only');
    } else if (r.rarity === 4) {
      n4++; worst4 = Math.max(worst4, since4); since4 = 0;
      check(D.charById[r.id], 'unknown 4★ ' + r.id);
    } else { n3++; check(D.weaponById[r.id], 'unknown weapon'); }
  }
  check(worst5 <= 90, `hard pity violated: ${worst5}`);
  check(worst4 <= 10, `4★ pity violated: ${worst4}`);
  check(lost5050 === lostThenFeat, `guarantee after lost 50/50 broken (${lost5050} vs ${lostThenFeat})`);
  check(n5 / 20000 > 0.008 && n5 / 20000 < 0.03, `5★ effective rate odd: ${(n5 / 200).toFixed(2)}%`);
  console.log(`  5★ ${n5} (${(n5 / 200).toFixed(2)}%, worst streak ${worst5}), 4★ ${n4}, 3★ ${n3}, featured ${feat}/${n5}`);
  RZ.Gacha.setRng(null);
}

// ---------------------------------------------------------------- game basics
section('game state');
{
  RZ.Game.init();
  const S = RZ.Game.state;
  check(S.crystals === D.START_CRYSTALS, 'start crystals');
  check(S.roster.subaru, 'subaru granted');
  RZ.Gacha.setRng(mulberry32(7));
  const res = RZ.Game.summon('fate', 10);
  check(res && res.length === 10, '10-pull works');
  check(S.crystals === D.START_CRYSTALS - 1600, 'crystals deducted');
  const lf = RZ.Game.levelFromXp(0);
  check(lf.lvl === 1, 'lvl 1 at 0 xp');
  check(RZ.Game.levelFromXp(1e9).lvl === D.LEVEL_CAP, 'level cap respected');
  const stats = RZ.Game.charStats('subaru', 3);
  check(stats.hp > 820, 'determination boosts hp');
  check(RZ.Game.exportSave().length > 10, 'export produces code');
  const code = RZ.Game.exportSave();
  RZ.Game.resetSave();
  check(RZ.Game.state.stats.pulls === 0, 'reset works');
  check(RZ.Game.importSave(code), 'import works');
  check(RZ.Game.state.stats.pulls === 10, 'import restored pulls');
  RZ.Gacha.setRng(null);
}

// ---------------------------------------------------------------- combat unit checks
section('combat mechanics');
{
  // Reaction triggers: water then fire on same target → Steam Burst
  const rng = mulberry32(42);
  const mk = (id) => ({ ...RZ.DATA.charById[id].base, id, name: id, icon: 'x',
    element: RZ.DATA.charById[id].element, rarity: 4,
    hp: 5000, atk: 200, def: 50, spd: RZ.DATA.charById[id].base.spd, crit: 0,
    skill: RZ.DATA.charById[id].skill, burst: RZ.DATA.charById[id].burst,
    passive: RZ.DATA.charById[id].passive || null });
  const r = RZ.Combat.simulate({ allies: [mk('emilia'), mk('ricardo')], waves: [['giant_ulgarm']], mult: 1, rng });
  check(r.victory, 'strong duo beats alpha ulgarm');
  const sawReaction = r.state.log.some((l) => /Steam Burst|Firestorm|Tempest|Curse|Purge|Eclipse|Magma|Quagmire|Sandstorm/.test(l.text));
  check(sawReaction, 'an elemental reaction fired in mixed-element fight');

  // RbD: weak subaru party vs strong boss → revive fires once
  const weak = (id) => ({ ...mk(id), hp: 200, atk: 30 });
  const r2 = RZ.Combat.simulate({ allies: [weak('subaru')], waves: [['whale']], mult: 1, rng: mulberry32(9) });
  check(!r2.victory, 'doomed fight lost (as expected)');
  check(r2.rbdUsed, 'Return by Death revive triggered in-battle');

  // Felt loot
  const r3 = RZ.Combat.simulate({ allies: [mk('felt')], waves: [['thug']], mult: 1, rng: mulberry32(5) });
  check(r3.victory && r3.lootCrystals > 0, 'felt steals crystals');
}

// ---------------------------------------------------------------- balance simulation
section('story balance (simulated playthrough)');
{
  RZ.Game.resetSave();
  const S = RZ.Game.state;
  // realistic roster: free joins + a couple of early 4★ pulls (any player with
  // 20 starting pulls is pity-guaranteed at least two 4★)
  const grindLog = [];
  let totalGrinds = 0;
  let seed = 1000;

  const tryStage = (chapter, stage) => {
    const det = S.determination[stage.id] || 0;
    const allies = RZ.Game.buildParty(stage.id);
    return RZ.Combat.simulate({ allies, waves: stage.enemies, mult: chapter.mult, rng: mulberry32(seed++) });
  };

  outer:
  for (const chapter of D.STORY) {
    // mimic gacha luck: pick up helpers as the story advances (pity guarantees
    // several 4★ by mid-game for any player spending story crystals)
    if (chapter.num === 2) { RZ.Game.grantChar('petra'); RZ.Game.grantChar('otto'); RZ.Game.setParty(['subaru', 'emilia', 'felt', 'petra']); }
    if (chapter.num === 4) { RZ.Game.grantChar('garfiel'); RZ.Game.setParty(['subaru', 'emilia', 'garfiel', 'petra']); }
    if (chapter.num === 5) { RZ.Game.grantChar('elsa'); RZ.Game.grantChar('ricardo'); RZ.Game.setParty(['subaru', 'emilia', 'elsa', 'petra']); }

    for (const stage of chapter.stages) {
      let attempts = 0, grinds = 0, won = false, rounds = 0;
      while (!won) {
        attempts += 1;
        const r = tryStage(chapter, stage);
        rounds = r.rounds;
        if (r.victory) {
          RZ.Game.onStageVictory(stage.id, r);
          won = true;
        } else {
          RZ.Game.onStageDefeat(stage.id); // determination +1 (max 3)
          if (attempts >= 4) {
            // grind: replay all previously-cleared stages once (40% xp)
            grinds += 1; totalGrinds += 1;
            for (const ch2 of D.STORY) for (const s2 of ch2.stages) {
              if (S.cleared[s2.id]) {
                const rr = tryStage(ch2, s2);
                if (rr.victory) RZ.Game.onStageVictory(s2.id, rr);
              }
            }
            attempts = 1; // keep determination, try again
            if (grinds > 8) { check(false, `${stage.id} unbeatable even after ${grinds} grind loops`); break outer; }
          }
        }
      }
      const lvl = RZ.Game.levelFromXp(S.roster.subaru.xp).lvl;
      grindLog.push(`  ${stage.id.padEnd(5)} ${String(stage.name).padEnd(26)} lvl ${String(lvl).padEnd(3)} rounds ${String(rounds).padEnd(3)} retries ${attempts - 1} grinds ${grinds}`);
    }
  }
  console.log(grindLog.join('\n'));
  console.log(`  total grind loops needed: ${totalGrinds}`);
  check(totalGrinds <= 10, `too grindy: ${totalGrinds} grind loops`);
  const cleared = Object.keys(S.cleared).length;
  const total = D.STORY.reduce((a, c) => a + c.stages.length, 0);
  check(cleared === total, `full clear achieved (${cleared}/${total})`);
}

// ----------------------------------------------------------------
console.log(failures ? `\nFAILED: ${failures} problem(s)` : '\nAll smoke checks passed ✔');
process.exit(failures ? 1 : 0);
