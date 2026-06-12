#!/usr/bin/env node
/* UI render smoke test: executes every screen and a live auto-battle against
   a minimal DOM shim to catch runtime template errors without a browser.
   Run: node test/ui-smoke.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- minimal DOM shim -------------------------------------------------
function mkEl() {
  return {
    innerHTML: '', className: '', id: '', value: '',
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild() {}, remove() {}, select() {},
    querySelectorAll() { return []; },
  };
}
const elements = {};
global.document = {
  readyState: 'complete',
  querySelector(sel) {
    if (sel === '#modal') return null; // exercise closeModal()'s null path
    elements[sel] = elements[sel] || mkEl();
    return elements[sel];
  },
  querySelectorAll() { return []; },
  createElement() { return mkEl(); },
  addEventListener() {},
};
global.window = global;

for (const f of ['data.js', 'gacha.js', 'combat.js', 'game.js', 'sfx.js', 'ui.js', 'main.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
}

const RZ = globalThis.RZ;
let failed = 0;
function tryCall(name, fn) {
  try { fn(); console.log('  ✔ ' + name); }
  catch (e) { failed++; console.error('  ✗ ' + name + ' → ' + e.message); }
}

(async () => {
  tryCall('boot ran (home rendered)', () => { if (!RZ.Game.state) throw new Error('no state'); });
  tryCall('switchTab home', () => RZ.UI.switchTab('home'));
  tryCall('claimDaily', () => RZ.UI.claimDaily());
  tryCall('switchTab summon', () => RZ.UI.switchTab('summon'));
  tryCall('showRates', () => RZ.UI.showRates());
  tryCall('selectBanner fate', () => RZ.UI.selectBanner('fate'));
  tryCall('doSummon(10)', () => RZ.UI.doSummon(10));
  await new Promise((r) => setTimeout(r, 1600)); // comet animation timer
  tryCall('revealNext ×11', () => { for (let i = 0; i < 11; i++) RZ.UI.revealNext(); });
  tryCall('showSummonSummary', () => RZ.UI.showSummonSummary());
  tryCall('endSummon', () => RZ.UI.endSummon());
  tryCall('switchTab chars', () => RZ.UI.switchTab('chars'));
  tryCall('openChar subaru', () => RZ.UI.openChar('subaru'));
  tryCall('switchTab party', () => RZ.UI.switchTab('party'));
  tryCall('openSlotPicker', () => RZ.UI.openSlotPicker(1));
  tryCall('switchTab story', () => RZ.UI.switchTab('story'));
  tryCall('openStage c1s1', () => RZ.UI.openStage('c1s1'));
  tryCall('switchTab armory', () => RZ.UI.switchTab('armory'));
  tryCall('openSettings', () => RZ.UI.openSettings());
  tryCall('showExport', () => RZ.UI.showExport());
  tryCall('toggleSound', () => RZ.UI.toggleSound(false));

  // live battle with real timers: start, force auto, wait for the end
  tryCall('startStage c1s1', () => RZ.UI.startStage('c1s1'));
  tryCall('toggleAuto', () => RZ.UI.toggleAuto());
  tryCall('selectTarget', () => RZ.UI.selectTarget(1));
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const st = RZ.Combat.getState();
    if (st && st.over) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  const st = RZ.Combat.getState();
  tryCall('battle finished', () => { if (!st.over) throw new Error('battle did not finish in 30s'); });
  tryCall('battle won (subaru solo vs thugs)', () => { if (!st.victory) throw new Error('lost the tutorial fight'); });
  tryCall('victory rewards applied', () => { if (!RZ.Game.state.cleared.c1s1) throw new Error('stage not marked cleared'); });
  tryCall('closeBattle', () => RZ.UI.closeBattle());
  tryCall('toggleSpeed safe post-battle', () => RZ.UI.toggleSpeed());

  console.log(failed ? `\nUI SMOKE FAILED (${failed})` : '\nUI smoke passed ✔');
  process.exit(failed ? 1 : 0);
})();
