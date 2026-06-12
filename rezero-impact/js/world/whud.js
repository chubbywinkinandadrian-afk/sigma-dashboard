/* Re:Impact World — DOM HUD: trackers, party frames, dialogs, summons, pause. */
(function () {
  const RZ = (globalThis.RZ = globalThis.RZ || {});
  const D = () => RZ.DATA;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let cb = {};
  let paused = false, dialogOpen = false, rbdOpen = false, summonOpen = false;
  let mapCtx = null;
  let W = null;
  let currentBanner = 'sword-saint';
  const barkCd = new Map();
  let barkUntil = 0;

  function init(callbacks) {
    cb = callbacks || {};
    $('#hud').innerHTML = `
      <div id="quest-tracker"></div>
      <div id="hud-buttons">
        <button class="hud-btn" onclick="RZ.WHud.openSummon()">✦ Summon</button>
        <a class="hud-btn" href="index.html">🏠 Menu</a>
      </div>
      <div id="minimap-wrap"><canvas id="minimap" width="200" height="200"></canvas></div>
      <div id="boss-bar" class="hidden"><div id="boss-name"></div><div class="bb-track"><div id="boss-fill"></div></div></div>
      <div id="party-bar"></div>
      <div id="skill-bar"></div>
      <div id="stamina-wrap"><div id="stamina-fill"></div></div>
      <div id="interact-prompt" class="hidden"></div>
      <div id="npc-bark" class="hidden"></div>
      <div id="hud-hints">WASD move · Space jump/climb · Shift sprint · Ctrl/K dodge · LMB attack (hold = heavy) · RMB heavy · E skill · Q burst · F interact · Tab lock-on · 1-4 switch · Esc menu</div>
      <div id="vignette"></div>
      <div id="w-toasts"></div>
      <div id="dialog-wrap" class="hidden"></div>
      <div id="rbd-wrap" class="hidden"></div>
      <div id="pause-wrap" class="hidden"></div>
      <div id="summon-wrap" class="hidden"></div>`;
    mapCtx = $('#minimap').getContext('2d');
  }

  function blocking() { return paused || dialogOpen || rbdOpen || summonOpen; }

  // ------------------------------------------------------------ toasts
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'w-toast';
    t.innerHTML = msg;
    $('#w-toasts').appendChild(t);
    setTimeout(() => t.classList.add('show'), 20);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
  }

  // ------------------------------------------------------------ dialogs
  function dialog(title, html, buttonText, onClose) {
    dialogOpen = true;
    const w = $('#dialog-wrap');
    w.classList.remove('hidden');
    w.innerHTML = `
      <div class="w-dialog">
        <h2>${title}</h2>
        ${html}
        <button class="w-btn gold" id="dialog-ok">${buttonText || 'Continue'}</button>
      </div>`;
    $('#dialog-ok').onclick = () => {
      dialogOpen = false;
      w.classList.add('hidden');
      if (onClose) onClose();
    };
  }

  function showRbd(det) {
    rbdOpen = true;
    const w = $('#rbd-wrap');
    w.classList.remove('hidden');
    w.innerHTML = `
      <div class="rbd-core">
        <div class="rbd-big">RETURN BY DEATH</div>
        <p>The world lurches backward. The scent of the witch floods everything,
        and unseen hands drag you out of the dark.</p>
        <p><b>You awaken at the last waypoint</b>${det ? ` with <b>+${det * 8}%</b> HP & ATK for this stage` : ''}.</p>
        <button class="w-btn gold" id="rbd-ok">Stand Up ⏪</button>
      </div>`;
    $('#rbd-ok').onclick = () => {
      rbdOpen = false;
      w.classList.add('hidden');
      if (cb.onRespawn) cb.onRespawn();
    };
  }

  function offerTrial(def) {
    const tiers = RZ.WDATA.TRIAL_TIERS.map((t, i) =>
      `<button class="w-btn" onclick="RZ.WHud.startTrial('${def.id}', ${i})">
        ${esc(t.name)} <small>×${(def.baseMult * t.mult).toFixed(1)} · 💎${t.crystals}</small></button>`).join('');
    dialog(`⚔️ ${esc(def.name)}`,
      `<p class="w-story">${esc(def.desc)}</p>
       <p class="w-dim">Three waves, ending in a boss. Repeatable — pick a difficulty.</p>
       <div class="travel-list">${tiers}</div>`,
      'Not today');
  }

  function startTrial(id, tier) {
    dialogOpen = false;
    $('#dialog-wrap').classList.add('hidden');
    if (cb.onTrialStart) cb.onTrialStart(id, tier);
  }

  // ------------------------------------------------------------ summon overlay (in-world gacha)
  function openSummon() {
    summonOpen = true;
    if (document.exitPointerLock) document.exitPointerLock();
    renderSummon(null);
  }

  function renderSummon(results) {
    const S = RZ.Game.state;
    const banner = D().bannerById[currentBanner];
    const key = RZ.Gacha.pityKey(banner);
    const feat5 = banner.featured5 ? D().charById[banner.featured5] : null;
    const tabs = D().BANNERS.map((b) =>
      `<button class="banner-chip ${b.id === currentBanner ? 'active' : ''}"
        onclick="RZ.WHud.pickBanner('${b.id}')">${esc(b.name)}</button>`).join('');
    let resultsHtml = '';
    if (results) {
      resultsHtml = `<div class="sm-results">` + results.map((r) => {
        const isChar = r.type === 'char';
        const obj = isChar ? D().charById[r.id] : D().weaponById[r.id];
        return `<div class="sm-card r${r.rarity}">
          <span class="sm-icon">${obj.icon}</span>
          <span class="sm-name">${esc(obj.name)}</span>
          <span class="sm-stars">${'★'.repeat(r.rarity)}</span>
          ${r.isNew ? '<span class="sm-new">NEW</span>' : ''}
        </div>`;
      }).join('') + `</div>`;
    }
    $('#summon-wrap').classList.remove('hidden');
    $('#summon-wrap').innerHTML = `
      <div class="w-dialog summon-dialog">
        <h2>✦ Summoning Rites <span class="sm-crystals">💎 ${S.crystals.toLocaleString()}</span></h2>
        <div class="banner-chips">${tabs}</div>
        <p class="w-story">${esc(banner.tagline)}</p>
        ${feat5 ? `<p>Featured: <b>${feat5.icon} ${esc(feat5.name)}</b> ★★★★★ <span class="w-dim">(50/50, guaranteed after a loss)</span></p>` : '<p class="w-dim">Standard pool — all non-limited 5★.</p>'}
        <p class="w-dim">5★ pity: <b>${S.pity[key + '5']}</b>/90 · 4★ pity: <b>${S.pity[key + '4']}</b>/10
          ${banner.type === 'limited' && S.pity.guarantee ? ' · 🔒 next 5★ guaranteed featured' : ''}</p>
        ${resultsHtml}
        <div class="sm-actions">
          <button class="w-btn" onclick="RZ.WHud.doSummon(1)">Summon ×1 <small>💎160</small></button>
          <button class="w-btn gold" onclick="RZ.WHud.doSummon(10)">Summon ×10 <small>💎1600</small></button>
          <button class="w-btn" onclick="RZ.WHud.closeSummon()">Close</button>
        </div>
        <p class="w-dim">Party changes and character details live in the 🏠 Menu — same save, same pity.</p>
      </div>`;
  }

  function pickBanner(id) { currentBanner = id; renderSummon(null); }

  function doSummon(n) {
    const res = RZ.Game.summon(currentBanner, n);
    if (!res) { toast('Not enough Witch Crystals — clear stages, camps and trials!'); return; }
    const top = Math.max(...res.map((r) => r.rarity));
    if (RZ.SFX) (top >= 5 ? RZ.SFX.reveal5() : top >= 4 ? RZ.SFX.reveal4() : RZ.SFX.reveal3());
    renderSummon(res);
  }

  function closeSummon() {
    summonOpen = false;
    $('#summon-wrap').classList.add('hidden');
  }

  // ------------------------------------------------------------ pause menu
  function togglePause(force) {
    paused = force != null ? force : !paused;
    const w = $('#pause-wrap');
    if (!paused) { w.classList.add('hidden'); return; }
    if (document.exitPointerLock) document.exitPointerLock();
    w.classList.remove('hidden');
    const wps = (W ? W.waypoints : []).map((id) => {
      const r = RZ.WDATA.REGIONS.find((x) => x.id === id);
      return `<button class="w-btn" onclick="RZ.WHud.travel('${id}')">◈ ${esc(r.name)}</button>`;
    }).join('') || '<p class="w-dim">No waypoints discovered yet — look for the glowing crystals.</p>';
    const sound = RZ.Game.state.settings.sound;
    const outfit = RZ.WRender && RZ.WRender.outfitMode === 'winter' ? 'Winter Festival ❄️' : 'Classic';
    w.innerHTML = `
      <div class="w-dialog">
        <h2>— Paused —</h2>
        <h3>Fast Travel</h3>
        <div class="travel-list">${wps}</div>
        <h3>Game</h3>
        <button class="w-btn" onclick="RZ.WHud.togglePause()">Resume</button>
        <button class="w-btn" onclick="RZ.WHud.openSummon(); RZ.WHud.togglePause(false)">✦ Summon</button>
        <button class="w-btn" onclick="RZ.WHud.toggleOutfit()">Outfits: ${outfit}</button>
        <button class="w-btn" onclick="RZ.WHud.toggleSound()">Sound: ${sound ? 'ON' : 'OFF'}</button>
        <a class="w-btn" href="index.html">Party, Story &amp; Full Gacha Menu ⮕</a>
        <p class="w-dim">Progress, roster and pity are shared with the menu game and save automatically.</p>
      </div>`;
  }

  function travel(id) {
    if (cb.onFastTravel) cb.onFastTravel(id);
    togglePause(false);
  }

  function toggleSound() {
    RZ.Game.state.settings.sound = !RZ.Game.state.settings.sound;
    RZ.Game.save();
    togglePause(true);
  }

  function toggleOutfit() {
    if (cb.onOutfit) cb.onOutfit(RZ.WRender.outfitMode === 'winter' ? 'classic' : 'winter');
    togglePause(true);
  }

  // ------------------------------------------------------------ events
  function handleEvents(w, events) {
    W = w;
    for (const e of events) {
      switch (e.t) {
        case 'stage-intro':
          dialog(`${e.stage.boss ? '👑 ' : ''}${esc(e.stage.name)}`,
            `<p class="w-story">${esc(e.stage.intro)}</p>
             <p class="w-dim">Chapter ${e.chapter.num} — ${esc(e.chapter.title)}</p>`,
            'To Battle ⚔️');
          break;
        case 'stage-clear': {
          const r = e.rewards;
          const joined = r.joined ? D().charById[r.joined] : null;
          dialog('🏆 Stage Clear!',
            `<p class="w-story">${esc(e.stage.outro || 'The dust settles.')}</p>
             <p>💎 +${r.crystals} Witch Crystals · +${r.xpEach} XP each</p>
             ${joined ? `<p class="w-join">${joined.icon} <b>${esc(joined.name)}</b> joins your roster!
               Add them to the party from the menu.</p>` : ''}`);
          break;
        }
        case 'trial-offer': offerTrial(e.def); break;
        case 'trial-start': toast(`⚔️ ${esc(e.def.name)} — wave 1/3!`); break;
        case 'trial-clear':
          dialog('🏆 Trial Complete!',
            `<p class="w-story">The obelisk dims, satisfied. For now.</p>
             <p>💎 +${e.crystals} · +${e.xp} XP each</p>
             <p class="w-dim">Trials are repeatable — higher tiers pay more.</p>`);
          break;
        case 'wave': toast(`⚔️ Wave ${e.wave}/${e.total}!`); break;
        case 'quest': toast(`📜 New objective: <b>${esc(e.quest.stage.name)}</b>`); break;
        case 'all-clear':
          dialog('✨ The Story... For Now',
            `<p class="w-story">Every arc the anime has told is cleared. Roam, run trials,
             farm camps, and summon to your heart's content.</p>`);
          break;
        case 'discover': toast(`◈ Waypoint discovered: <b>${esc(e.region.name)}</b>`); break;
        case 'joined': break;
        case 'loot': if (e.crystals >= 3) toast(`💎 +${e.crystals}`); break;
        case 'retreat': toast('You fled — the fight resets.'); break;
        case 'rbd': showRbd(e.det); break;
        case 'switch': if (e.auto) toast(`${esc(D().charById[e.id].name)} takes the field!`); break;
        case 'down': toast(`💀 ${esc(D().charById[e.id].name)} is down!`); flashVignette(); break;
        case 'no-target': toast('No target in range.'); break;
        case 'dmg': if (e.side === 'player') flashVignette(); break;
        case 'shake': document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); break;
        case 'sfx': if (RZ.SFX && RZ.SFX[e.name]) RZ.SFX[e.name](); break;
        default: break;
      }
    }
  }

  let vigT = null;
  function flashVignette() {
    const v = $('#vignette');
    v.style.opacity = 0.85;
    clearTimeout(vigT);
    vigT = setTimeout(() => { v.style.opacity = 0; }, 240);
  }

  // ------------------------------------------------------------ per-frame
  function update(w) {
    W = w;
    const q = RZ.World.questInfo(w);
    const trialLine = w.trial ? `<span>⚔️ ${esc(w.trial.def.name)} — wave ${w.trial.wave + 1}/3</span>` : '';
    $('#quest-tracker').innerHTML = q
      ? `<small>Chapter ${q.chapter.num} — ${esc(q.chapter.title)}</small>
         <b>${q.stage.boss ? '👑 ' : '◆ '}${esc(q.stage.name)}</b>
         <span>${q.dist}m ${w.enc ? '· <i>in battle</i>' : '· follow the golden beacon'}</span>${trialLine}`
      : `<b>✨ All stages clear</b><span>Free roam — trials and camps await</span>${trialLine}`;

    const active = RZ.World.activeId(w);
    $('#party-bar').innerHTML = w.partyIds.map((id, i) => {
      const c = D().charById[id];
      const mx = RZ.World.maxHp(id, w.det);
      const frac = Math.max(0, Math.min(1, w.hp[id] / mx));
      const en = w.energy[id];
      return `<div class="pf ${id === active ? 'active' : ''} ${w.hp[id] <= 0 ? 'down' : ''}">
        <span class="pf-key">${i + 1}</span>
        <span class="pf-icon">${c.icon}</span>
        <div class="pf-bars">
          <div class="pf-hp"><div style="width:${frac * 100}%"></div></div>
          <div class="pf-en"><div style="width:${en}%"></div></div>
        </div>
      </div>`;
    }).join('');

    const s = RZ.World.activeStats(w);
    const cd = w.skillCd[active];
    const cdMax = s.skill.cd * RZ.WDATA.WORLD.skillCdMult;
    const en = w.energy[active];
    $('#skill-bar').innerHTML = `
      <div class="sk ${w.player.dodgeCd > 0 ? 'cooling' : ''}"><b>CTRL</b><span>Dodge</span></div>
      <div class="sk ${cd > 0 ? 'cooling' : ''}">
        <div class="sk-cd" style="height:${cdMax ? (cd / cdMax) * 100 : 0}%"></div>
        <b>E</b><span>${esc(s.skill.name)}</span>${cd > 0 ? `<i>${cd.toFixed(1)}</i>` : ''}
      </div>
      <div class="sk burst ${en < 100 ? 'cooling' : 'ready'}">
        <div class="sk-cd" style="height:${100 - en}%"></div>
        <b>Q</b><span>${esc(s.burst.name)}</span>${en < 100 ? `<i>${Math.floor(en)}</i>` : ''}
      </div>
      ${w.shield > 0 ? `<div class="sk shield"><b>🛡️</b><span>${Math.round(w.shield)}</span></div>` : ''}`;

    // stamina
    const stPct = (w.stamina / RZ.WDATA.WORLD.maxStamina) * 100;
    const sw = $('#stamina-wrap');
    sw.style.opacity = stPct > 99.5 ? 0 : 1;
    $('#stamina-fill').style.width = stPct + '%';
    $('#stamina-fill').style.background = stPct < 25 ? '#d45c5c' : '#aee07e';

    // boss bar
    const boss = w.enemies.find((e) => e.boss && !e.dead && (e.enc || e.trial));
    if (boss) {
      $('#boss-bar').classList.remove('hidden');
      $('#boss-name').textContent = boss.name + (boss.breather ? '  — GUARD DOWN!' : '');
      $('#boss-fill').style.width = (boss.hp / boss.maxhp * 100) + '%';
    } else $('#boss-bar').classList.add('hidden');

    // trial interact prompt
    const tr = RZ.World.nearTrial(w);
    const ip = $('#interact-prompt');
    if (tr && !w.trial && !w.enc) {
      ip.classList.remove('hidden');
      ip.innerHTML = `<b>F</b> — ${esc(tr.name)}`;
    } else ip.classList.add('hidden');

    // npc barks
    updateBarks(w);
    drawMinimap(w);
  }

  function updateBarks(w) {
    const bark = $('#npc-bark');
    if (performance.now() < barkUntil) return;
    bark.classList.add('hidden');
    if (!RZ.WRender || !RZ.WRender.npcPositions) return;
    for (const n of RZ.WRender.npcPositions()) {
      const d = Math.hypot(n.x - w.player.x, n.z - w.player.z);
      const last = barkCd.get(n.def) || -1e9;
      if (d < 5 && performance.now() - last > 30000) {
        barkCd.set(n.def, performance.now());
        barkUntil = performance.now() + 4600;
        bark.classList.remove('hidden');
        bark.innerHTML = `💬 ${esc(n.def.line)}`;
        break;
      }
    }
  }

  function drawMinimap(w) {
    if (!mapCtx || !RZ.WRender.minimap) return;
    const S = RZ.WDATA.WORLD.size;
    const px = (x) => (x / S + 0.5) * 200;
    mapCtx.drawImage(RZ.WRender.minimap, 0, 0);
    for (const id of w.waypoints) {
      const r = RZ.WDATA.REGIONS.find((x) => x.id === id);
      mapCtx.fillStyle = '#5fe8e8';
      mapCtx.fillRect(px(r.anchor[0]) - 2, px(r.anchor[1]) - 2, 4, 4);
    }
    mapCtx.fillStyle = '#c060e0';
    for (const t of RZ.WDATA.TRIALS) mapCtx.fillRect(px(t.x) - 2, px(t.z) - 2, 4, 4);
    const q = w.quest;
    if (q) {
      mapCtx.fillStyle = '#ffd97a';
      mapCtx.beginPath();
      mapCtx.arc(px(q.spot.x), px(q.spot.z), 3.5, 0, 7);
      mapCtx.fill();
    }
    mapCtx.fillStyle = '#ff6a5a';
    for (const e of w.enemies) {
      if (e.dead) continue;
      mapCtx.fillRect(px(e.x) - 1.5, px(e.z) - 1.5, 3, 3);
    }
    const p = w.player;
    mapCtx.save();
    mapCtx.translate(px(p.x), px(p.z));
    mapCtx.rotate(Math.PI - p.yaw); // triangle drawn pointing up; yaw 0 = +z = map-down
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -5); mapCtx.lineTo(3.5, 4); mapCtx.lineTo(-3.5, 4);
    mapCtx.closePath(); mapCtx.fill();
    mapCtx.restore();
  }

  RZ.WHud = {
    init, update, handleEvents, blocking, togglePause, travel, toggleSound, toggleOutfit,
    toast, dialog, startTrial,
    openSummon, closeSummon, pickBanner, doSummon,
  };
})();
