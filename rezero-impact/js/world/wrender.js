/* Re:Impact World — Three.js render layer (terrain, props, actors, FX). */
(function () {
  const RZ = (globalThis.RZ = globalThis.RZ || {});
  const T = () => RZ.Terrain;
  const WDT = () => RZ.WDATA;

  let renderer, scene, camera, sun, hemi;
  let playerGroup, charMeshes = {};
  const enemyMeshes = new Map();   // actor -> group
  const boltMeshes = new Map();
  let beacon, waterMesh;
  const fxPool = [];               // expanding rings
  const dmgPool = [];              // floating numbers
  let minimapCanvas = null;
  let time = 0;

  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // ------------------------------------------------------------ init
  function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(window.innerWidth, window.innerHeight);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9db8d8);
    scene.fog = new THREE.Fog(0x9db8d8, 90, 460);
    camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1600);

    hemi = new THREE.HemisphereLight(0xcfe5ff, 0x5a6a50, 0.85);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff2d8, 0.9);
    sun.position.set(200, 300, 100);
    scene.add(sun);

    buildTerrain();
    buildWater();
    buildProps();
    buildLandmarks();
    buildBeacon();
    buildMinimap();
    window.addEventListener('resize', resize);
    return { scene, camera, renderer };
  }

  function resize() {
    if (!renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ------------------------------------------------------------ terrain & water
  function buildTerrain() {
    const SIZE = WDT().WORLD.size, SEG = 220;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, T().height(x, z));
      const c = T().colorAt(x, z);
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    scene.add(mesh);
  }

  function buildWater() {
    const geo = new THREE.PlaneGeometry(WDT().WORLD.size * 1.2, WDT().WORLD.size * 1.2);
    geo.rotateX(-Math.PI / 2);
    waterMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: 0x3f7fb8, transparent: true, opacity: 0.78,
    }));
    waterMesh.position.y = WDT().WORLD.waterY;
    scene.add(waterMesh);
  }

  // ------------------------------------------------------------ instanced props
  function buildProps() {
    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.5, 3.4, 5);
    const leafGeo = new THREE.ConeGeometry(2.6, 6.5, 6);
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const trunks = [], leaves = [], rocks = [];

    for (let x = -1140; x <= 1140; x += 12) {
      for (let z = -1140; z <= 1140; z += 12) {
        const jx = x + (T().hash2(x, z) - 0.5) * 11;
        const jz = z + (T().hash2(z, x) - 0.5) * 11;
        const h = T().height(jx, jz);
        if (h < WDT().WORLD.waterY + 0.6 || h > 42) continue;
        if (T().roadDist(jx, jz) < 9) continue;
        if (T().onPlatform(jx, jz)) continue;
        const region = T().regionAt(jx, jz);
        let nearAnchor = false;
        for (const r of WDT().REGIONS) {
          if (Math.hypot(jx - r.anchor[0], jz - r.anchor[1]) < (r.kind === 'forest' ? 0 : 46)) nearAnchor = true;
        }
        for (const s of Object.values(WDT().STAGE_SPOTS)) {
          if (Math.hypot(jx - s.x, jz - s.z) < 16) nearAnchor = true;
        }
        if (nearAnchor) continue;
        const roll = T().hash2(jx * 7, jz * 7);
        if (roll < region.tree * 0.34) {
          const s = 0.7 + T().hash2(jx * 3, jz * 3) * 0.9;
          trunks.push([jx, h, jz, s]);
          leaves.push([jx, h, jz, s, region.kind === 'snow' ? 0xdfe8ee : (region.kind === 'forest' ? 0x2e5d33 : 0x46793c)]);
        } else if (roll > 0.985) {
          rocks.push([jx, h, jz, 0.5 + roll * 1.5]);
        }
      }
    }
    const m = new THREE.Matrix4();
    const mkInst = (geo, color, list, yOff, vertical) => {
      const inst = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
      const col = new THREE.Color();
      list.forEach((it, i) => {
        const s = it[3];
        m.makeScale(s, s, s);
        m.setPosition(it[0], it[1] + yOff * s, it[2]);
        inst.setMatrixAt(i, m);
        inst.setColorAt(i, col.set(it[4] || color));
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      scene.add(inst);
    };
    mkInst(trunkGeo, 0x6b4a32, trunks, 1.6);
    mkInst(leafGeo, 0x3a6b3f, leaves, 6.2);
    mkInst(rockGeo, 0x8a8a90, rocks, 0.4);
  }

  // ------------------------------------------------------------ landmarks
  function box(w, h, d, color, x, y, z, ry) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    b.position.set(x, y, z);
    if (ry) b.rotation.y = ry;
    return b;
  }

  function house(g, x, z, s, wallC, roofC) {
    const h = T().groundHeight(x, z);
    const ry = T().hash2(x, z) * Math.PI;
    g.add(box(4 * s, 3 * s, 4 * s, wallC, x, h + 1.5 * s, z, ry));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4 * s, 2.2 * s, 4), new THREE.MeshLambertMaterial({ color: roofC }));
    roof.position.set(x, h + 3 * s + 1.1 * s, z);
    roof.rotation.y = ry + Math.PI / 4;
    g.add(roof);
  }

  function waypointStatue(g, x, z) {
    const h = T().groundHeight(x, z);
    g.add(box(2.6, 0.8, 2.6, 0x9aa4b8, x, h + 0.4, z));
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.9),
      new THREE.MeshLambertMaterial({ color: 0x6fe8e8, emissive: 0x2da8b8 }));
    crystal.position.set(x, h + 2.4, z);
    crystal.userData.spin = true;
    g.add(crystal);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 26, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7fe8e8, transparent: true, opacity: 0.16, depthWrite: false }));
    shaft.position.set(x, h + 13, z);
    g.add(shaft);
  }

  function arenaStones(g, x, z, r) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r;
      g.add(box(1.2, 2.6 + (i % 3), 1.2, 0x7d8290, sx, T().groundHeight(sx, sz) + 1.3, sz, a));
    }
  }

  function buildLandmarks() {
    const g = new THREE.Group();
    for (const r of WDT().REGIONS) waypointStatue(g, r.anchor[0], r.anchor[1]);

    // capital: gate + wall + houses
    {
      const [ax, az] = WDT().REGIONS[0].anchor;
      g.add(box(3, 9, 3, 0xb0a890, ax - 9, T().groundHeight(ax - 9, az + 24) + 4.5, az + 24));
      g.add(box(3, 9, 3, 0xb0a890, ax + 9, T().groundHeight(ax + 9, az + 24) + 4.5, az + 24));
      g.add(box(21, 2.4, 3, 0xb0a890, ax, T().groundHeight(ax, az + 24) + 9, az + 24));
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        house(g, ax + Math.cos(a) * (16 + (i % 4) * 9), az + Math.sin(a) * (15 + (i % 3) * 8), 0.9 + (i % 3) * 0.25, i % 2 ? 0xcfc4a8 : 0xbfae92, 0x9a5838);
      }
    }
    // manor + village
    {
      const [ax, az] = WDT().REGIONS[1].anchor;
      const h = T().groundHeight(ax, az - 14);
      g.add(box(16, 7, 8, 0xd8d0c0, ax, h + 3.5, az - 14));
      g.add(box(5, 9, 7, 0xcabfa8, ax - 9, h + 4.5, az - 14));
      g.add(box(5, 9, 7, 0xcabfa8, ax + 9, h + 4.5, az - 14));
      const roof = new THREE.Mesh(new THREE.BoxGeometry(17, 1.4, 9), new THREE.MeshLambertMaterial({ color: 0x3d5d8a }));
      roof.position.set(ax, h + 7.7, az - 14); g.add(roof);
      for (let i = 0; i < 6; i++) house(g, ax - 36 + i * 13, az + 26 + (i % 2) * 10, 0.8, 0xc8b896, 0x8a6a48);
    }
    // great flower tree (whale arena)
    {
      const s = WDT().STAGE_SPOTS.c4s3;
      const h = T().groundHeight(s.x, s.z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, 22, 8), new THREE.MeshLambertMaterial({ color: 0x77573e }));
      trunk.position.set(s.x, h + 11, s.z); g.add(trunk);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(13, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8a8c8 }));
      canopy.position.set(s.x, h + 26, s.z); g.add(canopy);
      arenaStones(g, s.x, s.z, 17);
    }
    // cult cave
    {
      const [ax, az] = WDT().REGIONS[4].anchor;
      const mound = new THREE.Mesh(new THREE.DodecahedronGeometry(11, 0), new THREE.MeshLambertMaterial({ color: 0x5a5a58 }));
      mound.position.set(ax, T().groundHeight(ax, az) + 4, az);
      mound.scale.y = 0.7; g.add(mound);
      g.add(box(5, 6, 2, 0x141218, ax, T().groundHeight(ax, az) + 2.4, az + 9.5));
      arenaStones(g, WDT().STAGE_SPOTS.c5s3.x, WDT().STAGE_SPOTS.c5s3.z, 14);
    }
    // sanctuary tomb
    {
      const [ax, az] = WDT().REGIONS[5].anchor;
      const h = T().groundHeight(ax, az - 16);
      g.add(box(12, 5, 9, 0xb8c2cc, ax, h + 2.5, az - 16));
      for (let i = -1; i <= 1; i += 2) g.add(box(1.4, 7, 1.4, 0xc8d2dc, ax + i * 7, h + 3.5, az - 10));
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), new THREE.MeshLambertMaterial({ color: 0xbfe8ff, emissive: 0x3a6a8a }));
      cr.position.set(ax, h + 7.4, az - 16); cr.userData.spin = true; g.add(cr);
      arenaStones(g, WDT().STAGE_SPOTS.c6s4.x, WDT().STAGE_SPOTS.c6s4.z, 15);
    }
    // priestella decks
    {
      for (const p of WDT().PLATFORMS) {
        g.add(box(p.w, 1.2, p.d, 0x8a7a5e, p.x, p.y - 0.6, p.z));
        // lamp posts at corners
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const lx = p.x + sx * (p.w / 2 - 1), lz = p.z + sz * (p.d / 2 - 1);
          g.add(box(0.25, 3, 0.25, 0x4a4540, lx, p.y + 1.5, lz));
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6),
            new THREE.MeshLambertMaterial({ color: 0xffe8a8, emissive: 0xcc9a40 }));
          lamp.position.set(lx, p.y + 3.1, lz); g.add(lamp);
        }
      }
      // houses on the bigger decks
      for (const p of WDT().PLATFORMS.filter((pp) => pp.w > 40)) {
        house(g, p.x - p.w / 4, p.z + p.d / 4, 0.75, 0xd8e0e8, 0x4a6a9a);
        house(g, p.x + p.w / 4, p.z - p.d / 4, 0.75, 0xc8d4e0, 0x3d5d8a);
      }
    }
    // misc boss arenas
    arenaStones(g, WDT().STAGE_SPOTS.c1s4.x, WDT().STAGE_SPOTS.c1s4.z, 12);
    arenaStones(g, WDT().STAGE_SPOTS.c2s4.x, WDT().STAGE_SPOTS.c2s4.z, 13);
    scene.add(g);
    g.traverse((o) => { if (o.userData.spin) spinners.push(o); });
  }
  const spinners = [];

  function buildBeacon() {
    beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 80, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd97a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })
    );
    scene.add(beacon);
  }

  // ------------------------------------------------------------ minimap (pre-rendered terrain)
  function buildMinimap() {
    minimapCanvas = document.createElement('canvas');
    minimapCanvas.width = 200; minimapCanvas.height = 200;
    const ctx = minimapCanvas.getContext('2d');
    const img = ctx.createImageData(200, 200);
    const S = WDT().WORLD.size;
    for (let py = 0; py < 200; py++) {
      for (let px = 0; px < 200; px++) {
        const x = (px / 200 - 0.5) * S, z = (py / 200 - 0.5) * S;
        const c = T().colorAt(x, z);
        const i = (py * 200 + px) * 4;
        img.data[i] = c[0] * 255; img.data[i + 1] = c[1] * 255; img.data[i + 2] = c[2] * 255; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ------------------------------------------------------------ characters (low-poly chibi rigs)
  function buildChibi(id) {
    const [bodyC, hairC, weapon] = WDT().LOOKS[id] || ['#888', '#aaa', 'sword'];
    const g = new THREE.Group();
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 1.1, 8), mat(bodyC));
    body.position.y = 1.0; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mat(0xf0d8c0));
    head.position.y = 1.95; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(hairC));
    hair.position.y = 2.02; g.add(hair);
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.8, 6), mat(0x33333a));
    legL.position.set(0.2, 0.4, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = -0.2; g.add(legR);
    const arm = new THREE.Group();
    arm.position.set(0.5, 1.45, 0);
    let weap;
    if (weapon === 'staff') {
      weap = new THREE.Group();
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), mat(0x6a5238));
      rod.position.y = -0.3; weap.add(rod);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8),
        new THREE.MeshLambertMaterial({ color: hairC, emissive: new THREE.Color(hairC).multiplyScalar(0.5) }));
      orb.position.y = 0.55; weap.add(orb);
    } else if (weapon === 'flail') {
      weap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), mat(0x778));
      weap.position.y = 0.5;
    } else if (weapon === 'knife') {
      weap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.16), mat(0xc8ccd4));
      weap.position.y = 0.35;
    } else if (weapon === 'claw' || weapon === 'fist') {
      weap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), mat(hairC));
      weap.position.y = 0.2;
    } else { // sword
      weap = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.2), mat(0xd0d4dc));
      blade.position.y = 0.6; weap.add(blade);
      const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), mat(0xb09040));
      hilt.position.y = 0.05; weap.add(hilt);
    }
    arm.add(weap);
    g.add(arm);
    g.userData = { arm, legL, legR };
    return g;
  }

  function syncParty(W) {
    if (!playerGroup) { playerGroup = new THREE.Group(); scene.add(playerGroup); }
    const active = RZ.World.activeId(W);
    for (const id of W.partyIds) {
      if (!charMeshes[id]) { charMeshes[id] = buildChibi(id); playerGroup.add(charMeshes[id]); }
    }
    for (const [id, mesh] of Object.entries(charMeshes)) mesh.visible = id === active;
  }

  // ------------------------------------------------------------ enemies
  function buildEnemyMesh(e) {
    const [arch, colorHex] = WDT().ENEMY_LOOKS[e.key] || ['humanoid', '#777'];
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: colorHex });
    g.userData.mat = mat;
    g.userData.baseEmissive = new THREE.Color(0x000000);
    if (arch === 'beast') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 2.4), mat);
      body.position.y = 0.9; g.add(body);
      const headM = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), mat);
      headM.position.set(0, 1.25, 1.4); g.add(headM);
      for (const sx of [-0.5, 0.5]) for (const sz of [-0.8, 0.8]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 5), mat);
        leg.position.set(sx, 0.45, sz); g.add(leg);
      }
    } else if (arch === 'wraith') {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.4, 7),
        new THREE.MeshLambertMaterial({ color: colorHex, transparent: true, opacity: 0.82 }));
      cone.position.y = 1.6; g.add(cone);
      g.userData.hover = true;
    } else if (arch === 'whale') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), mat);
      body.scale.set(1.2, 0.85, 2.2); body.position.y = 1.8; g.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 6), mat);
      tail.rotation.x = Math.PI / 2; tail.position.set(0, 1.8, -4); g.add(tail);
      g.userData.hover = true;
    } else { // humanoid
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 1.2, 7), mat);
      body.position.y = 1.05; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 7), mat);
      head.position.y = 2.0; g.add(head);
    }
    g.scale.setScalar(e.size);
    // hp bar sprites
    const barBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x201418, depthTest: false }));
    barBg.scale.set(2.2, 0.22, 1); barBg.position.y = e.size * 2.6 + 0.6;
    const barFg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x6fd46f, depthTest: false }));
    barFg.scale.set(2.1, 0.14, 1); barFg.position.y = e.size * 2.6 + 0.6;
    g.add(barBg); g.add(barFg);
    g.userData.barFg = barFg; g.userData.barBg = barBg;
    // aura ring
    const aura = new THREE.Mesh(new THREE.RingGeometry(e.size * 0.9, e.size * 1.15, 18),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    aura.rotation.x = -Math.PI / 2; aura.position.y = 0.12; aura.visible = false;
    g.add(aura); g.userData.aura = aura;
    // slam telegraph ring
    const tel = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24),
      new THREE.MeshBasicMaterial({ color: 0xff4030, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    tel.rotation.x = -Math.PI / 2; tel.visible = false;
    scene.add(tel);
    g.userData.tel = tel;
    scene.add(g);
    return g;
  }

  // ------------------------------------------------------------ FX pools
  function spawnRing(x, y, z, colorHex, maxR) {
    let fx = fxPool.find((f) => !f.active);
    if (!fx) {
      fx = {
        mesh: new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 28),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false })),
        active: false, t: 0, maxR: 6,
      };
      fx.mesh.rotation.x = Math.PI / 2;
      scene.add(fx.mesh);
      fxPool.push(fx);
    }
    fx.active = true; fx.t = 0; fx.maxR = maxR || 6;
    fx.mesh.visible = true;
    fx.mesh.material.color.set(colorHex);
    fx.mesh.material.opacity = 0.9;
    fx.mesh.position.set(x, y + 0.5, z);
    fx.mesh.scale.setScalar(0.3);
  }

  function mkDmgSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 192; canvas.height = 80;
    const tex = new THREE.CanvasTexture(canvas);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(4.6, 1.9, 1);
    scene.add(sp);
    return { sp, canvas, tex, active: false, t: 0 };
  }

  function spawnDmg(x, y, z, text, color, big) {
    let d = dmgPool.find((p) => !p.active);
    if (!d) { if (dmgPool.length > 36) return; d = mkDmgSprite(); dmgPool.push(d); }
    const ctx = d.canvas.getContext('2d');
    ctx.clearRect(0, 0, 192, 80);
    ctx.font = `bold ${big ? 44 : 33}px Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(10,8,4,0.9)'; ctx.lineWidth = 6;
    ctx.strokeText(text, 96, 40);
    ctx.fillStyle = color;
    ctx.fillText(text, 96, 40);
    d.tex.needsUpdate = true;
    d.active = true; d.t = 0;
    d.sp.visible = true;
    d.sp.material.opacity = 1;
    d.sp.position.set(x + (Math.random() - 0.5) * 1.2, y, z);
  }

  const ELEMENT_HEX = { fire: 0xe25c4a, water: 0x5db6e8, wind: 0x3ecf9a, earth: 0xc9913d, yin: 0x9b6bd4, yang: 0xf0c33c };

  function handleEvents(W, events) {
    for (const e of events) {
      switch (e.t) {
        case 'dmg':
          spawnDmg(e.x, e.y, e.z,
            (e.crit ? '✦' : '') + e.amount + (e.rx ? ' ' + e.rx : ''),
            e.side === 'player' ? '#ff8a7a' : (e.rx ? '#ffd97a' : (e.crit ? '#ffe8a0' : '#fff')),
            e.crit || !!e.rx);
          break;
        case 'heal': spawnDmg(e.x, e.y, e.z, '+' + e.amount, '#8ee0a0'); break;
        case 'dodged': spawnDmg(e.x, e.y, e.z, 'dodged!', '#bfd4ff'); break;
        case 'skill-fx': spawnRing(e.x, e.y, e.z, ELEMENT_HEX[e.element] || 0xffffff, 7); break;
        case 'burst-fx': spawnRing(e.x, e.y, e.z, ELEMENT_HEX[e.element] || 0xffffff, 11); break;
        case 'breather': spawnDmg(e.e.x, e.e.y + 4, e.e.z, '...haah... haah...', '#ffd97a', true); break;
        default: break;
      }
    }
  }

  // ------------------------------------------------------------ per-frame update
  function update(W, dt, cam) {
    time += dt;
    const p = W.player;

    // player rig
    syncParty(W);
    playerGroup.position.set(p.x, p.y, p.z);
    playerGroup.rotation.y = p.yaw;
    const active = charMeshes[RZ.World.activeId(W)];
    if (active) {
      const ud = active.userData;
      const walk = Math.sin(time * 10) * (W._moving ? 0.6 : 0);
      ud.legL.rotation.x = walk; ud.legR.rotation.x = -walk;
      if (p.swing) {
        const k = p.swing.t / p.swing.dur;
        ud.arm.rotation.x = -2.2 * Math.sin(k * Math.PI);
      } else ud.arm.rotation.x = Math.sin(time * 2) * 0.08;
      active.rotation.z = p.dodgeT > 0 ? Math.sin(time * 30) * 0.18 : 0;
    }

    // enemies
    const seen = new Set();
    for (const e of W.enemies) {
      seen.add(e);
      let g = enemyMeshes.get(e);
      if (!g) { g = buildEnemyMesh(e); enemyMeshes.set(e, g); }
      g.position.set(e.x, e.y + (g.userData.hover ? 0.6 + Math.sin(time * 2 + e.x) * 0.3 : 0), e.z);
      g.rotation.y = e.yaw;
      if (e.dead) {
        g.scale.setScalar(Math.max(0.01, e.size * e.deathT));
        g.userData.tel.visible = false;
        continue;
      }
      // hp bar
      const frac = Math.max(0, e.hp / e.maxhp);
      g.userData.barFg.scale.x = 2.1 * frac;
      g.userData.barFg.position.x = -(1 - frac) * 1.05;
      const showBar = e.aggro || frac < 1;
      g.userData.barFg.visible = showBar; g.userData.barBg.visible = showBar;
      // aura ring
      if (e.aura) {
        g.userData.aura.visible = true;
        g.userData.aura.material.color.set(ELEMENT_HEX[e.aura] || 0xffffff);
        g.userData.aura.rotation.z = time * 1.5;
      } else g.userData.aura.visible = false;
      // telegraphs
      const mat = g.userData.mat;
      if (e.telegraph && e.telegraph.type === 'melee') {
        const k = e.telegraph.t / e.telegraph.dur;
        mat.emissive = new THREE.Color(0xff2010).multiplyScalar(0.25 + k * 0.55);
      } else if (e.breather) {
        mat.emissive = new THREE.Color(0xffd040).multiplyScalar(0.4 + Math.sin(time * 8) * 0.2);
      } else {
        mat.emissive = g.userData.baseEmissive;
      }
      const tel = g.userData.tel;
      if (e.telegraph && e.telegraph.type === 'slam') {
        tel.visible = true;
        tel.position.set(e.x, e.y + 0.15, e.z);
        const k = e.telegraph.t / e.telegraph.dur;
        tel.scale.setScalar(e.telegraph.r * (0.3 + 0.7 * k));
        tel.material.opacity = 0.35 + k * 0.4;
      } else tel.visible = false;
    }
    // prune meshes for removed actors
    for (const [actor, g] of enemyMeshes) {
      if (!seen.has(actor)) {
        scene.remove(g);
        scene.remove(g.userData.tel);
        enemyMeshes.delete(actor);
      }
    }

    // bolts
    const seenB = new Set();
    for (const b of W.bolts) {
      seenB.add(b);
      let m = boltMeshes.get(b);
      if (!m) {
        m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6),
          new THREE.MeshBasicMaterial({ color: ELEMENT_HEX[b.element] || 0xfff0c0 }));
        scene.add(m); boltMeshes.set(b, m);
      }
      m.position.set(b.x, b.y, b.z);
    }
    for (const [b, m] of boltMeshes) {
      if (!seenB.has(b)) { scene.remove(m); boltMeshes.delete(b); }
    }

    // beacon at quest spot
    if (W.quest) {
      beacon.visible = true;
      beacon.position.set(W.quest.spot.x, T().groundHeight(W.quest.spot.x, W.quest.spot.z) + 38, W.quest.spot.z);
      beacon.material.opacity = 0.22 + Math.sin(time * 2.4) * 0.1;
    } else beacon.visible = false;

    // fx rings
    for (const fx of fxPool) {
      if (!fx.active) continue;
      fx.t += dt * 2.2;
      if (fx.t >= 1) { fx.active = false; fx.mesh.visible = false; continue; }
      fx.mesh.scale.setScalar(0.3 + fx.t * fx.maxR);
      fx.mesh.material.opacity = 0.9 * (1 - fx.t);
    }
    // damage numbers
    for (const d of dmgPool) {
      if (!d.active) continue;
      d.t += dt;
      if (d.t > 1.1) { d.active = false; d.sp.visible = false; continue; }
      d.sp.position.y += dt * 2.4;
      d.sp.material.opacity = 1 - d.t / 1.1;
    }
    // spinning crystals + gentle day cycle
    for (const s of spinners) s.rotation.y = time * 1.2;
    const dayK = (Math.sin(time * 0.012) + 1) / 2; // 0 night .. 1 day (slow)
    const duskK = 0.45 + dayK * 0.55;
    sun.intensity = 0.25 + dayK * 0.75;
    hemi.intensity = 0.45 + dayK * 0.45;
    sun.position.set(Math.cos(time * 0.012) * 300, 140 + dayK * 220, Math.sin(time * 0.012) * 300);
    scene.background.setRGB(0.62 * duskK, 0.72 * duskK, 0.85 * duskK);
    scene.fog.color.copy(scene.background);

    // camera
    camera.position.set(cam.x, cam.y, cam.z);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    renderer.render(scene, camera);
  }

  RZ.WRender = {
    init, update, handleEvents, resize,
    get minimap() { return minimapCanvas; },
  };
})();
