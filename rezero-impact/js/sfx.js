/* Re:Impact — tiny synthesized sound effects (no audio assets). */
(function () {
  const RZ = (globalThis.RZ = globalThis.RZ || {});
  let ctx = null;

  function ac() {
    if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') return null;
    if (!ctx) ctx = new (typeof AudioContext !== 'undefined' ? AudioContext : webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function enabled() {
    return RZ.Game && RZ.Game.state && RZ.Game.state.settings.sound;
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    const a = ac(); if (!a) return;
    const t = a.currentTime + (when || 0);
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }

  RZ.SFX = {
    click()  { if (enabled()) tone(620, 0.06, 'triangle', 0.05); },
    hit()    { if (enabled()) tone(180, 0.1, 'sawtooth', 0.05, 0, 90); },
    heal()   { if (enabled()) { tone(520, 0.12, 'sine', 0.05); tone(780, 0.14, 'sine', 0.04, 0.06); } },
    whoosh() { if (enabled()) tone(220, 0.5, 'sawtooth', 0.06, 0, 1200); },
    reveal3(){ if (enabled()) tone(440, 0.15, 'triangle', 0.06); },
    reveal4(){ if (enabled()) { tone(523, 0.15, 'triangle', 0.07); tone(659, 0.2, 'triangle', 0.07, 0.1); } },
    reveal5(){ if (enabled()) { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.08, i * 0.09)); } },
    victory(){ if (enabled()) { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.2, 'triangle', 0.07, i * 0.12)); } },
    rbd()    { if (enabled()) { tone(300, 1.0, 'sawtooth', 0.06, 0, 60); tone(150, 1.2, 'sine', 0.05, 0.1, 40); } },
  };
})();
