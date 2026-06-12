/* Re:Impact World — boot, input, camera, main loop. */
(function () {
  const RZ = (globalThis.RZ = globalThis.RZ || {});

  let W = null;
  let canvas = null;
  const keys = {};
  const pressed = {};       // edge-triggered since last sim step
  let mouseDown = false;
  let cam = { yaw: Math.PI, pitch: 0.42, dist: 9 };
  let lastT = 0, acc = 0;
  const STEP = 1 / 60;

  function start() {
    RZ.Game.init();
    canvas = document.getElementById('gl');
    RZ.WRender.init(canvas);
    RZ.WHud.init({
      onFastTravel(id) { RZ.World.fastTravel(W, id); snapCamera(); },
      onRespawn() { RZ.World.respawnAfterDeath(W); snapCamera(); },
      relock() { /* user clicks canvas to re-engage mouse look */ },
    });
    W = RZ.World.create({});
    snapCamera();
    bindInput();
    if (W.quest) RZ.WHud.toast(`📜 Objective: <b>${W.quest.stage.name}</b> — follow the golden beacon`);
    requestAnimationFrame(loop);
  }

  function snapCamera() {
    cam.yaw = W.player.yaw + Math.PI;
  }

  // ------------------------------------------------------------ input
  function bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      keys[e.code] = true;
      pressed[e.code] = true;
      if (e.code === 'Escape') RZ.WHud.togglePause();
      if (e.code === 'Tab') e.preventDefault();
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (RZ.WHud.blocking()) return;
      if (e.button === 0) {
        mouseDown = true;
        if (document.pointerLockElement !== canvas && canvas.requestPointerLock) canvas.requestPointerLock();
      }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas && !RZ.WHud.blocking()) {
        cam.yaw -= e.movementX * 0.0026;
        cam.pitch = Math.max(0.08, Math.min(1.25, cam.pitch + e.movementY * 0.0022));
      }
    });
    window.addEventListener('wheel', (e) => {
      cam.dist = Math.max(5, Math.min(16, cam.dist + Math.sign(e.deltaY)));
    });
    window.addEventListener('beforeunload', () => { if (W) RZ.World.persist(W); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && W) RZ.World.persist(W); });
  }

  function gatherInput() {
    // camera-relative WASD
    let fx = 0, fz = 0;
    if (keys.KeyW) fz += 1;
    if (keys.KeyS) fz -= 1;
    if (keys.KeyA) fx += 1;
    if (keys.KeyD) fx -= 1;
    let mx = 0, mz = 0;
    if (fx || fz) {
      const len = Math.hypot(fx, fz);
      fx /= len; fz /= len;
      // camera sits at +(sin yaw, cos yaw) from the player, so forward is the negative
      const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
      mx = -(sy * fz + cy * fx);
      mz = sy * fx - cy * fz;
    }
    let switchTo = -1;
    for (let i = 0; i < 4; i++) if (pressed['Digit' + (i + 1)]) switchTo = i;
    const input = {
      mx, mz,
      sprint: !!keys.ShiftLeft || !!keys.ShiftRight,
      dodge: !!pressed.Space,
      attack: mouseDown || !!pressed.KeyJ || !!keys.KeyJ,
      skill: !!pressed.KeyE,
      burst: !!pressed.KeyQ,
      interact: !!pressed.KeyF,
      lockToggle: !!pressed.Tab,
      switchTo,
    };
    for (const k of Object.keys(pressed)) pressed[k] = false;
    W._moving = Math.hypot(mx, mz) > 0.01;
    return input;
  }

  // ------------------------------------------------------------ loop
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (t - lastT) / 1000 || 0.016);
    lastT = t;

    if (!RZ.WHud.blocking() && !W.pendingRbd) {
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard++ < 5) {
        acc -= STEP;
        const events = RZ.World.step(W, STEP, gatherInput());
        if (events.length) {
          RZ.WRender.handleEvents(W, events);
          RZ.WHud.handleEvents(W, events);
        }
      }
      if (guard >= 5) acc = 0;
    } else if (W.pendingRbd && !RZ.WHud.blocking()) {
      // rbd overlay was dismissed without respawn (shouldn't happen) — keep frozen
    }

    // soft lock-on camera bias
    if (W.lock && !W.lock.dead) {
      const want = Math.atan2(W.lock.x - W.player.x, W.lock.z - W.player.z) + Math.PI;
      let d = want - cam.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      cam.yaw += d * Math.min(1, dt * 3);
    }

    // third-person orbit camera with terrain avoidance
    const p = W.player;
    const ty = p.y + 2.0;
    const cx = p.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
    const cz = p.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
    let cyy = ty + Math.sin(cam.pitch) * cam.dist;
    const groundAtCam = RZ.Terrain.groundHeight(cx, cz) + 0.6;
    if (cyy < groundAtCam) cyy = groundAtCam;

    RZ.WHud.update(W);
    RZ.WRender.update(W, dt, { x: cx, y: cyy, z: cz, tx: p.x, ty: ty, tz: p.z });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
