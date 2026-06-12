/* Re:Impact World — procedural terrain (pure math, renderer-agnostic). */
(function () {
  const RZ = (globalThis.RZ = globalThis.RZ || {});
  const WD = () => RZ.WDATA;

  let SEED = 1337;

  // deterministic 2D hash → [0,1)
  function hash2(ix, iz) {
    let h = (ix * 374761393 + iz * 668265263 + SEED * 2147483647) | 0;
    h = (h ^ (h >> 13)) | 0;
    h = Math.imul(h, 1274126177) | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  function smooth(t) { return t * t * (3 - 2 * t); }

  function valueNoise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = smooth(x - ix), fz = smooth(z - iz);
    const a = hash2(ix, iz), b = hash2(ix + 1, iz);
    const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }

  function fbm(x, z) {
    let v = 0, amp = 1, freq = 1, norm = 0;
    for (let o = 0; o < 4; o++) {
      v += valueNoise(x * freq, z * freq) * amp;
      norm += amp; amp *= 0.5; freq *= 2.1;
    }
    return v / norm; // [0,1]
  }

  function distToSegment(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + dx * t, qz = az + dz * t;
    return Math.hypot(px - qx, pz - qz);
  }

  function roadDist(x, z) {
    let best = 1e9;
    for (const road of WD().ROADS) {
      for (let i = 0; i < road.length - 1; i++) {
        const d = distToSegment(x, z, road[i][0], road[i][1], road[i + 1][0], road[i + 1][1]);
        if (d < best) best = d;
      }
    }
    return best;
  }

  // nearest region + inverse-distance weights for blending
  function regionWeights(x, z) {
    const out = [];
    let total = 0;
    for (const r of WD().REGIONS) {
      const d = Math.hypot(x - r.anchor[0], z - r.anchor[1]);
      const w = 1 / Math.pow(d + 60, 2.2);
      out.push({ r, d, w });
      total += w;
    }
    for (const o of out) o.w /= total;
    out.sort((a, b) => b.w - a.w);
    return out;
  }

  function regionAt(x, z) { return regionWeights(x, z)[0].r; }

  // raw terrain height (before platforms)
  function height(x, z) {
    const W = WD().WORLD;
    // base rolling hills — kept above the waterline; water is carved deliberately
    let h = fbm(x * 0.004 + 10, z * 0.004 + 10) * 22 + 3;
    // blend toward each region's base height near its anchor
    const ws = regionWeights(x, z);
    let regionH = 0;
    for (const o of ws) regionH += o.r.h * o.w;
    const f = Math.max(0, 1 - ws[0].d / 240) * 0.85;
    h = h * (1 - f) + regionH * f;
    // Priestella basin — sink terrain below the waterline around it
    const pr = WD().REGIONS.find((r) => r.id === 'priestella');
    const pd = Math.hypot(x - pr.anchor[0], z - pr.anchor[1]);
    if (pd < 320) h -= (1 - pd / 320) * 18;
    // a lake in the heartland for flavor
    const ld = Math.hypot(x + 100, z + 150);
    if (ld < 140) h -= (1 - ld / 140) * 12;
    // border mountains
    const r = Math.max(Math.abs(x), Math.abs(z));
    if (r > W.edgeStart) {
      const t = Math.min(1, (r - W.edgeStart) / 200);
      h += t * t * 90 + fbm(x * 0.01, z * 0.01) * t * 30;
    }
    // roads grade gently toward the regional base height
    const rd = roadDist(x, z);
    if (rd < 16) {
      const t = (1 - rd / 16) * 0.5;
      h = h * (1 - t) + regionH * t;
    }
    return h;
  }

  // walkable ground height: terrain or any platform underfoot
  function groundHeight(x, z) {
    let h = height(x, z);
    for (const p of WD().PLATFORMS) {
      if (Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2) {
        h = Math.max(h, p.y);
      }
    }
    return h;
  }

  function onPlatform(x, z) {
    for (const p of WD().PLATFORMS) {
      if (Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2) return p;
    }
    return null;
  }

  // terrain color (RGB 0..1) for mesh vertex colors and the minimap
  function colorAt(x, z) {
    const W = WD().WORLD;
    const h = height(x, z);
    if (h < W.waterY - 0.3) return [0.16, 0.30, 0.42];
    const ws = regionWeights(x, z);
    let r = 0, g = 0, b = 0;
    for (const o of ws) { r += o.r.tint[0] * o.w; g += o.r.tint[1] * o.w; b += o.r.tint[2] * o.w; }
    // beach near water
    if (h < W.waterY + 0.8) { r = 0.72; g = 0.66; b = 0.5; }
    // road dirt
    if (roadDist(x, z) < 5.5) { r = 0.62; g = 0.54; b = 0.4; }
    // mountain rock & caps
    if (h > 36) { const t = Math.min(1, (h - 36) / 30); r = r * (1 - t) + 0.5 * t; g = g * (1 - t) + 0.48 * t; b = b * (1 - t) + 0.5 * t; }
    if (h > 60) { r = 0.88; g = 0.9; b = 0.94; }
    // noise mottling
    const n = fbm(x * 0.05, z * 0.05) * 0.12 - 0.06;
    return [Math.max(0, Math.min(1, r + n)), Math.max(0, Math.min(1, g + n)), Math.max(0, Math.min(1, b + n))];
  }

  RZ.Terrain = { setSeed(s) { SEED = s; }, height, groundHeight, onPlatform, colorAt, regionAt, regionWeights, roadDist, fbm, hash2 };
})();
