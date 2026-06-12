/* Re:Impact World — Three.js render layer.
   Cel-shaded original chibi rigs, festival capital plaza, NPCs, snow, bloom. */
(function () {
  const RZ = (globalThis.RZ = globalThis.RZ || {});
  const T = () => RZ.Terrain;
  const WDT = () => RZ.WDATA;

  let renderer, composer, scene, camera, sun, hemi, amb;
  let playerGroup, charMeshes = {};
  const enemyMeshes = new Map();
  const boltMeshes = new Map();
  const zoneMeshes = new Map();
  let beacon, waterMesh, snowPts, snowVel, clouds = [];
  const fxPool = [], dmgPool = [], spinners = [], twinkles = [], jets = [], npcs = [];
  let fountainWater = [];
  let minimapCanvas = null;
  let time = 0;
  let gradientMap = null;
  let outfitMode = 'winter'; // 'winter' | 'classic'

  const ELEMENT_HEX = { fire: 0xe25c4a, water: 0x5db6e8, wind: 0x3ecf9a, earth: 0xc9913d, yin: 0x9b6bd4, yang: 0xf0c33c };

  // ------------------------------------------------------------ materials
  function toonGradient() {
    if (gradientMap) return gradientMap;
    const data = new Uint8Array([90, 90, 90, 150, 150, 150, 215, 215, 215, 255, 255, 255]);
    gradientMap = new THREE.DataTexture(data, 4, 1, THREE.RGBFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
    return gradientMap;
  }
  function toon(color, opts) {
    return new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: toonGradient() }, opts || {}));
  }
  const OUTLINE_MAT = () => new THREE.MeshBasicMaterial({ color: 0x1a1318, side: THREE.BackSide });
  function outline(mesh, thickness) {
    const o = new THREE.Mesh(mesh.geometry, OUTLINE_MAT());
    o.scale.setScalar(1 + (thickness || 0.06));
    mesh.add(o);
    return mesh;
  }

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  // ------------------------------------------------------------ init
  function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xc4d4ec, 110, 520);
    camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 2400);

    hemi = new THREE.HemisphereLight(0xd8e8ff, 0x6a6a58, 0.75);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffe8c8, 1.05);
    sun.position.set(220, 280, 120);
    scene.add(sun);
    amb = new THREE.AmbientLight(0xffd8b8, 0.18);
    scene.add(amb);

    buildSky();
    buildTerrain();
    buildWater();
    buildSnow();
    buildProps();
    buildStructures();
    buildLandmarks();
    buildBeacon();
    buildMinimap();
    buildNpcs();

    if (THREE.EffectComposer && THREE.UnrealBloomPass) {
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, camera));
      const bloom = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.5, 0.85);
      composer.addPass(bloom);
      if (THREE.GammaCorrectionShader) {
        // composer output skips renderer.outputEncoding in r128 — correct manually
        composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
      }
    }
    window.addEventListener('resize', resize);
    return { scene, camera, renderer };
  }

  function resize() {
    if (!renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  }

  // ------------------------------------------------------------ sky / weather
  function buildSky() {
    const tex = canvasTex(16, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0.0, '#3f6fb8');
      g.addColorStop(0.45, '#7fa8dc');
      g.addColorStop(0.72, '#d8c8e8');
      g.addColorStop(0.88, '#f8d8b0');
      g.addColorStop(1.0, '#ffe8c8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1900, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
    );
    scene.add(sky);
    // big soft sun disc
    const sunTex = canvasTex(256, 256, (ctx) => {
      const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,244,214,1)');
      g.addColorStop(0.25, 'rgba(255,224,168,0.85)');
      g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    });
    const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false }));
    sunSpr.scale.set(560, 560, 1);
    sunSpr.position.set(900, 620, 500);
    scene.add(sunSpr);
    // drifting clouds
    const cloudTex = canvasTex(256, 128, (ctx) => {
      ctx.fillStyle = 'rgba(255,255,255,0)'; ctx.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 14; i++) {
        const g = ctx.createRadialGradient(40 + Math.random() * 176, 50 + Math.random() * 30, 4, 128, 64, 110);
        g.addColorStop(0, 'rgba(255,255,255,0.85)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128);
      }
    });
    for (let i = 0; i < 12; i++) {
      const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, opacity: 0.85 }));
      const s = 240 + Math.random() * 360;
      c.scale.set(s, s * 0.4, 1);
      c.position.set((Math.random() - 0.5) * 2600, 380 + Math.random() * 240, (Math.random() - 0.5) * 2600);
      c.userData.drift = 1.5 + Math.random() * 2;
      scene.add(c);
      clouds.push(c);
    }
  }

  function buildSnow() {
    const N = 1400;
    const pos = new Float32Array(N * 3);
    snowVel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 180;
      pos[i * 3 + 1] = Math.random() * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 180;
      snowVel[i] = 1.6 + Math.random() * 2.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dot = canvasTex(32, 32, (ctx) => {
      const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
    });
    snowPts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.5, map: dot, transparent: true, depthWrite: false, opacity: 0.9,
    }));
    scene.add(snowPts);
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
    scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));

    // cobblestone plaza disc (terrain is flattened to h=8 here)
    const cap = WDT().REGIONS[0].anchor;
    const cobble = canvasTex(256, 256, (ctx) => {
      ctx.fillStyle = '#9a948a'; ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const off = (y % 2) * 16;
          const tone = 138 + ((x * 7 + y * 13) % 5) * 14;
          ctx.fillStyle = `rgb(${tone},${tone - 6},${tone - 14})`;
          ctx.beginPath();
          ctx.ellipse(x * 32 + 16 + off, y * 32 + 16, 14, 12, 0, 0, 7);
          ctx.fill();
        }
      }
    });
    cobble.wrapS = cobble.wrapT = THREE.RepeatWrapping;
    cobble.repeat.set(16, 16);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(58, 48),
      new THREE.MeshLambertMaterial({ map: cobble }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(cap[0], 8.04, cap[1]);
    scene.add(disc);
  }

  function buildWater() {
    const geo = new THREE.PlaneGeometry(WDT().WORLD.size * 1.2, WDT().WORLD.size * 1.2, 40, 40);
    geo.rotateX(-Math.PI / 2);
    waterMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: 0x4f93c8, transparent: true, opacity: 0.8,
    }));
    waterMesh.position.y = WDT().WORLD.waterY;
    scene.add(waterMesh);
  }

  // ------------------------------------------------------------ instanced props
  function buildProps() {
    const { trees, rocks } = T().props();
    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.5, 3.4, 5);
    const leafGeo = new THREE.ConeGeometry(2.6, 6.5, 6);
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    const mkInst = (geo, list, yOff, colorOf) => {
      const inst = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
      list.forEach((it, i) => {
        const s = it[3];
        m.makeScale(s, s, s);
        m.setPosition(it[0], it[1] + yOff * s, it[2]);
        inst.setMatrixAt(i, m);
        inst.setColorAt(i, col.set(colorOf(it)));
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      scene.add(inst);
    };
    mkInst(trunkGeo, trees, 1.6, () => 0x6b4a32);
    mkInst(leafGeo, trees, 6.2, (t) => (t[4] === 'snow' ? 0xe4ecf2 : (t[4] === 'forest' ? 0x2e5d33 : 0x4a7c40)));
    // snow caps on every canopy for the festival season
    const capGeo = new THREE.ConeGeometry(1.6, 2.2, 6);
    mkInst(capGeo, trees, 8.6, () => 0xf4f8fc);
    mkInst(rockGeo, rocks, 0.4, () => 0x8a8a90);
  }

  // ------------------------------------------------------------ structures (shared with collision)
  function box(w, h, d, color, x, y, z, ry, mat) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || new THREE.MeshLambertMaterial({ color }));
    b.position.set(x, y, z);
    if (ry) b.rotation.y = ry;
    return b;
  }

  const PLASTERS = [0xe8dcc0, 0xd8c8a8, 0xc8b8a0, 0xe0d0b8];
  function timberHouse(g, s) {
    const grp = new THREE.Group();
    const yB = s.yBase != null ? s.yBase : T().groundHeight(s.x, s.z);
    const sc = s.s;
    const W = 6.4 * sc, H = 5.6 * sc, D = 6.0 * sc;
    const plaster = PLASTERS[s.v % PLASTERS.length];
    grp.add(box(W, H, D, plaster, 0, H / 2, 0));
    // dark timber frame: corner posts, sills, X braces
    const dark = new THREE.MeshLambertMaterial({ color: 0x4a3626 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      grp.add(box(0.3, H, 0.3, 0, sx * (W / 2 - 0.12), H / 2, sz * (D / 2 - 0.12), 0, dark));
    }
    grp.add(box(W + 0.06, 0.28, D + 0.06, 0, 0, H * 0.52, 0, 0, dark));
    for (const sz of [-1, 1]) {
      const b1 = box(0.22, H * 0.6, 0.22, 0, 0, H * 0.26, sz * (D / 2 + 0.02), 0, dark);
      b1.rotation.z = 0.7; grp.add(b1);
      const b2 = box(0.22, H * 0.6, 0.22, 0, 0, H * 0.26, sz * (D / 2 + 0.02), 0, dark);
      b2.rotation.z = -0.7; grp.add(b2);
    }
    // roof: squashed pyramid with overhang
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(W, D) * 0.82, H * 0.55, 4),
      new THREE.MeshLambertMaterial({ color: [0xa84a32, 0xb85a3a, 0x8a4a3a, 0xa85a2e][s.v % 4] }));
    roof.position.y = H + H * 0.27;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = D / Math.max(W, D);
    grp.add(roof);
    // arched windows (warm emissive) + door
    const winMat = new THREE.MeshLambertMaterial({ color: 0xffe2a8, emissive: 0x8a5a20 });
    for (const sx of [-1, 1]) {
      for (let wy = 0; wy < 2; wy++) {
        const win = new THREE.Group();
        win.add(box(0.9, 1.1, 0.1, 0, 0, 0, 0, 0, winMat));
        const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 10, 1, false, 0, Math.PI), winMat);
        arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2;
        arch.position.y = 0.55;
        win.add(arch);
        win.position.set(sx * W * 0.22, H * 0.34 + wy * H * 0.36, D / 2 + 0.06);
        grp.add(win);
      }
    }
    grp.add(box(1.3, 2.2, 0.16, 0x5a3a26, 0, 1.1, D / 2 + 0.08));
    // festival wreath over the door
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.14, 6, 12), toon(0x2e6b46));
    wreath.position.set(0, 2.9, D / 2 + 0.14);
    grp.add(wreath);
    const bow = box(0.3, 0.2, 0.1, 0xb83232, 0, 2.45, D / 2 + 0.16);
    grp.add(bow);
    grp.position.set(s.x, yB, s.z);
    grp.rotation.y = s.ry || 0;
    g.add(grp);
  }

  function marketStall(g, s) {
    const grp = new THREE.Group();
    const yB = T().groundHeight(s.x, s.z);
    grp.add(box(3.6, 1.1, 1.6, 0x7a5a3e, 0, 0.55, 0));
    const wood = new THREE.MeshLambertMaterial({ color: 0x5a4630 });
    for (const sx of [-1.6, 1.6]) for (const sz of [-0.6, 0.6]) {
      grp.add(box(0.16, 2.6, 0.16, 0, sx, 1.3, sz, 0, wood));
    }
    const colors = [['#c03838', '#f0e8d8'], ['#2e6b46', '#f0e8d8'], ['#3a5a8a', '#f0e8d8']][s.v % 3];
    const awnTex = canvasTex(64, 32, (ctx) => {
      for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? colors[0] : colors[1]; ctx.fillRect(i * 8, 0, 8, 32); }
    });
    const awn = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 2.4),
      new THREE.MeshLambertMaterial({ map: awnTex }));
    awn.position.set(0, 2.7, 0.2);
    awn.rotation.x = -0.18;
    grp.add(awn);
    // goods: little crates and appas
    for (let i = 0; i < 3; i++) grp.add(box(0.5, 0.4, 0.5, 0x8a6a42, -1 + i, 1.3, 0));
    for (let i = 0; i < 4; i++) {
      const ap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), toon(0xc83a32));
      ap.position.set(-0.5 + i * 0.34, 1.6, 0.3);
      grp.add(ap);
    }
    grp.position.set(s.x, yB, s.z);
    grp.rotation.y = s.ry || 0;
    g.add(grp);
  }

  function lampPost(g, s) {
    const grp = new THREE.Group();
    const yB = T().groundHeight(s.x, s.z);
    grp.add(box(0.18, 3.4, 0.18, 0x3a3530, 0, 1.7, 0));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xffe2a8, emissive: 0xd89a40 }));
    head.position.y = 3.5;
    grp.add(head);
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.08, 6, 10), toon(0xb83232));
    ribbon.position.y = 2.6; ribbon.rotation.x = Math.PI / 2;
    grp.add(ribbon);
    grp.position.set(s.x, yB, s.z);
    g.add(grp);
  }

  function fountain(g, s) {
    const grp = new THREE.Group();
    const yB = 8; // plaza height
    const stone = new THREE.MeshLambertMaterial({ color: 0xc8ccc4 });
    const waterM = () => new THREE.MeshLambertMaterial({ color: 0x7fc8e8, transparent: true, opacity: 0.85, emissive: 0x1a4a5a });
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(7, 7.4, 1.1, 24), stone).translateY(0.55));
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 0.2, 24), waterM());
    pool.position.y = 1.05; grp.add(pool); fountainWater.push(pool);
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 2.6, 12), stone).translateY(2.2));
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.7, 0.5, 18), stone).translateY(3.4));
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.18, 18), waterM());
    mid.position.y = 3.7; grp.add(mid); fountainWater.push(mid);
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.8, 10), stone).translateY(4.6));
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.4, 14), stone).translateY(5.6));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.16, 14), waterM());
    top.position.y = 5.85; grp.add(top); fountainWater.push(top);
    // jets
    const jetMat = new THREE.MeshBasicMaterial({ color: 0xbfe8f8, transparent: true, opacity: 0.55, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const jet = new THREE.Mesh(new THREE.ConeGeometry(0.16, 2.6, 6), jetMat.clone());
      jet.position.set(Math.cos(a) * 1.6, 5.2, Math.sin(a) * 1.6);
      jet.rotation.z = Math.cos(a) * 0.8;
      jet.rotation.x = -Math.sin(a) * 0.8;
      grp.add(jet);
      jets.push(jet);
    }
    // garland around the rim
    const garland = new THREE.Mesh(new THREE.TorusGeometry(7.1, 0.22, 6, 36), toon(0x2e6b46));
    garland.rotation.x = Math.PI / 2; garland.position.y = 1.25;
    grp.add(garland);
    grp.position.set(s.x, yB, s.z);
    g.add(grp);
  }

  function xmasTree(g, s) {
    const grp = new THREE.Group();
    const yB = T().groundHeight(s.x, s.z);
    grp.add(box(1.2, 1.6, 1.2, 0x5a4630, 0, 0.8, 0));
    const greens = [0x1e5b36, 0x256b40, 0x2e7b4a];
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(4.4 - i * 1.2, 4.4 - i * 0.8, 9), toon(greens[i]));
      cone.position.y = 3 + i * 2.7;
      grp.add(cone);
    }
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.7),
      new THREE.MeshLambertMaterial({ color: 0xffe28a, emissive: 0xd8a838 }));
    star.position.y = 11.6; star.userData.spin = true;
    grp.add(star); spinners.push(star);
    const bulbColors = [0xff5a4a, 0xffd24a, 0x5ab8ff, 0x8aff7a, 0xff8ad8];
    for (let i = 0; i < 42; i++) {
      const t = i / 42;
      const a = t * Math.PI * 9;
      const r = 4.0 - t * 3.4;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5),
        new THREE.MeshLambertMaterial({ color: bulbColors[i % 5], emissive: bulbColors[i % 5] }));
      bulb.material.emissiveIntensity = 0.8;
      bulb.position.set(Math.cos(a) * r, 1.6 + t * 9.2, Math.sin(a) * r);
      bulb.userData.phase = i;
      grp.add(bulb);
      twinkles.push(bulb);
    }
    grp.position.set(s.x, yB, s.z);
    g.add(grp);
  }

  function buildStructures() {
    const g = new THREE.Group();
    for (const s of T().structures()) {
      if (s.kind === 'house') timberHouse(g, s);
      else if (s.kind === 'stall') marketStall(g, s);
      else if (s.kind === 'lamp') lampPost(g, s);
      else if (s.kind === 'bench') {
        const yB = T().groundHeight(s.x, s.z);
        const grp = new THREE.Group();
        grp.add(box(1.8, 0.12, 0.5, 0x6a523a, 0, 0.5, 0));
        grp.add(box(1.8, 0.5, 0.1, 0x6a523a, 0, 0.8, -0.22));
        for (const sx of [-0.7, 0.7]) grp.add(box(0.12, 0.5, 0.4, 0x4a3a2a, sx, 0.25, 0));
        grp.position.set(s.x, yB, s.z); grp.rotation.y = s.ry || 0;
        g.add(grp);
      }
      else if (s.kind === 'fountain') fountain(g, s);
      else if (s.kind === 'xmastree') xmasTree(g, s);
      else if (s.kind === 'gate') {
        const yB = T().groundHeight(s.x, s.z);
        for (const sx of [-7, 7]) g.add(box(2.6, 9, 2.6, 0xb0a890, s.x + sx, yB + 4.5, s.z));
        g.add(box(17.5, 2.2, 2.8, 0xb0a890, s.x, yB + 9.2, s.z));
        for (const sx of [-4, 0, 4]) {
          const ban = box(1.4, 3.2, 0.08, sx % 8 ? 0xb83232 : 0x2e6b46, s.x + sx, yB + 7.2, s.z + 1.5);
          g.add(ban);
        }
      }
    }
    scene.add(g);
  }

  // ------------------------------------------------------------ landmarks
  function waypointStatue(g, x, z) {
    const h = T().groundHeight(x, z);
    g.add(box(2.6, 0.8, 2.6, 0x9aa4b8, x, h + 0.4, z));
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.9),
      new THREE.MeshLambertMaterial({ color: 0x6fe8e8, emissive: 0x2da8b8 }));
    crystal.position.set(x, h + 2.4, z);
    g.add(crystal); spinners.push(crystal);
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
    for (const tr of WDT().TRIALS) {
      const h = T().groundHeight(tr.x, tr.z);
      const ob = box(1.4, 4.2, 1.4, 0x2a2430, tr.x, h + 2.1, tr.z, 0.6);
      g.add(ob);
      const rune = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 6, 14),
        new THREE.MeshLambertMaterial({ color: 0xb83232, emissive: 0x8a1a1a }));
      rune.position.set(tr.x, h + 2.6, tr.z);
      g.add(rune); spinners.push(rune);
    }
    // manor
    {
      const [ax, az] = WDT().REGIONS[1].anchor;
      const h = T().groundHeight(ax, az - 14);
      g.add(box(16, 7, 8, 0xd8d0c0, ax, h + 3.5, az - 14));
      g.add(box(5, 9, 7, 0xcabfa8, ax - 9, h + 4.5, az - 14));
      g.add(box(5, 9, 7, 0xcabfa8, ax + 9, h + 4.5, az - 14));
      g.add(box(17, 1.4, 9, 0x3d5d8a, ax, h + 7.7, az - 14));
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
      cr.position.set(ax, h + 7.4, az - 16); g.add(cr); spinners.push(cr);
      arenaStones(g, WDT().STAGE_SPOTS.c6s4.x, WDT().STAGE_SPOTS.c6s4.z, 15);
    }
    // priestella decks + lamps
    {
      for (const p of WDT().PLATFORMS) {
        g.add(box(p.w, 1.2, p.d, 0x8a7a5e, p.x, p.y - 0.6, p.z));
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const lx = p.x + sx * (p.w / 2 - 1), lz = p.z + sz * (p.d / 2 - 1);
          g.add(box(0.25, 3, 0.25, 0x4a4540, lx, p.y + 1.5, lz));
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6),
            new THREE.MeshLambertMaterial({ color: 0xffe8a8, emissive: 0xcc9a40 }));
          lamp.position.set(lx, p.y + 3.1, lz); g.add(lamp);
        }
      }
    }
    arenaStones(g, WDT().STAGE_SPOTS.c1s4.x, WDT().STAGE_SPOTS.c1s4.z, 12);
    arenaStones(g, WDT().STAGE_SPOTS.c2s4.x, WDT().STAGE_SPOTS.c2s4.z, 13);
    scene.add(g);
  }

  function buildBeacon() {
    beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 80, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd97a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })
    );
    scene.add(beacon);
  }

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

  // ------------------------------------------------------------ character rigs
  // Original chibi geometry: big readable anime faces, canonical colors,
  // optional Winter Festival recolor. No external assets.
  function festive(look, id) {
    if (outfitMode !== 'winter') return look;
    const X = WDT().XMAS;
    const o = Object.assign({}, look);
    if (X[id]) Object.assign(o, X[id]);
    else {
      const pal = X.default;
      o.body = pal[Math.abs(id.length * 31 + id.charCodeAt(0)) % pal.length];
      o.outfit2 = X.trim;
    }
    o._festive = true;
    return o;
  }

  function animeFace(g, L, headY, headR) {
    const skin = L.skin || '#f0d8c0';
    if (L.helmet) {
      const helm = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.1, 10, 8), toon(L.helmet));
      helm.position.y = headY;
      g.add(outline(helm, 0.05));
      const visor = box(headR * 1.2, 0.12, 0.06, 0x101014, 0, headY + 0.05, headR * 0.92);
      g.add(visor);
      return;
    }
    const eyes = [{ x: -0.19, c: L.eyes }, { x: 0.19, c: L.eyes2 || L.eyes }];
    for (const e of eyes) {
      if (L.eyeCover === (e.x < 0 ? 'L' : 'R')) {
        const flap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), toon(L.hair));
        flap.scale.set(1, 1.25, 0.45);
        flap.position.set(e.x, headY + 0.07, headR * 0.86);
        g.add(flap);
        continue;
      }
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.125, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      white.scale.set(0.85, 1.35, 0.42);
      white.position.set(e.x, headY + 0.04, headR * 0.84);
      g.add(white);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6),
        new THREE.MeshBasicMaterial({ color: e.c }));
      iris.scale.set(0.8, 1.25, 0.4);
      iris.position.set(e.x, headY + 0.025, headR * 0.9);
      g.add(iris);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.042, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0x1a1216 }));
      pupil.scale.set(0.8, 1.2, 0.4);
      pupil.position.set(e.x, headY + 0.02, headR * 0.95);
      g.add(pupil);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 5, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      glint.position.set(e.x + 0.035, headY + 0.085, headR * 0.97);
      g.add(glint);
      // brow
      const brow = box(0.16, 0.028, 0.03, L.hair, e.x, headY + 0.21, headR * 0.9);
      brow.rotation.z = e.x < 0 ? -0.15 : 0.15;
      g.add(brow);
    }
    // mouth + blush
    g.add(box(0.09, 0.025, 0.03, 0x9a4a44, 0, headY - 0.21, headR * 0.95));
    for (const sx of [-1, 1]) {
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xf0a0a0, transparent: true, opacity: 0.45 }));
      blush.scale.set(1, 0.6, 0.3);
      blush.position.set(sx * 0.3, headY - 0.12, headR * 0.82);
      g.add(blush);
    }
  }

  function hairFor(g, L, headY, headR) {
    if (L.helmet || L.hairStyle === 'none') {
      if (L.beard) {
        const beard = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), toon(L.beard));
        beard.scale.set(1.1, 0.9, 0.7);
        beard.position.set(0, headY - 0.32, headR * 0.62);
        g.add(beard);
      }
      return;
    }
    const hMat = toon(L.hair);
    // cap (leaves the face open at the front-bottom)
    const cap = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.12, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.62), hMat);
    cap.position.y = headY + 0.05;
    g.add(outline(cap, 0.05));
    // bangs: small drops over the forehead so the front reads instantly
    for (let i = -2; i <= 2; i++) {
      const bang = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.3 + (i % 2 ? 0.1 : 0), 5), hMat);
      bang.position.set(i * 0.14, headY + 0.34, headR * 0.88);
      bang.rotation.x = Math.PI;
      g.add(bang);
    }
    const style = L.hairStyle;
    if (style === 'spiky') {
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.4, 5), hMat);
        const a = (i / 6) * Math.PI - Math.PI / 2;
        sp.position.set(Math.cos(a) * 0.3, headY + 0.52, -0.1 + Math.sin(a) * 0.18);
        sp.rotation.x = -0.5 + Math.sin(a) * 0.3;
        sp.rotation.z = Math.cos(a) * 0.7;
        g.add(sp);
      }
    } else if (style === 'bob') {
      for (const sx of [-1, 1]) {
        const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 6), hMat);
        tuft.scale.set(0.7, 1.5, 0.8);
        tuft.position.set(sx * headR * 0.95, headY - 0.12, 0.1);
        g.add(tuft);
      }
      const back = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.05, 10, 8), hMat);
      back.scale.set(1, 1.15, 0.7);
      back.position.set(0, headY - 0.05, -headR * 0.42);
      g.add(back);
    } else if (style === 'long' || style === 'wavy') {
      const back = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.92, headR * 0.62, 1.5, 10), hMat);
      back.position.set(0, headY - 0.78, -headR * 0.55);
      g.add(outline(back, 0.05));
      if (style === 'wavy') {
        for (const sx of [-1, 1]) {
          const curl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), hMat);
          curl.position.set(sx * headR * 0.85, headY - 0.9, -0.1);
          g.add(curl);
        }
      }
      for (const sx of [-1, 1]) {
        const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.9, 6), hMat);
        strand.position.set(sx * headR * 0.92, headY - 0.35, headR * 0.3);
        g.add(strand);
      }
    } else if (style === 'ponytail') {
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.06, 1.6, 7), hMat);
      tail.position.set(0, headY - 0.45, -headR * 0.95);
      tail.rotation.x = 0.35;
      g.add(tail);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.045, 5, 8), toon(0x6a4880));
      tie.position.set(0, headY + 0.22, -headR * 0.85);
      g.add(tie);
    } else if (style === 'twintail') {
      for (const sx of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.05, 1.4, 7), hMat);
        tail.position.set(sx * headR * 1.05, headY - 0.35, -0.1);
        tail.rotation.z = sx * 0.25;
        g.add(tail);
      }
    } else if (style === 'braids') {
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const bead = new THREE.Mesh(new THREE.SphereGeometry(0.11 - i * 0.012, 6, 5), hMat);
          bead.position.set(sx * headR * 0.95, headY - 0.15 - i * 0.22, 0.05 - i * 0.03);
          g.add(bead);
        }
      }
    } else if (style === 'drills') {
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const drill = new THREE.Mesh(new THREE.ConeGeometry(0.2 - i * 0.05, 0.42, 7), hMat);
          drill.position.set(sx * (headR * 0.95 + 0.06), headY - 0.05 - i * 0.34, 0);
          drill.rotation.x = Math.PI;
          drill.rotation.y = i * 1.2;
          g.add(drill);
        }
      }
    }
  }

  function weaponMesh(kind, L) {
    const grp = new THREE.Group();
    const accent = toon(L.outfit2 || '#c8b870');
    if (kind === 'staff') {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), toon(0x6a5238));
      rod.position.y = -0.25; grp.add(rod);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshLambertMaterial({ color: L.hair, emissive: new THREE.Color(L.hair).multiplyScalar(0.55) }));
      orb.position.y = 0.55; grp.add(orb);
    } else if (kind === 'flail') {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 6), toon(0x8088a0));
      ball.position.y = 0.45; grp.add(ball);
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), toon(0x8088a0));
        const a = (i / 6) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.2, 0.45, Math.sin(a) * 0.2);
        spike.rotation.z = -a - Math.PI / 2;
        grp.add(spike);
      }
    } else if (kind === 'knife') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.14), toon(0xd0d4dc));
      blade.position.y = 0.34; grp.add(blade);
    } else if (kind === 'claw' || kind === 'fist') {
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), accent);
      k.position.y = 0.16; grp.add(k);
      if (kind === 'claw') for (let i = -1; i <= 1; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 4), toon(0xe8e8e8));
        c.position.set(i * 0.08, 0.32, 0.05);
        grp.add(c);
      }
    } else if (kind === 'fan') {
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.06, 0.04, 10, 1, false, 0, Math.PI), toon(0xc84848));
      fan.rotation.x = Math.PI / 2;
      fan.position.y = 0.35;
      grp.add(fan);
    } else if (kind === 'lute') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), toon(0x9a6a3a));
      body.scale.set(1, 1.25, 0.5); body.position.y = 0.2;
      grp.add(body);
      const neck = box(0.06, 0.5, 0.05, 0x6a4a2a, 0, 0.55, 0);
      grp.add(neck);
    } else { // sword
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.05, 0.18), toon(0xdde2ea));
      blade.position.y = 0.58; grp.add(outline(blade, 0.1));
      const hilt = box(0.3, 0.07, 0.07, 0xb09040, 0, 0.06, 0);
      grp.add(hilt);
    }
    return grp;
  }

  // lite=true builds NPC-grade rigs (dot eyes, fewer parts, no outlines)
  function buildRig(L, lite) {
    const g = new THREE.Group();
    const sc = L.scale || 1;
    const skin = L.skin || '#f0d8c0';
    const bodyMat = toon(L.body);
    const headY = 2.18, headR = 0.5;
    const ud = {};

    // legs + boots
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.72, 6), toon(0x3a3440));
      leg.position.set(sx * 0.19, 0.46, 0);
      g.add(leg);
      const boot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), toon(L._festive ? 0x4a2a22 : 0x2a2426));
      boot.scale.set(1, 0.6, 1.4);
      boot.position.set(sx * 0.19, 0.1, 0.05);
      g.add(boot);
      ud[sx < 0 ? 'legL' : 'legR'] = leg;
    }
    // torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.95, 9), bodyMat);
    torso.position.y = 1.25;
    g.add(lite ? torso : outline(torso, 0.06));
    ud.torso = torso;
    // outfit layers
    const isDress = L.outfit === 'dress' || L.outfit === 'maid';
    if (isDress) {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.85, 0.75, 10), bodyMat);
      skirt.position.y = 0.68;
      g.add(lite ? skirt : outline(skirt, 0.05));
      const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.88, 0.12, 10), toon(L._festive ? WDT().XMAS.trim : (L.outfit2 || '#f0f0f0')));
      hem.position.y = 0.34;
      g.add(hem);
      if (L.outfit === 'maid') {
        const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.72, 0.6, 10, 1, false, -0.7, 1.4), toon('#f4f4f4'));
        apron.position.y = 0.72;
        g.add(apron);
        const bib = box(0.34, 0.4, 0.05, 0xf4f4f4, 0, 1.35, 0.4);
        g.add(bib);
      }
    } else if (L.outfit === 'tracksuit') {
      const panel = box(0.36, 0.55, 0.06, 0xe8e4dc, 0, 1.3, 0.42);
      g.add(panel);
      for (const sx of [-1, 1]) {
        const stripe = box(0.08, 0.9, 0.04, L.outfit2 || '#e07820', sx * 0.36, 1.25, 0.4);
        stripe.rotation.y = sx * 0.35;
        g.add(stripe);
      }
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.085, 6, 12), toon(L.outfit2 || '#e07820'));
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 1.78;
      g.add(collar);
    } else if (L.outfit === 'coat' || L.outfit === 'suit') {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, 0.5, 9), bodyMat);
      skirt.position.y = 0.72;
      g.add(skirt);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 12), toon(L.outfit2 || '#d8d8d8'));
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 1.78;
      g.add(collar);
      const buttons = [1.45, 1.25, 1.05];
      for (const by of buttons) g.add(box(0.05, 0.05, 0.03, 0xd8c878, 0, by, 0.44));
    } else {
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.1, 9), toon(0x4a3a2a));
      belt.position.y = 0.82;
      g.add(belt);
    }
    // festive fur trim
    if (L._festive) {
      const trim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 6, 12), toon(WDT().XMAS.trim));
      trim.rotation.x = Math.PI / 2;
      trim.position.y = 0.82;
      g.add(trim);
    }
    // arms
    const mkArm = (sx) => {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.52, 1.62, 0);
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.62, 6), bodyMat);
      limb.position.y = -0.28;
      arm.add(limb);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), toon(skin));
      hand.position.y = -0.6;
      arm.add(hand);
      if (L._festive) {
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.045, 5, 8), toon(WDT().XMAS.trim));
        cuff.position.y = -0.5;
        cuff.rotation.x = Math.PI / 2;
        arm.add(cuff);
      }
      g.add(arm);
      return arm;
    };
    ud.armL = mkArm(-1);
    ud.armR = mkArm(1);
    if (!lite && L.weapon) {
      const w = weaponMesh(L.weapon, L);
      w.position.y = -0.62;
      ud.armR.add(w);
    }
    // head
    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 12, 10), toon(skin));
    head.position.y = headY;
    g.add(lite ? head : outline(head, 0.05));
    ud.head = head;
    if (lite) {
      // dot eyes for NPCs
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), new THREE.MeshBasicMaterial({ color: 0x2a2228 }));
        eye.position.set(sx * 0.17, headY + 0.05, headR * 0.88);
        g.add(eye);
      }
    } else {
      animeFace(g, L, headY, headR);
    }
    hairFor(g, L, headY, headR);
    // accessories
    if (L.headband && L.hairStyle) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(headR * 0.92, 0.05, 5, 14, Math.PI), toon('#f4f4f4'));
      band.position.y = headY + 0.32;
      band.rotation.x = -0.5;
      g.add(band);
    }
    if (L.catEars || L.beastEars) {
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(L.beastEars ? 0.16 : 0.12, L.beastEars ? 0.34 : 0.26, 5), toon(L.hair));
        ear.position.set(sx * 0.28, headY + 0.5, -0.02);
        ear.rotation.z = -sx * 0.25;
        g.add(ear);
      }
    }
    if (L.muzzle) {
      const mz = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), toon(L.skin));
      mz.scale.set(1, 0.7, 1.1);
      mz.position.set(0, headY - 0.12, headR * 0.85);
      g.add(mz);
    }
    if (L.elfEars) {
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 4), toon(skin));
        ear.position.set(sx * (headR + 0.06), headY + 0.04, 0);
        ear.rotation.z = sx * Math.PI / 2 - sx * 0.25;
        g.add(ear);
      }
    }
    if (L.ribbon) {
      const bow = new THREE.Group();
      for (const sx of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 4), toon(L.ribbon));
        wing.rotation.z = sx * Math.PI / 2;
        wing.position.x = sx * 0.12;
        bow.add(wing);
      }
      bow.position.set(0.3, headY + 0.42, 0.1);
      g.add(bow);
    }
    if (L.scarf) {
      const sc2 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 6, 12), toon(L.scarf));
      sc2.rotation.x = Math.PI / 2;
      sc2.position.y = 1.82;
      g.add(sc2);
      const tail = box(0.16, 0.5, 0.08, L.scarf, 0.2, 1.55, 0.34);
      g.add(tail);
    }
    if (L.flower) {
      const holly = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const berry = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), toon(L.flower));
        berry.position.set(i * 0.07 - 0.07, 0, 0);
        holly.add(berry);
      }
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), toon(0x2e6b46));
      leaf.rotation.z = Math.PI / 2;
      leaf.position.set(-0.16, 0, 0);
      holly.add(leaf);
      holly.position.set(0.38, headY + 0.36, 0.22);
      g.add(holly);
    }
    if (L._festive && !L.helmet && !L.headband && !L.catEars && !L.beastEars && L.hairStyle !== 'drills') {
      const hat = new THREE.Group();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 8), toon(0xb83232));
      cone.position.y = 0.28;
      cone.rotation.z = 0.3;
      hat.add(cone);
      const brim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 6, 12), toon('#f4f4f4'));
      brim.rotation.x = Math.PI / 2;
      hat.add(brim);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), toon('#f4f4f4'));
      pom.position.set(-0.2, 0.56, 0);
      hat.add(pom);
      hat.position.y = headY + 0.42;
      g.add(hat);
    }
    g.scale.setScalar(sc);
    g.userData = ud;
    return g;
  }

  function buildCat(L) {
    // Puck: a small floating cat spirit
    const g = new THREE.Group();
    const fur = toon(L.body);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), fur);
    body.scale.set(1, 0.92, 1.15); body.position.y = 1.5;
    g.add(outline(body, 0.06));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), fur);
    head.position.y = 2.0;
    g.add(outline(head, 0.06));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 5), fur);
      ear.position.set(sx * 0.17, 2.3, 0);
      g.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0x2a2630 }));
      eye.position.set(sx * 0.11, 2.05, 0.26);
      g.add(eye);
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.025, 0.7, 6), fur);
    tail.position.set(0, 1.6, -0.42);
    tail.rotation.x = 0.9;
    g.add(tail);
    if (outfitMode === 'winter') {
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 10), toon(0xb83232));
      scarf.rotation.x = Math.PI / 2;
      scarf.position.y = 1.82;
      g.add(scarf);
    }
    g.userData = { hoverCat: true, armR: new THREE.Group(), armL: new THREE.Group(), legL: new THREE.Group(), legR: new THREE.Group(), torso: body, head };
    return g;
  }

  function buildChibi(id) {
    const L0 = WDT().LOOKS[id] || { body: '#888', hair: '#aaa', eyes: '#444', hairStyle: 'short', outfit: 'plain', weapon: 'sword' };
    const L = festive(L0, id);
    return L.cat ? buildCat(L) : buildRig(L, false);
  }

  function syncParty(W) {
    if (!playerGroup) { playerGroup = new THREE.Group(); scene.add(playerGroup); }
    const active = RZ.World.activeId(W);
    for (const id of W.partyIds) {
      if (!charMeshes[id]) { charMeshes[id] = buildChibi(id); playerGroup.add(charMeshes[id]); }
    }
    for (const [id, mesh] of Object.entries(charMeshes)) mesh.visible = id === active;
  }

  function setOutfits(mode) {
    outfitMode = mode;
    for (const [id, mesh] of Object.entries(charMeshes)) {
      playerGroup.remove(mesh);
      delete charMeshes[id];
    }
  }

  // ------------------------------------------------------------ NPCs
  function buildNpcs() {
    const kinds = WDT().NPC_KINDS;
    WDT().NPCS.forEach((npc, i) => {
      const K = kinds[npc.kind];
      const h = (a, b) => T().hash2(i * 13 + a, b);
      const L = {
        body: K.bodies[Math.floor(h(1, 2) * K.bodies.length)],
        hair: K.hair[Math.floor(h(3, 4) * K.hair.length)],
        eyes: '#2a2228', skin: npc.kind === 'beastfolk' ? '#d8b894' : '#f0d8c0',
        hairStyle: h(5, 6) > 0.5 ? 'bob' : 'short',
        outfit: h(7, 8) > 0.6 ? 'dress' : 'plain',
        beastEars: !!K.ears,
        scarf: h(9, 10) > 0.5 ? (h(2, 9) > 0.5 ? '#b83232' : '#2e6b46') : null,
        scale: 0.92 + h(11, 12) * 0.16,
      };
      const rig = buildRig(L, true);
      const y = T().groundHeight(npc.x, npc.z);
      rig.position.set(npc.x, y, npc.z);
      scene.add(rig);
      npcs.push({ def: npc, rig, phase: h(13, 14) * 6.28, cx: npc.x, cz: npc.z });
    });
  }

  function updateNpcs(dt) {
    for (const n of npcs) {
      n.phase += dt * 0.22;
      const r = n.def.wander * (0.4 + 0.6 * Math.abs(Math.sin(n.phase * 0.43)));
      const tx = n.def.x + Math.cos(n.phase) * r;
      const tz = n.def.z + Math.sin(n.phase * 0.77) * r;
      const dx = tx - n.cx, dz = tz - n.cz;
      const d = Math.hypot(dx, dz);
      const sp = 1.1 * dt;
      if (d > 0.05) {
        n.cx += (dx / d) * Math.min(sp, d);
        n.cz += (dz / d) * Math.min(sp, d);
        n.rig.rotation.y = Math.atan2(dx, dz);
        const w = Math.sin(time * 7 + n.phase) * 0.4;
        if (n.rig.userData.legL.rotation) {
          n.rig.userData.legL.rotation.x = w;
          n.rig.userData.legR.rotation.x = -w;
        }
      }
      n.rig.position.set(n.cx, T().groundHeight(n.cx, n.cz), n.cz);
    }
  }

  function npcPositions() {
    return npcs.map((n) => ({ x: n.cx, z: n.cz, def: n.def }));
  }

  // ------------------------------------------------------------ enemies
  function buildEnemyMesh(e) {
    const [arch, colorHex, eyeHex] = WDT().ENEMY_LOOKS[e.key] || ['humanoid', '#777', '#222'];
    const g = new THREE.Group();
    const mat = toon(colorHex);
    g.userData.mat = mat;
    const eyeMat = new THREE.MeshBasicMaterial({ color: eyeHex });
    const heavyOutline = e.boss;
    const add = (mesh) => g.add(heavyOutline ? outline(mesh, 0.05) : mesh);
    if (arch === 'beast') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 2.4), mat);
      body.position.y = 0.9; add(body);
      const headM = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), mat);
      headM.position.set(0, 1.25, 1.4); add(headM);
      for (const sx of [-0.28, 0.28]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), eyeMat);
        eye.position.set(sx, 1.35, 1.82);
        g.add(eye);
      }
      for (const sx of [-0.2, 0.2]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), mat);
        ear.position.set(sx, 1.7, 1.3);
        g.add(ear);
      }
      for (const sx of [-0.5, 0.5]) for (const sz of [-0.8, 0.8]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 5), mat);
        leg.position.set(sx, 0.45, sz); g.add(leg);
      }
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.02, 0.9, 5), mat);
      tail.position.set(0, 1.15, -1.4); tail.rotation.x = -0.7;
      g.add(tail);
    } else if (arch === 'wraith') {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.4, 7),
        new THREE.MeshToonMaterial({ color: colorHex, gradientMap: toonGradient(), transparent: true, opacity: 0.82 }));
      cone.position.y = 1.6; add(cone);
      for (const sx of [-0.2, 0.2]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4),
          new THREE.MeshBasicMaterial({ color: eyeHex }));
        eye.position.set(sx, 1.9, 0.55);
        g.add(eye);
      }
      g.userData.hover = true;
    } else if (arch === 'whale') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 9), mat);
      body.scale.set(1.2, 0.85, 2.2); body.position.y = 1.8; add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 6), mat);
      tail.rotation.x = Math.PI / 2; tail.position.set(0, 1.8, -4); add(tail);
      for (const sx of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 5), mat);
        fin.rotation.z = sx * Math.PI / 2.2;
        fin.position.set(sx * 1.9, 1.4, 0.8);
        g.add(fin);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), eyeMat);
        eye.position.set(sx * 1.45, 2.1, 2.6);
        g.add(eye);
      }
    } else { // humanoid
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 1.2, 7), mat);
      body.position.y = 1.05; add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 7), mat);
      head.position.y = 2.0; add(head);
      for (const sx of [-0.15, 0.15]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), eyeMat);
        eye.position.set(sx, 2.05, 0.34);
        g.add(eye);
      }
      for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 5), mat);
        arm.position.set(sx * 0.5, 1.35, 0);
        arm.rotation.z = sx * 0.3;
        g.add(arm);
      }
    }
    g.scale.setScalar(e.size);
    const barBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x201418, depthTest: false }));
    barBg.scale.set(2.2, 0.22, 1); barBg.position.y = e.size * 2.6 + 0.6;
    const barFg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x6fd46f, depthTest: false }));
    barFg.scale.set(2.1, 0.14, 1); barFg.position.y = e.size * 2.6 + 0.6;
    g.add(barBg); g.add(barFg);
    g.userData.barFg = barFg; g.userData.barBg = barBg;
    const aura = new THREE.Mesh(new THREE.RingGeometry(e.size * 0.9, e.size * 1.15, 18),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    aura.rotation.x = -Math.PI / 2; aura.position.y = 0.12; aura.visible = false;
    g.add(aura); g.userData.aura = aura;
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
        case 'plunge-fx': spawnRing(e.x, e.y, e.z, ELEMENT_HEX[e.element] || 0xffffff, 5); break;
        case 'breather': spawnDmg(e.e.x, e.e.y + 4, e.e.z, '...haah... haah...', '#ffd97a', true); break;
        default: break;
      }
    }
  }

  // ------------------------------------------------------------ player animation
  function animatePlayer(W, dt) {
    const p = W.player;
    const active = charMeshes[RZ.World.activeId(W)];
    if (!active) return;
    const ud = active.userData;
    playerGroup.position.set(p.x, p.y, p.z);
    playerGroup.rotation.y = p.yaw;
    if (ud.hoverCat) {
      active.position.y = 0.4 + Math.sin(time * 2.4) * 0.18;
      return;
    }
    const walk = W._moving && p.grounded ? Math.sin(time * 11) * 0.65 : 0;
    ud.legL.rotation.x = walk;
    ud.legR.rotation.x = -walk;
    if (!p.grounded) { ud.legL.rotation.x = 0.5; ud.legR.rotation.x = -0.3; }
    if (p.climbing) {
      ud.armL.rotation.x = -2.4 + Math.sin(time * 8) * 0.4;
      ud.armR.rotation.x = -2.4 - Math.sin(time * 8) * 0.4;
      active.rotation.x = 0.25;
    } else {
      active.rotation.x = 0;
      // arm pose by swing animation
      const sw = p.swing;
      if (sw) {
        const k = Math.min(1, sw.t / sw.dur);
        const drive = Math.sin(k * Math.PI);
        switch (sw.anim) {
          case 'slashR':
            ud.armR.rotation.x = -1.4 * drive;
            ud.armR.rotation.z = -1.2 + 2.0 * k;
            active.rotation.y = -0.35 + 0.7 * k;
            break;
          case 'slashL':
            ud.armR.rotation.x = -1.4 * drive;
            ud.armR.rotation.z = 0.8 - 2.0 * k;
            active.rotation.y = 0.35 - 0.7 * k;
            break;
          case 'over':
            ud.armR.rotation.x = -2.9 + 3.3 * k;
            break;
          case 'thrust':
            ud.armR.rotation.x = -1.5;
            ud.armR.position.z = 0.5 * drive;
            break;
          case 'spin':
            active.rotation.y = k * Math.PI * 2;
            ud.armR.rotation.x = -1.5;
            break;
          case 'uppercut':
            ud.armR.rotation.x = 0.8 - 3.2 * k;
            break;
          case 'cast':
            ud.armR.rotation.x = -2.2 * drive;
            break;
          default:
            ud.armR.rotation.x = -2.0 * drive;
        }
      } else {
        ud.armR.rotation.x += (Math.sin(time * 2) * 0.06 - walk * 0.5 - ud.armR.rotation.x) * Math.min(1, dt * 14);
        ud.armR.rotation.z *= Math.max(0, 1 - dt * 10);
        ud.armR.position.z *= Math.max(0, 1 - dt * 10);
        ud.armL.rotation.x = walk * 0.5;
        active.rotation.y *= Math.max(0, 1 - dt * 10);
      }
    }
    active.rotation.z = p.dodgeT > 0 ? Math.sin(time * 30) * 0.18 : 0;
  }

  // ------------------------------------------------------------ per-frame update
  function update(W, dt, cam) {
    time += dt;
    const p = W.player;

    syncParty(W);
    animatePlayer(W, dt);
    updateNpcs(dt);

    // enemies
    const seen = new Set();
    for (const e of W.enemies) {
      seen.add(e);
      let g = enemyMeshes.get(e);
      if (!g) { g = buildEnemyMesh(e); enemyMeshes.set(e, g); }
      g.position.set(e.x, e.y + (g.userData.hover ? 0.6 + Math.sin(time * 2 + e.x) * 0.3 : 0), e.z);
      g.rotation.y = e.yaw;
      if (e.charging) g.rotation.x = -0.25;
      else g.rotation.x = 0;
      if (e.dead) {
        g.scale.setScalar(Math.max(0.01, e.size * e.deathT));
        g.userData.tel.visible = false;
        continue;
      }
      const frac = Math.max(0, e.hp / e.maxhp);
      g.userData.barFg.scale.x = 2.1 * frac;
      g.userData.barFg.position.x = -(1 - frac) * 1.05;
      const showBar = e.aggro || frac < 1;
      g.userData.barFg.visible = showBar; g.userData.barBg.visible = showBar;
      if (e.aura) {
        g.userData.aura.visible = true;
        g.userData.aura.material.color.set(ELEMENT_HEX[e.aura] || 0xffffff);
        g.userData.aura.rotation.z = time * 1.5;
      } else g.userData.aura.visible = false;
      const mat = g.userData.mat;
      if (e.telegraph && (e.telegraph.kind === 'melee' || e.telegraph.kind === 'combo' || e.telegraph.kind === 'charge' || e.telegraph.kind === 'volley')) {
        const k = e.telegraph.t / e.telegraph.dur;
        mat.emissive = new THREE.Color(0xff2010).multiplyScalar(0.25 + k * 0.55);
      } else if (e.breather) {
        mat.emissive = new THREE.Color(0xffd040).multiplyScalar(0.4 + Math.sin(time * 8) * 0.2);
      } else {
        mat.emissive = new THREE.Color(0x000000);
      }
      const tel = g.userData.tel;
      if (e.telegraph && e.telegraph.kind === 'slam') {
        tel.visible = true;
        tel.position.set(e.x, e.y + 0.15, e.z);
        const k = e.telegraph.t / e.telegraph.dur;
        const r = (e.telegraph.move && e.telegraph.move.r) || 6 + e.size * 1.4;
        tel.scale.setScalar(r * (0.3 + 0.7 * k));
        tel.material.opacity = 0.35 + k * 0.4;
      } else tel.visible = false;
    }
    for (const [actor, g] of enemyMeshes) {
      if (!seen.has(actor)) {
        scene.remove(g);
        scene.remove(g.userData.tel);
        enemyMeshes.delete(actor);
      }
    }

    // ground zones
    const seenZ = new Set();
    for (const zn of W.zones) {
      seenZ.add(zn);
      let m = zoneMeshes.get(zn);
      if (!m) {
        m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 24),
          new THREE.MeshBasicMaterial({ color: 0xff5030, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        scene.add(m);
        zoneMeshes.set(zn, m);
      }
      m.position.set(zn.x, T().groundHeight(zn.x, zn.z) + 0.15, zn.z);
      const k = Math.min(1, zn.t / zn.dur);
      m.scale.setScalar(zn.r * (0.35 + 0.65 * k));
      m.material.opacity = zn.done ? 0.9 : 0.3 + k * 0.45;
      m.material.color.set(zn.done ? 0xffe8a0 : 0xff5030);
    }
    for (const [zn, m] of zoneMeshes) {
      if (!seenZ.has(zn)) { scene.remove(m); zoneMeshes.delete(zn); }
    }

    // bolts
    const seenB = new Set();
    for (const b of W.bolts) {
      seenB.add(b);
      let m = boltMeshes.get(b);
      if (!m) {
        m = new THREE.Mesh(new THREE.SphereGeometry(b.big ? 0.55 : 0.28, 6, 6),
          new THREE.MeshBasicMaterial({ color: ELEMENT_HEX[b.element] || 0xfff0c0 }));
        scene.add(m); boltMeshes.set(b, m);
      }
      m.position.set(b.x, b.y, b.z);
    }
    for (const [b, m] of boltMeshes) {
      if (!seenB.has(b)) { scene.remove(m); boltMeshes.delete(b); }
    }

    // beacon
    if (W.quest) {
      beacon.visible = true;
      beacon.position.set(W.quest.spot.x, T().groundHeight(W.quest.spot.x, W.quest.spot.z) + 38, W.quest.spot.z);
      beacon.material.opacity = 0.22 + Math.sin(time * 2.4) * 0.1;
    } else beacon.visible = false;

    // fx + numbers
    for (const fx of fxPool) {
      if (!fx.active) continue;
      fx.t += dt * 2.2;
      if (fx.t >= 1) { fx.active = false; fx.mesh.visible = false; continue; }
      fx.mesh.scale.setScalar(0.3 + fx.t * fx.maxR);
      fx.mesh.material.opacity = 0.9 * (1 - fx.t);
    }
    for (const d of dmgPool) {
      if (!d.active) continue;
      d.t += dt;
      if (d.t > 1.1) { d.active = false; d.sp.visible = false; continue; }
      d.sp.position.y += dt * 2.4;
      d.sp.material.opacity = 1 - d.t / 1.1;
    }

    // ambient animation
    for (const s of spinners) s.rotation.y = time * 1.2;
    for (const b of twinkles) b.material.emissiveIntensity = 0.5 + Math.sin(time * 3 + b.userData.phase) * 0.5;
    for (const j of jets) j.scale.y = 0.85 + Math.sin(time * 5 + j.position.x * 7) * 0.2;
    for (const fw of fountainWater) fw.position.y += Math.sin(time * 3) * 0.0008;
    for (const c of clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 1500) c.position.x = -1500;
    }
    // snow follows the camera
    if (snowPts) {
      snowPts.position.set(p.x, p.y, p.z);
      const pos = snowPts.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - snowVel[i] * dt;
        if (y < 0) y = 55 + Math.random() * 5;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.8 + i) * dt * 0.5);
      }
      pos.needsUpdate = true;
    }
    // golden-hour day cycle (never fully dark — Shinkai hour, always)
    const dayK = 0.62 + 0.38 * Math.sin(time * 0.01);
    sun.intensity = 0.6 + dayK * 0.55;
    hemi.intensity = 0.5 + dayK * 0.35;
    sun.position.set(Math.cos(time * 0.01) * 320, 160 + dayK * 200, Math.sin(time * 0.01) * 320 + 120);
    scene.fog.color.setRGB(0.62 + dayK * 0.16, 0.6 + dayK * 0.2, 0.72 + dayK * 0.2);

    if (waterMesh) waterMesh.position.y = WDT().WORLD.waterY + Math.sin(time * 1.1) * 0.05;

    camera.position.set(cam.x, cam.y, cam.z);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  RZ.WRender = {
    init, update, handleEvents, resize, setOutfits, npcPositions,
    get minimap() { return minimapCanvas; },
    get outfitMode() { return outfitMode; },
    _buildChibi: buildChibi, // headless test hook
  };
})();
