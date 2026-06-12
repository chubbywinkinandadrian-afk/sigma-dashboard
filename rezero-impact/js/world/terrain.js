/* Re:Impact World — procedural terrain, prop/structure placement, collision (pure math). */
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
    // occasional steep crags inland — these are climb territory
    const ridge = Math.max(0, fbm(x * 0.012 + 40, z * 0.012 + 40) - 0.66) * 130;
    if (ridge > 0 && roadDist(x, z) > 30) {
      let damp = 1;
      for (const s of Object.values(WD().STAGE_SPOTS)) {
        const d = Math.hypot(x - s.x, z - s.z);
        if (d < 60) damp = Math.min(damp, d / 60);
      }
      damp = Math.min(damp, Math.max(0.0, (ws[0].d - 80) / 160));
      h += ridge * damp;
    }
    // Priestella basin — sink terrain below the waterline around it
    const pr = WD().REGIONS.find((r) => r.id === 'priestella');
    const pd = Math.hypot(x - pr.anchor[0], z - pr.anchor[1]);
    if (pd < 320) h -= (1 - pd / 320) * 18;
    // a lake in the heartland for flavor
    const ld = Math.hypot(x + 100, z + 150);
    if (ld < 140) h -= (1 - ld / 140) * 12;
    // capital plaza: perfectly flat disc so pavers/fountain sit cleanly
    const cap = WD().REGIONS[0].anchor;
    const cd = Math.hypot(x - cap[0], z - cap[1]);
    if (cd < 90) {
      const t = smooth(Math.min(1, Math.max(0, (cd - 58) / 32)));
      h = 8 * (1 - t) + h * t;
    }
    // stage arenas flatten gently for fair fights
    for (const s of Object.values(WD().STAGE_SPOTS)) {
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < 30) {
        const t = smooth(d / 30);
        const base = heightRawAt(s);
        h = base * (1 - t) + h * t;
      }
    }
    // border mountains — steep enough that climbing matters
    const r = Math.max(Math.abs(x), Math.abs(z));
    if (r > W.edgeStart) {
      const t = Math.min(1, (r - W.edgeStart) / 170);
      h += t * t * t * 150 + fbm(x * 0.01, z * 0.01) * t * 30;
    }
    // roads grade gently toward the regional base height
    const rd = roadDist(x, z);
    if (rd < 16) {
      const t = (1 - rd / 16) * 0.5;
      h = h * (1 - t) + regionH * t;
    }
    return h;
  }

  // cached per-spot base heights (computed without the spot-flatten term)
  const spotBase = {};
  function heightRawAt(s) {
    const key = s.x + ',' + s.z;
    if (spotBase[key] != null) return spotBase[key];
    spotBase[key] = 0; // guard against recursion; then compute
    const ws = regionWeights(s.x, s.z);
    let regionH = 0;
    for (const o of ws) regionH += o.r.h * o.w;
    let h = fbm(s.x * 0.004 + 10, s.z * 0.004 + 10) * 22 + 3;
    const f = Math.max(0, 1 - ws[0].d / 240) * 0.85;
    h = h * (1 - f) + regionH * f;
    const pr = WD().REGIONS.find((r) => r.id === 'priestella');
    const pd = Math.hypot(s.x - pr.anchor[0], s.z - pr.anchor[1]);
    if (pd < 320) h -= (1 - pd / 320) * 18;
    spotBase[key] = h;
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
    if (h < W.waterY + 0.8) { r = 0.72; g = 0.66; b = 0.5; }
    if (roadDist(x, z) < 5.5) { r = 0.62; g = 0.54; b = 0.4; }
    // capital plaza stone
    const cap = WD().REGIONS[0].anchor;
    if (Math.hypot(x - cap[0], z - cap[1]) < 60) { r = 0.66; g = 0.62; b = 0.56; }
    if (h > 36) { const t = Math.min(1, (h - 36) / 30); r = r * (1 - t) + 0.5 * t; g = g * (1 - t) + 0.48 * t; b = b * (1 - t) + 0.5 * t; }
    if (h > 60) { r = 0.88; g = 0.9; b = 0.94; }
    const n = fbm(x * 0.05, z * 0.05) * 0.12 - 0.06;
    return [Math.max(0, Math.min(1, r + n)), Math.max(0, Math.min(1, g + n)), Math.max(0, Math.min(1, b + n))];
  }

  // ------------------------------------------------------------ shared placement
  // Trees/rocks placement — used by the renderer (instancing) AND collision.
  let propsCache = null;
  function props() {
    if (propsCache) return propsCache;
    const trees = [], rocks = [];
    for (let x = -1140; x <= 1140; x += 12) {
      for (let z = -1140; z <= 1140; z += 12) {
        const jx = x + (hash2(x, z) - 0.5) * 11;
        const jz = z + (hash2(z, x) - 0.5) * 11;
        const h = height(jx, jz);
        if (h < WD().WORLD.waterY + 0.6 || h > 42) continue;
        if (roadDist(jx, jz) < 9) continue;
        if (onPlatform(jx, jz)) continue;
        const region = regionAt(jx, jz);
        let blocked = false;
        for (const r of WD().REGIONS) {
          if (Math.hypot(jx - r.anchor[0], jz - r.anchor[1]) < (r.kind === 'forest' ? 14 : 62)) blocked = true;
        }
        for (const s of Object.values(WD().STAGE_SPOTS)) {
          if (Math.hypot(jx - s.x, jz - s.z) < 22) blocked = true;
        }
        for (const t of WD().TRIALS) {
          if (Math.hypot(jx - t.x, jz - t.z) < 18) blocked = true;
        }
        if (blocked) continue;
        const roll = hash2(jx * 7, jz * 7);
        if (roll < region.tree * 0.34) {
          const s = 0.7 + hash2(jx * 3, jz * 3) * 0.9;
          trees.push([jx, h, jz, s, region.kind]);
        } else if (roll > 0.985) {
          rocks.push([jx, h, jz, 0.5 + roll * 1.5]);
        }
      }
    }
    propsCache = { trees, rocks };
    return propsCache;
  }

  // Buildings & decor with positions shared between renderer and collision.
  // kinds: house (timber-frame), stall (market), bench, lamp, fountain, tree-big
  let structuresCache = null;
  function structures() {
    if (structuresCache) return structuresCache;
    const out = [];
    const cap = WD().REGIONS[0].anchor;
    // capital: ring of timber houses around the plaza
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.18;
      const rr = 64 + (i % 3) * 14;
      const x = cap[0] + Math.cos(a) * rr, z = cap[1] + Math.sin(a) * rr;
      out.push({ kind: 'house', x, z, s: 1.15 + (i % 3) * 0.3, ry: -a + Math.PI / 2, v: i % 4 });
    }
    // market stalls inside the plaza ring
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.55;
      out.push({ kind: 'stall', x: cap[0] + Math.cos(a) * 34, z: cap[1] + Math.sin(a) * 34, s: 1, ry: -a + Math.PI / 2, v: i % 3 });
    }
    // benches + lamps around the fountain
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      out.push({ kind: i % 2 ? 'bench' : 'lamp', x: cap[0] + Math.cos(a) * 18, z: cap[1] + Math.sin(a) * 18, s: 1, ry: -a });
    }
    out.push({ kind: 'fountain', x: cap[0], z: cap[1], s: 1, ry: 0 });
    out.push({ kind: 'xmastree', x: cap[0] + 26, z: cap[1] - 20, s: 1, ry: 0 });
    // gate posts on the south road out of the plaza
    out.push({ kind: 'gate', x: cap[0], z: cap[1] + 56, s: 1, ry: 0 });
    // manor village
    const man = WD().REGIONS[1].anchor;
    for (let i = 0; i < 6; i++) {
      out.push({ kind: 'house', x: man[0] - 36 + i * 13, z: man[1] + 26 + (i % 2) * 10, s: 0.85, ry: hash2(i, 7) * Math.PI, v: i % 4 });
    }
    // priestella houses on the bigger decks
    for (const p of WD().PLATFORMS.filter((pp) => pp.w > 40)) {
      out.push({ kind: 'house', x: p.x - p.w / 4, z: p.z + p.d / 4, s: 0.7, ry: 0.3, v: 1, yBase: p.y });
      out.push({ kind: 'house', x: p.x + p.w / 4, z: p.z - p.d / 4, s: 0.7, ry: -0.4, v: 2, yBase: p.y });
    }
    structuresCache = out;
    return structuresCache;
  }

  // ------------------------------------------------------------ collision
  // circles: [x, z, radius]; built once from props/structures/landmarks
  let gridCache = null;
  const CELL = 24;
  function collisionGrid() {
    if (gridCache) return gridCache;
    const circles = [];
    for (const t of props().trees) circles.push([t[0], t[2], 0.55 * t[3] + 0.25]);
    for (const r of props().rocks) circles.push([r[0], r[2], r[3] * 0.8]);
    for (const s of structures()) {
      if (s.kind === 'house') circles.push([s.x, s.z, 3.4 * s.s]);
      if (s.kind === 'stall') circles.push([s.x, s.z, 2.4]);
      if (s.kind === 'lamp') circles.push([s.x, s.z, 0.4]);
      if (s.kind === 'bench') circles.push([s.x, s.z, 0.9]);
      if (s.kind === 'fountain') circles.push([s.x, s.z, 7.5]);
      if (s.kind === 'xmastree') circles.push([s.x, s.z, 2.2]);
      if (s.kind === 'gate') { circles.push([s.x - 7, s.z, 1.6]); circles.push([s.x + 7, s.z, 1.6]); }
    }
    for (const r of WD().REGIONS) circles.push([r.anchor[0], r.anchor[1], 1.8]); // waypoint pedestals
    for (const t of WD().TRIALS) circles.push([t.x, t.z, 1.3]);                  // trial obelisks
    // mansion + tomb + flower tree trunk + cave mound
    const man = WD().REGIONS[1].anchor;
    circles.push([man[0], man[1] - 14, 9.5]);
    const tomb = WD().REGIONS[5].anchor;
    circles.push([tomb[0], tomb[1] - 16, 7]);
    const fl = WD().STAGE_SPOTS.c4s3;
    circles.push([fl.x, fl.z, 3.8]);
    const cave = WD().REGIONS[4].anchor;
    circles.push([cave[0], cave[1], 10.5]);

    const grid = new Map();
    circles.forEach((c, i) => {
      const cx = Math.floor(c[0] / CELL), cz = Math.floor(c[1] / CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const key = (cx + dx) + ',' + (cz + dz);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i);
      }
    });
    gridCache = { circles, grid };
    return gridCache;
  }

  // Pushes (x,z) out of any blocking circle; returns [x, z].
  function collide(x, z, radius) {
    const { circles, grid } = collisionGrid();
    const key = Math.floor(x / CELL) + ',' + Math.floor(z / CELL);
    const list = grid.get(key);
    if (!list) return [x, z];
    for (const i of list) {
      const c = circles[i];
      const dx = x - c[0], dz = z - c[1];
      const d = Math.hypot(dx, dz);
      const min = c[2] + radius;
      if (d < min && d > 0.0001) {
        x = c[0] + (dx / d) * min;
        z = c[1] + (dz / d) * min;
      } else if (d <= 0.0001) {
        x += min;
      }
    }
    return [x, z];
  }

  RZ.Terrain = {
    setSeed(s) { SEED = s; propsCache = null; structuresCache = null; gridCache = null; },
    height, groundHeight, onPlatform, colorAt, regionAt, regionWeights, roadDist,
    fbm, hash2, props, structures, collide,
  };
})();
