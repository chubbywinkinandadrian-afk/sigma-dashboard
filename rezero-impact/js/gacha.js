/* Re:Impact — gacha engine (Genshin-style pity: soft pity, hard pity, 50/50 guarantee). */
(function () {
  const RZ = (globalThis.RZ = globalThis.RZ || {});
  const D = () => RZ.DATA;

  // rng injectable for tests
  let rng = Math.random;

  function pityKey(banner) {
    return banner.type === 'limited' ? 'limited' : 'standard';
  }

  // Rolls one pull against the given banner using/mutating the pity state.
  // pity shape: { limited5, limited4, standard5, standard4, guarantee }
  function rollOne(banner, pity) {
    const G = D().GACHA;
    const key = pityKey(banner);
    pity[key + '5'] += 1;
    pity[key + '4'] += 1;

    const p5count = pity[key + '5'];
    let p5 = G.rate5;
    if (p5count >= G.softPityStart) p5 += (p5count - G.softPityStart + 1) * G.softPityStep;
    if (p5count >= G.hardPity5) p5 = 1;

    if (rng() < p5) {
      pity[key + '5'] = 0;
      return { rarity: 5, ...pick5(banner, pity) };
    }

    let p4 = G.rate4;
    if (pity[key + '4'] >= G.pity4) p4 = 1;
    if (rng() < p4) {
      pity[key + '4'] = 0;
      return { rarity: 4, type: 'char', id: pick4(banner) };
    }

    const w = D().WEAPONS[Math.floor(rng() * D().WEAPONS.length)];
    return { rarity: 3, type: 'weapon', id: w.id };
  }

  function pick5(banner, pity) {
    const G = D().GACHA;
    if (banner.type === 'limited') {
      const win = pity.guarantee || rng() < G.featured5Chance;
      if (win) {
        pity.guarantee = false;
        return { type: 'char', id: banner.featured5 };
      }
      pity.guarantee = true; // lost the 50/50 → next limited 5★ is featured
      return { type: 'char', id: G.standard5[Math.floor(rng() * G.standard5.length)] };
    }
    return { type: 'char', id: G.standard5[Math.floor(rng() * G.standard5.length)] };
  }

  function pick4(banner) {
    const G = D().GACHA;
    if (banner.type === 'limited' && banner.featured4 && rng() < G.featured4Chance) {
      return banner.featured4[Math.floor(rng() * banner.featured4.length)];
    }
    return G.pool4[Math.floor(rng() * G.pool4.length)];
  }

  RZ.Gacha = {
    setRng(fn) { rng = fn || Math.random; },
    pityKey,
    rollOne,
    costOf(n) { return D().GACHA.costSingle * n; },
    // Probability shown in the rates panel (informational)
    softPityInfo() {
      const G = D().GACHA;
      return { rate5: G.rate5, rate4: G.rate4, soft: G.softPityStart, hard: G.hardPity5, pity4: G.pity4 };
    },
  };
})();
