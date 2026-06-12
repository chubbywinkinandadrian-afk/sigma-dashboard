/* Re:Impact — UI layer. All markup is generated here; screens render into #screen. */
(function () {
  const RZ = (globalThis.RZ = globalThis.RZ || {});
  const D = () => RZ.DATA;
  const G = () => RZ.Game;

  let tab = 'home';
  let currentBanner = 'sword-saint';
  let summonResults = null, summonIdx = 0;
  let selectedTarget = 0;
  let currentStageId = null;
  let battleEnded = false;
  let pickerSlot = 0;

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ------------------------------------------------------------ shared bits
  function stars(n) { return '<span class="stars">' + '★'.repeat(n) + '</span>'; }

  function elBadge(el) {
    const e = D().ELEMENTS[el];
    if (!e) return '';
    return `<span class="el-badge el-${el}">${e.glyph} ${e.name}</span>`;
  }

  function charCard(cs, extraCls, onclick) {
    return `
      <div class="char-card r${cs.rarity} ${extraCls || ''}" ${onclick ? `onclick="${onclick}"` : ''}>
        <div class="portrait el-bg-${cs.element}"><span>${cs.icon}</span></div>
        <div class="cc-name">${esc(cs.name)}</div>
        <div class="cc-sub">${stars(cs.rarity)} ${elBadge(cs.element)}</div>
        <div class="cc-lvl">Lv.${cs.lvl}${cs.res ? ` · R${cs.res}` : ''}</div>
      </div>`;
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('show'), 20);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2600);
  }

  function modal(html, cls) {
    closeModal();
    const m = document.createElement('div');
    m.className = 'modal-back ' + (cls || '');
    m.id = 'modal';
    m.innerHTML = `<div class="modal">${html}</div>`;
    $('#overlay-root').appendChild(m);
  }
  function closeModal() { const m = $('#modal'); if (m) m.remove(); }

  // ------------------------------------------------------------ shell
  function boot() {
    G().init();
    $('#app').innerHTML = `
      <header id="topbar"></header>
      <main id="screen"></main>
      <nav id="nav">
        ${[['home', '🏠', 'Home'], ['story', '📖', 'Story'], ['summon', '✨', 'Summon'],
           ['chars', '👥', 'Characters'], ['party', '⚔️', 'Party'], ['armory', '🗡️', 'Armory']]
          .map(([id, ic, label]) => `<button id="nav-${id}" onclick="RZ.UI.switchTab('${id}')"><span>${ic}</span>${label}</button>`).join('')}
      </nav>
      <div id="overlay-root"></div>
      <div id="battle" class="hidden"></div>
      <div id="toasts"></div>`;
    switchTab('home');
    if (!G().state.flags.onboarded) {
      G().state.flags.onboarded = true; G().save();
      modal(`
        <h2>— Re:Impact —</h2>
        <p class="story-text">You blink, and the convenience store is gone.</p>
        <p class="story-text">Welcome to the Kingdom of Lugunica. You have no powers, no money, and no idea
        what is going on — but the gacha gods have granted you <b>3,200 Witch Crystals</b> and one (1)
        tracksuit-wearing protagonist.</p>
        <p class="story-text">Clear the <b>Story</b> to earn crystals, <b>Summon</b> allies from across the
        anime, and build a party of four. If everyone dies... well. Subaru has a way of dealing with that.</p>
        <button class="btn gold" onclick="RZ.UI.closeModal()">Begin — from Zero</button>`);
    }
  }

  function renderTopbar() {
    const s = G().state;
    $('#topbar').innerHTML = `
      <div class="logo">Re:<span>IMPACT</span><small>a Re:Zero fan gacha</small></div>
      <div class="top-right">
        <span class="currency">💎 ${s.crystals.toLocaleString()}</span>
        <button class="icon-btn" title="Settings" onclick="RZ.UI.openSettings()">⚙️</button>
      </div>`;
  }

  function switchTab(t) {
    tab = t;
    RZ.SFX.click();
    document.querySelectorAll('#nav button').forEach((b) => b.classList.remove('active'));
    const btn = $('#nav-' + t); if (btn) btn.classList.add('active');
    renderTopbar();
    ({ home: renderHome, story: renderStory, summon: renderSummon, chars: renderChars, party: renderParty, armory: renderArmory }[t] || renderHome)();
  }

  // ------------------------------------------------------------ home
  function renderHome() {
    const s = G().state;
    const total = D().STORY.reduce((a, c) => a + c.stages.length, 0);
    const done = Object.keys(s.cleared).length;
    const owned = Object.keys(s.roster).length;
    $('#screen').innerHTML = `
      <div class="hero">
        <h1>Re:<span>IMPACT</span></h1>
        <p class="tagline">Starting Life as a Gacha Game in Another World</p>
      </div>
      <a class="world-cta" href="world.html">
        <span class="wc-icon">🗺️</span>
        <span><b>Explore Lugunica — 3D Open World</b>
        <small>Travel the map, fight in real time, and clear the same story on foot.
        Roster, summons and progress are shared.</small></span>
        <span class="wc-go">▶</span>
      </a>
      <div class="panel">
        <h3>📅 Daily Blessing</h3>
        <p>The Dragon's covenant provides. Probably.</p>
        <button class="btn gold" ${G().dailyAvailable() ? '' : 'disabled'} onclick="RZ.UI.claimDaily()">
          ${G().dailyAvailable() ? `Claim ${D().DAILY_CRYSTALS} 💎` : 'Claimed — return tomorrow'}
        </button>
      </div>
      <div class="panel">
        <h3>📜 Your Journey</h3>
        <div class="stat-row"><span>Story progress</span><b>${done} / ${total} stages</b></div>
        <div class="stat-row"><span>Characters met</span><b>${owned} / ${D().CHARACTERS.length}</b></div>
        <div class="stat-row"><span>Total summons</span><b>${s.stats.pulls}</b></div>
        <div class="stat-row"><span>5★ obtained</span><b>${s.stats.fiveStars}</b></div>
      </div>
      <div class="panel">
        <h3>💡 Tips from the Roswaal Mansion</h3>
        <ul class="tips">
          <li>Mix elements in your party — hitting an existing aura triggers <b>reactions</b> (Steam Burst, Eclipse, Curse...).</li>
          <li>Yin + Yang on the same target = <b>Eclipse</b>, the biggest multiplier in the game.</li>
          <li>Keep <b>Subaru</b> in the party: once per battle, a full wipe triggers <b>Return by Death</b>.</li>
          <li>The 5★ pity carries between sessions. The witch remembers.</li>
        </ul>
      </div>
      <p class="disclaimer">Unofficial, non-commercial fan project. Re:Zero belongs to Tappei Nagatsuki / KADOKAWA;
      the "gacha RPG" formula is affectionately borrowed from a certain open-world game. No assets from either were used.</p>`;
  }

  function claimDaily() {
    const got = G().claimDaily();
    if (got) { RZ.SFX.reveal4(); toast(`💎 +${got} Witch Crystals!`); }
    renderTopbar(); renderHome();
  }

  // ------------------------------------------------------------ summon
  function renderSummon() {
    const s = G().state;
    const banner = D().bannerById[currentBanner];
    const key = RZ.Gacha.pityKey(banner);
    const feat5 = banner.featured5 ? D().charById[banner.featured5] : null;
    const f4 = (banner.featured4 || []).map((id) => D().charById[id]);
    $('#screen').innerHTML = `
      <div class="banner-tabs">
        ${D().BANNERS.map((b) => `<button class="banner-tab ${b.id === currentBanner ? 'active' : ''}"
          onclick="RZ.UI.selectBanner('${b.id}')">${esc(b.name)}</button>`).join('')}
      </div>
      <div class="banner-art" style="background:linear-gradient(135deg, ${banner.art.from}, ${banner.art.to})">
        <div class="banner-emoji">${banner.art.emoji}</div>
        <div class="banner-info">
          <h2>${esc(banner.name)}</h2>
          <p>${esc(banner.tagline)}</p>
          ${feat5 ? `<div class="featured">
              <div class="feat5">${feat5.icon} <b>${esc(feat5.name)}</b> ${stars(5)} <span class="rate-up">RATE UP</span></div>
              <div class="feat4">${f4.map((c) => `${c.icon} ${esc(c.name)}`).join(' · ')} ${stars(4)}</div>
            </div>`
          : `<div class="featured"><div class="feat4">All standard 5★ and 4★ characters available.</div></div>`}
        </div>
      </div>
      <div class="pity-row">
        <span>5★ pity: <b>${s.pity[key + '5']}</b>/90</span>
        <span>4★ pity: <b>${s.pity[key + '4']}</b>/10</span>
        ${banner.type === 'limited' ? `<span>${s.pity.guarantee ? '🔒 Next 5★ is <b>guaranteed featured</b>' : '50/50 active'}</span>` : ''}
        <button class="link-btn" onclick="RZ.UI.showRates()">Rates ⓘ</button>
      </div>
      <div class="summon-btns">
        <button class="btn" onclick="RZ.UI.doSummon(1)">Summon ×1<small>💎 160</small></button>
        <button class="btn gold" onclick="RZ.UI.doSummon(10)">Summon ×10<small>💎 1600</small></button>
      </div>`;
  }

  function selectBanner(id) { currentBanner = id; RZ.SFX.click(); renderSummon(); }

  function showRates() {
    const r = RZ.Gacha.softPityInfo();
    modal(`
      <h2>Summoning Rites — Details</h2>
      <p>Base rates: <b>5★ ${(r.rate5 * 100).toFixed(1)}%</b>, <b>4★ ${(r.rate4 * 100).toFixed(1)}%</b>, the rest are 3★ armory pieces.</p>
      <p>Soft pity rises sharply from pull <b>${r.soft}</b>; a 5★ is guaranteed by pull <b>${r.hard}</b>.
      A 4★ or better is guaranteed every <b>${r.pity4}</b> pulls.</p>
      <p>On limited banners, your first 5★ has a 50% chance to be the featured character; losing the 50/50
      guarantees the next 5★ is featured. Standard and limited banners track pity separately.</p>
      <p>Duplicate characters raise <b>Resonance</b> (+4% ATK/HP each, up to R6); after that they refund 160 💎.</p>
      <button class="btn" onclick="RZ.UI.closeModal()">Close</button>`);
  }

  function doSummon(n) {
    const s = G().state;
    if (s.crystals < n * 160) { toast('Not enough Witch Crystals! Clear story stages to earn more.'); return; }
    const results = G().summon(currentBanner, n);
    if (!results) return;
    summonResults = results; summonIdx = 0;
    renderTopbar();
    closeModal();
    const top = Math.max(...results.map((r) => r.rarity));
    RZ.SFX.whoosh();
    const m = document.createElement('div');
    m.className = 'modal-back summon-anim r' + top;
    m.id = 'modal';
    m.innerHTML = `<div class="comet r${top}"></div><div class="anim-hint">✦</div>`;
    $('#overlay-root').appendChild(m);
    setTimeout(() => revealNext(), 1400);
  }

  function revealNext() {
    if (!summonResults) return;
    if (summonIdx >= summonResults.length) { showSummonSummary(); return; }
    const r = summonResults[summonIdx];
    summonIdx += 1;
    RZ.SFX['reveal' + r.rarity]();
    const isChar = r.type === 'char';
    const obj = isChar ? D().charById[r.id] : D().weaponById[r.id];
    modal(`
      <div class="reveal r${r.rarity}">
        <div class="reveal-portrait ${isChar ? 'el-bg-' + obj.element : 'weapon-bg'}">${obj.icon}</div>
        <h2>${esc(obj.name)}</h2>
        <div>${stars(r.rarity)} ${isChar ? elBadge(obj.element) : '<span class="el-badge">Armory</span>'}</div>
        ${isChar && obj.title ? `<p class="title-line">${esc(obj.title)}</p>` : ''}
        ${r.isNew ? '<div class="new-badge">NEW!</div>'
          : isChar ? `<div class="dup-badge">${r.res ? 'Resonance → R' + r.res : '+160 💎 (max resonance)'}</div>`
          : `<div class="dup-badge">Refinement +1</div>`}
        <div class="reveal-actions">
          <button class="btn" onclick="RZ.UI.revealNext()">${summonIdx >= summonResults.length ? 'Results' : 'Next ▸'}</button>
          ${summonIdx < summonResults.length ? '<button class="link-btn" onclick="RZ.UI.showSummonSummary()">Skip ≫</button>' : ''}
        </div>
      </div>`, 'reveal-back r' + r.rarity);
  }

  function showSummonSummary() {
    if (!summonResults) return;
    const items = summonResults.map((r) => {
      const isChar = r.type === 'char';
      const obj = isChar ? D().charById[r.id] : D().weaponById[r.id];
      return `<div class="mini-card r${r.rarity}">
        <div class="mini-icon ${isChar ? 'el-bg-' + obj.element : 'weapon-bg'}">${obj.icon}</div>
        <div class="mini-name">${esc(obj.name)}</div>
        <div>${stars(r.rarity)}</div>
        ${r.isNew ? '<div class="new-badge sm">NEW</div>' : ''}
      </div>`;
    }).join('');
    modal(`<h2>Summoning Results</h2><div class="summary-grid">${items}</div>
      <button class="btn gold" onclick="RZ.UI.endSummon()">Confirm</button>`);
  }

  function endSummon() { summonResults = null; closeModal(); renderSummon(); renderTopbar(); }

  // ------------------------------------------------------------ characters
  function renderChars() {
    const s = G().state;
    const owned = Object.keys(s.roster).map((id) => G().charStats(id, 0))
      .sort((a, b) => b.rarity - a.rarity || b.power - a.power);
    const notOwned = D().CHARACTERS.filter((c) => !s.roster[c.id]);
    $('#screen').innerHTML = `
      <h2 class="screen-title">Characters <small>${owned.length} met</small></h2>
      <div class="char-grid">
        ${owned.map((cs) => charCard(cs, '', `RZ.UI.openChar('${cs.id}')`)).join('')}
      </div>
      ${notOwned.length ? `<h3 class="screen-sub">Not yet met</h3>
        <div class="char-grid dim">
          ${notOwned.map((c) => `
            <div class="char-card locked r${c.rarity}">
              <div class="portrait el-bg-${c.element}"><span>❓</span></div>
              <div class="cc-name">???</div>
              <div class="cc-sub">${stars(c.rarity)} ${elBadge(c.element)}</div>
            </div>`).join('')}
        </div>` : ''}`;
  }

  function openChar(id) {
    const cs = G().charStats(id, 0);
    const c = D().charById[id];
    const own = G().state.roster[id];
    const { lvl, into, need } = G().levelFromXp(own.xp);
    modal(`
      <div class="char-detail">
        <div class="cd-head">
          <div class="portrait lg el-bg-${c.element}"><span>${c.icon}</span></div>
          <div>
            <h2>${esc(c.name)}</h2>
            <p class="title-line">${esc(c.title)}</p>
            <div>${stars(c.rarity)} ${elBadge(c.element)} ${own.res ? `<span class="res-badge">R${own.res}</span>` : ''}</div>
          </div>
        </div>
        <div class="xp-bar"><div style="width:${Math.min(100, (into / need) * 100)}%"></div>
          <span>Lv.${lvl} — ${into}/${need} XP</span></div>
        <div class="stat-grid">
          <div>❤️ HP <b>${cs.hp}</b></div><div>⚔️ ATK <b>${cs.atk}</b></div>
          <div>🛡️ DEF <b>${cs.def}</b></div><div>👟 SPD <b>${cs.spd}</b></div>
          <div>🎯 CRIT <b>${cs.crit}%</b></div><div>💪 Power <b>${cs.power}</b></div>
        </div>
        <div class="skill-box"><b>✨ ${esc(c.skill.name)}</b> <small>(skill, ${c.skill.cd}t cooldown)</small><p>${esc(c.skill.desc)}</p></div>
        <div class="skill-box"><b>💥 ${esc(c.burst.name)}</b> <small>(burst, 100 energy)</small><p>${esc(c.burst.desc)}</p></div>
        ${c.passive ? `<div class="skill-box rbd-box"><b>🕯️ ${esc(c.passive.name)}</b> <small>(passive)</small><p>${esc(c.passive.desc)}</p></div>` : ''}
        <p class="blurb">${esc(c.blurb)}</p>
        <p class="hint">Characters gain XP from story battles (40% on repeat clears).</p>
        <button class="btn" onclick="RZ.UI.closeModal()">Close</button>
      </div>`);
  }

  // ------------------------------------------------------------ party
  function renderParty() {
    const s = G().state;
    const slots = [0, 1, 2, 3].map((i) => {
      const id = s.party[i];
      if (!id) return `<div class="party-slot empty" onclick="RZ.UI.openSlotPicker(${i})"><span>＋</span><small>Empty</small></div>`;
      const cs = G().charStats(id, 0);
      return `<div class="party-slot" onclick="RZ.UI.openSlotPicker(${i})">${charCard(cs)}</div>`;
    }).join('');
    const power = s.party.reduce((a, id) => a + (G().charStats(id, 0) || { power: 0 }).power, 0);
    $('#screen').innerHTML = `
      <h2 class="screen-title">Party <small>tap a slot to change</small></h2>
      <div class="party-row">${slots}</div>
      <div class="panel"><div class="stat-row"><span>Team Power</span><b>⚡ ${power}</b></div>
      <p class="hint">Reactions trigger when one element hits another's aura — bring at least two different elements.
      Subaru's Return by Death only works if he is deployed.</p></div>`;
  }

  function openSlotPicker(i) {
    pickerSlot = i;
    const s = G().state;
    const owned = Object.keys(s.roster).map((id) => G().charStats(id, 0))
      .sort((a, b) => b.rarity - a.rarity || b.power - a.power);
    modal(`
      <h2>Choose slot ${i + 1}</h2>
      <div class="char-grid picker">
        ${owned.map((cs) => {
          const inParty = s.party.includes(cs.id) && s.party[i] !== cs.id;
          return charCard(cs, inParty ? 'locked' : '', inParty ? '' : `RZ.UI.pickPartyMember('${cs.id}')`);
        }).join('')}
      </div>
      ${s.party[i] ? `<button class="link-btn" onclick="RZ.UI.removeSlot()">Remove from slot</button>` : ''}
      <button class="btn" onclick="RZ.UI.closeModal()">Cancel</button>`);
  }

  function pickPartyMember(id) {
    const p = G().state.party.slice();
    p[pickerSlot] = id;
    G().setParty(p);
    RZ.SFX.click(); closeModal(); renderParty();
  }

  function removeSlot() {
    const p = G().state.party.slice();
    p.splice(pickerSlot, 1);
    G().setParty(p);
    closeModal(); renderParty();
  }

  // ------------------------------------------------------------ story
  function renderStory() {
    const s = G().state;
    $('#screen').innerHTML = `
      <h2 class="screen-title">Story <small>follow the anime, arc by arc</small></h2>
      ${D().STORY.map((ch) => {
        const unlocked = G().chapterUnlocked(ch);
        const done = ch.stages.filter((st) => s.cleared[st.id]).length;
        return `
        <div class="chapter ${unlocked ? '' : 'locked'}">
          <div class="ch-head">
            <h3>${unlocked ? '' : '🔒 '}Chapter ${ch.num} — ${esc(ch.title)}</h3>
            <span class="ch-progress">${done}/${ch.stages.length} · rec. Lv.${ch.recLvl}</span>
          </div>
          <p class="ch-intro">${esc(ch.intro)}</p>
          ${unlocked ? `<div class="stage-row">
            ${ch.stages.map((st) => {
              const su = G().stageUnlocked(st.id);
              const cleared = s.cleared[st.id];
              return `<button class="stage ${cleared ? 'cleared' : ''} ${su ? '' : 'locked'}"
                ${su ? `onclick="RZ.UI.openStage('${st.id}')"` : 'disabled'}>
                ${st.boss ? '👑 ' : ''}${esc(st.name)} ${cleared ? '✔' : ''}</button>`;
            }).join('')}
          </div>` : ''}
        </div>`;
      }).join('')}`;
  }

  function openStage(stageId) {
    const { chapter, stage } = G().stageById(stageId);
    const det = G().state.determination[stageId] || 0;
    const enemies = stage.enemies.map((wave, wi) =>
      `<div class="wave-preview"><small>Wave ${wi + 1}</small> ${wave.map((k) => {
        const e = D().ENEMIES[k];
        return `<span class="enemy-chip">${e.icon} ${esc(e.name)}</span>`;
      }).join('')}</div>`).join('');
    modal(`
      <h2>${stage.boss ? '👑 ' : ''}${esc(stage.name)}</h2>
      <p class="story-text">${esc(stage.intro)}</p>
      ${enemies}
      <div class="stat-row"><span>First-clear reward</span><b>💎 ${stage.crystals}</b></div>
      <div class="stat-row"><span>Party XP</span><b>${stage.xp} (40% on repeat)</b></div>
      ${det ? `<div class="stat-row det"><span>🔥 Determination</span><b>+${det * 8}% stats (from ${det} death${det > 1 ? 's' : ''})</b></div>` : ''}
      <div class="reveal-actions">
        <button class="btn gold" onclick="RZ.UI.startStage('${stageId}')">To Battle ⚔️</button>
        <button class="btn" onclick="RZ.UI.closeModal()">Retreat</button>
      </div>`);
  }

  // ------------------------------------------------------------ battle
  function startStage(stageId) {
    closeModal();
    currentStageId = stageId;
    battleEnded = false;
    selectedTarget = 0;
    const { chapter, stage } = G().stageById(stageId);
    const allies = G().buildParty(stageId);
    if (!allies.length) { toast('Your party is empty!'); return; }
    $('#battle').classList.remove('hidden');
    RZ.Combat.start({
      allies,
      waves: stage.enemies,
      mult: chapter.mult,
      delay: 420,
      onUpdate: battleUpdate,
      onEnd: (r) => battleEnd(r),
    });
  }

  function battleUpdate(st) {
    if (!st) return;
    const { stage } = G().stageById(currentStageId) || { stage: { name: 'Battle' } };
    const awaiting = st.awaiting;
    const enemies = st.enemies.map((e, i) => `
      <div class="unit enemy ${e.alive ? '' : 'dead'} ${i === selectedTarget ? 'targeted' : ''} ${e.boss ? 'boss' : ''}"
        onclick="RZ.UI.selectTarget(${i})">
        ${e.aura ? `<div class="aura el-${e.aura}">${D().ELEMENTS[e.aura].glyph}</div>` : ''}
        <div class="u-icon">${e.icon}</div>
        <div class="u-name">${esc(e.name)}</div>
        <div class="bar hp"><div style="width:${(e.hp / e.maxhp) * 100}%"></div></div>
        <div class="u-hp">${e.hp}/${e.maxhp}${e.shield ? ' 🛡️' : ''}</div>
      </div>`).join('');
    const allies = st.allies.map((a) => `
      <div class="unit ally ${a.alive ? '' : 'dead'} ${awaiting === a ? 'acting' : ''}">
        <div class="u-icon el-bg-${a.element}">${a.icon}</div>
        <div class="u-name">${esc(a.name)}</div>
        <div class="bar hp"><div style="width:${(a.hp / a.maxhp) * 100}%"></div></div>
        <div class="bar en"><div style="width:${a.energy}%"></div></div>
        <div class="u-hp">${a.hp}/${a.maxhp}${a.shield ? ' 🛡️' + a.shield : ''}</div>
      </div>`).join('');
    const logHtml = st.log.slice(-9).map((l) => `<div class="log-line ${l.cls}">${esc(l.text)}</div>`).join('');
    let actions = '';
    if (awaiting && !st.auto) {
      const a = awaiting;
      actions = `
        <div class="act-for">▶ <b>${esc(a.name)}</b>'s turn — target: ${esc((st.enemies[selectedTarget] || {}).name || '—')}</div>
        <div class="act-btns">
          <button class="btn" onclick="RZ.UI.battleAct('attack')">Attack</button>
          <button class="btn" ${a.cd > 0 ? 'disabled' : ''} onclick="RZ.UI.battleAct('skill')">
            ✨ ${esc(a.skill.name)}${a.cd > 0 ? ` (${a.cd}t)` : ''}</button>
          <button class="btn gold" ${a.energy < 100 ? 'disabled' : ''} onclick="RZ.UI.battleAct('burst')">
            💥 ${esc(a.burst.name)}${a.energy < 100 ? ` (${a.energy}/100)` : ''}</button>
        </div>`;
    } else if (!st.over) {
      actions = `<div class="act-for dim-text">${st.auto ? '🤖 Auto-battle engaged…' : '…'}</div>`;
    }
    $('#battle').innerHTML = `
      <div class="b-head">
        <span>${esc(stage.name)} — Wave ${st.wave + 1}/${st.waves.length} · Round ${st.round}</span>
        <span>
          <button class="link-btn" onclick="RZ.UI.toggleAuto()">${st.auto ? '🤖 Auto ON' : '🕹️ Manual'}</button>
          <button class="link-btn" onclick="RZ.UI.toggleSpeed()">⏩ ×${st.speed}</button>
          <button class="link-btn" onclick="RZ.UI.fleeBattle()">🏳️ Flee</button>
        </span>
      </div>
      <div class="b-enemies">${enemies}</div>
      <div class="b-log">${logHtml}</div>
      <div class="b-allies">${allies}</div>
      <div class="b-actions">${actions}</div>`;
  }

  function selectTarget(i) {
    const st = RZ.Combat.getState();
    if (!st || !st.enemies[i] || !st.enemies[i].alive) return;
    selectedTarget = i;
    battleUpdate(st);
  }

  function battleAct(type) {
    RZ.SFX.hit();
    RZ.Combat.act({ type, target: selectedTarget });
  }

  function toggleAuto() {
    const st = RZ.Combat.getState();
    RZ.Combat.setAuto(!st.auto);
    battleUpdate(RZ.Combat.getState());
  }

  function toggleSpeed() {
    const st = RZ.Combat.getState();
    RZ.Combat.setSpeed(st.speed === 1 ? 2 : 1);
    battleUpdate(st);
  }

  function fleeBattle() {
    if (battleEnded) return;
    battleEnded = true;
    $('#battle').classList.add('hidden');
    closeModal();
    toast('You withdrew from battle. No witch crystals were harmed.');
    switchTab('story');
  }

  function battleEnd(result) {
    if (battleEnded) return;
    battleEnded = true;
    if (result.victory) {
      RZ.SFX.victory();
      const r = G().onStageVictory(currentStageId, result);
      renderTopbar();
      const joined = r.joined ? D().charById[r.joined] : null;
      modal(`
        <h2>🏆 Victory!</h2>
        <p class="story-text">${esc(r.outro || 'The dust settles.')}</p>
        <div class="stat-row"><span>💎 Witch Crystals</span><b>+${r.crystals}</b></div>
        <div class="stat-row"><span>Party XP</span><b>+${r.xpEach} each</b></div>
        ${result.rbdUsed ? '<div class="stat-row det"><span>🕯️ Return by Death</span><b>used (mid-battle)</b></div>' : ''}
        ${joined ? `<div class="join-banner r${joined.rarity}">
            <div class="portrait el-bg-${joined.element}"><span>${joined.icon}</span></div>
            <div><b>${esc(joined.name)}</b> joins the party! ${stars(joined.rarity)}</div>
          </div>` : ''}
        <button class="btn gold" onclick="RZ.UI.closeBattle()">Continue</button>`);
    } else {
      RZ.SFX.rbd();
      const det = G().onStageDefeat(currentStageId);
      const m = document.createElement('div');
      m.className = 'modal-back rbd-overlay';
      m.id = 'modal';
      m.innerHTML = `
        <div class="rbd-inner">
          <div class="rbd-title">RETURN BY DEATH</div>
          <p class="rbd-text">The world lurches backward. Shadows reach for your heart, and a voice murmurs
          something you are not allowed to repeat.</p>
          <p class="rbd-text">Subaru remembers everything. <b>Determination +1</b> — the party returns to the
          moment before the battle with <b>+${det * 8}%</b> HP &amp; ATK${det >= 3 ? ' (max)' : ''}.</p>
          <div class="reveal-actions">
            <button class="btn gold" onclick="RZ.UI.retryStage()">Try Again ⏪</button>
            <button class="btn" onclick="RZ.UI.closeBattle()">Walk Away</button>
          </div>
        </div>`;
      $('#overlay-root').appendChild(m);
    }
  }

  function retryStage() {
    closeModal();
    startStage(currentStageId);
  }

  function closeBattle() {
    closeModal();
    $('#battle').classList.add('hidden');
    renderTopbar();
    switchTab('story');
  }

  // ------------------------------------------------------------ armory
  function renderArmory() {
    const s = G().state;
    const bonus = (G().armoryBonus() * 100).toFixed(2);
    $('#screen').innerHTML = `
      <h2 class="screen-title">Armory <small>3★ summons gather here</small></h2>
      <div class="panel"><div class="stat-row"><span>Collection bonus (team ATK &amp; HP)</span><b>+${bonus}%</b></div>
      <p class="hint">Each unique piece grants +1%; duplicates refine it (+0.25% each, up to +5 refinements).</p></div>
      <div class="char-grid">
        ${D().WEAPONS.map((w) => {
          const count = s.weapons[w.id] || 0;
          return `<div class="char-card r3 ${count ? '' : 'locked'}">
            <div class="portrait weapon-bg"><span>${count ? w.icon : '❓'}</span></div>
            <div class="cc-name">${count ? esc(w.name) : '???'}</div>
            <div class="cc-sub">${stars(3)}</div>
            ${count ? `<div class="cc-lvl">Refine +${Math.min(5, count - 1)}</div><div class="w-desc">${esc(w.desc)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>`;
  }

  // ------------------------------------------------------------ settings
  function openSettings() {
    const s = G().state;
    modal(`
      <h2>⚙️ Settings</h2>
      <label class="setting-row"><input type="checkbox" ${s.settings.sound ? 'checked' : ''}
        onchange="RZ.UI.toggleSound(this.checked)"> Sound effects</label>
      <h3>Save data</h3>
      <button class="btn" onclick="RZ.UI.showExport()">Export save</button>
      <button class="btn" onclick="RZ.UI.showImport()">Import save</button>
      <button class="btn danger" onclick="RZ.UI.confirmReset()">Reset everything</button>
      <p class="disclaimer">Unofficial fan project for personal play. Not affiliated with KADOKAWA, White Fox,
      Tappei Nagatsuki, or HoYoverse.</p>
      <button class="btn" onclick="RZ.UI.closeModal()">Close</button>`);
  }

  function toggleSound(v) { G().state.settings.sound = !!v; G().save(); }

  function showExport() {
    modal(`<h2>Export Save</h2><p class="hint">Copy this code somewhere safe.</p>
      <textarea class="save-box" readonly onclick="this.select()">${G().exportSave()}</textarea>
      <button class="btn" onclick="RZ.UI.openSettings()">Back</button>`);
  }

  function showImport() {
    modal(`<h2>Import Save</h2><p class="hint">Paste a save code. This overwrites current progress.</p>
      <textarea class="save-box" id="import-box" placeholder="paste code here"></textarea>
      <div class="reveal-actions">
        <button class="btn gold" onclick="RZ.UI.doImport()">Import</button>
        <button class="btn" onclick="RZ.UI.openSettings()">Back</button>
      </div>`);
  }

  function doImport() {
    const code = $('#import-box').value;
    if (G().importSave(code)) { toast('Save imported!'); closeModal(); switchTab('home'); }
    else toast('That code did not work.');
  }

  function confirmReset() {
    modal(`<h2>Reset everything?</h2>
      <p class="story-text">Unlike Subaru, you will NOT remember anything. All characters, crystals and
      progress will be gone.</p>
      <div class="reveal-actions">
        <button class="btn danger" onclick="RZ.UI.doReset()">Yes, Return to Zero</button>
        <button class="btn" onclick="RZ.UI.openSettings()">Cancel</button>
      </div>`);
  }

  function doReset() { G().resetSave(); closeModal(); boot(); toast('Starting life from zero. Again.'); }

  // ------------------------------------------------------------ exports
  RZ.UI = {
    boot, switchTab, closeModal, toast,
    claimDaily,
    selectBanner, showRates, doSummon, revealNext, showSummonSummary, endSummon,
    openChar,
    openSlotPicker, pickPartyMember, removeSlot,
    openStage, startStage,
    selectTarget, battleAct, toggleAuto, toggleSpeed, fleeBattle, retryStage, closeBattle,
    openSettings, toggleSound, showExport, showImport, doImport, confirmReset, doReset,
  };
})();
