/* Re:Impact — game state, save/load, progression. */
(function () {
  const RZ = (globalThis.RZ = globalThis.RZ || {});
  const D = () => RZ.DATA;
  const SAVE_KEY = 'rezero-impact-save-v1';

  let S = null; // live state

  function freshState() {
    const roster = {};
    for (const id of D().FREE_STARTERS) roster[id] = { xp: 0, res: 0 };
    return {
      v: 1,
      crystals: D().START_CRYSTALS,
      roster,
      weapons: {},               // id -> count
      party: ['subaru'],
      pity: { limited5: 0, limited4: 0, standard5: 0, standard4: 0, guarantee: false },
      cleared: {},               // stageId -> true
      determination: {},         // stageId -> stacks (story retries)
      flags: {},
      lastDaily: null,
      settings: { sound: true },
      stats: { pulls: 0, battles: 0, fiveStars: 0 },
    };
  }

  function save() {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    } catch (e) { /* private mode etc. — play on without persistence */ }
  }

  function load() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) { S = JSON.parse(raw); return; }
      }
    } catch (e) { /* corrupted save -> fresh */ }
    S = freshState();
  }

  // ------------------------------------------------------------ leveling
  function levelFromXp(xp) {
    let lvl = 1, need = D().XP_CURVE(1), acc = 0;
    while (lvl < D().LEVEL_CAP && xp >= acc + need) {
      acc += need; lvl += 1; need = D().XP_CURVE(lvl);
    }
    return { lvl, into: xp - acc, need };
  }

  function armoryBonus() {
    let b = 0;
    for (const [id, count] of Object.entries(S.weapons)) {
      if (!D().weaponById[id] || count < 1) continue;
      b += D().ARMORY_UNIQUE + Math.min(5, count - 1) * D().ARMORY_REFINE;
    }
    return b;
  }

  // Full computed stats for an owned character (det = determination stacks).
  function charStats(id, det) {
    const c = D().charById[id];
    const own = S.roster[id];
    if (!c || !own) return null;
    const { lvl } = levelFromXp(own.xp);
    const lvlMult = D().LVL_STAT(lvl);
    const resMult = 1 + own.res * D().RES_BONUS;
    const armMult = 1 + armoryBonus();
    const detMult = 1 + (det || 0) * D().DETERMINATION_BONUS;
    const hp = Math.round(c.base.hp * lvlMult * resMult * armMult * detMult);
    const atk = Math.round(c.base.atk * lvlMult * resMult * armMult * detMult);
    const def = Math.round(c.base.def * lvlMult);
    return {
      id, name: c.name, icon: c.icon, element: c.element, rarity: c.rarity,
      lvl, res: own.res, hp, atk, def,
      spd: c.base.spd, crit: c.base.crit,
      skill: c.skill, burst: c.burst, passive: c.passive || null,
      power: Math.round(atk * 2 + hp / 8 + def),
    };
  }

  function grantChar(id) {
    if (S.roster[id]) return { dup: true, ...grantDupe(id) };
    S.roster[id] = { xp: 0, res: 0 };
    return { dup: false };
  }

  function grantDupe(id) {
    const own = S.roster[id];
    if (own.res < D().GACHA.maxResonance) { own.res += 1; return { res: own.res }; }
    S.crystals += D().GACHA.dupCrystals;
    return { refund: D().GACHA.dupCrystals };
  }

  // ------------------------------------------------------------ gacha glue
  function summon(bannerId, count) {
    const banner = D().bannerById[bannerId];
    const cost = D().GACHA.costSingle * count;
    if (!banner || S.crystals < cost) return null;
    S.crystals -= cost;
    const results = [];
    for (let i = 0; i < count; i++) {
      const r = RZ.Gacha.rollOne(banner, S.pity);
      const out = { ...r };
      if (r.type === 'char') {
        const g = grantChar(r.id);
        out.isNew = !g.dup;
        if (g.dup) Object.assign(out, g);
        if (r.rarity === 5) S.stats.fiveStars += 1;
      } else {
        const had = S.weapons[r.id] || 0;
        S.weapons[r.id] = had + 1;
        out.isNew = had === 0;
        out.refine = Math.min(5, S.weapons[r.id] - 1);
      }
      results.push(out);
    }
    S.stats.pulls += count;
    save();
    return results;
  }

  // ------------------------------------------------------------ party
  function setParty(ids) {
    const seen = new Set();
    S.party = ids.filter((id) => S.roster[id] && !seen.has(id) && seen.add(id)).slice(0, 4);
    if (!S.party.length) S.party = ['subaru'];
    save();
  }

  // ------------------------------------------------------------ story
  function stageById(stageId) {
    for (const ch of D().STORY) {
      const s = ch.stages.find((x) => x.id === stageId);
      if (s) return { chapter: ch, stage: s };
    }
    return null;
  }

  function chapterUnlocked(ch) {
    const idx = D().STORY.indexOf(ch);
    if (idx <= 0) return true;
    const prev = D().STORY[idx - 1];
    return prev.stages.every((s) => S.cleared[s.id]);
  }

  function stageUnlocked(stageId) {
    const found = stageById(stageId);
    if (!found) return false;
    const { chapter, stage } = found;
    if (!chapterUnlocked(chapter)) return false;
    const i = chapter.stages.indexOf(stage);
    return i === 0 || !!S.cleared[chapter.stages[i - 1].id];
  }

  // Rewards + free character joins. Returns summary for the UI.
  function onStageVictory(stageId, combatResult) {
    const { chapter, stage } = stageById(stageId);
    const first = !S.cleared[stageId];
    S.cleared[stageId] = true;
    S.determination[stageId] = 0;
    S.stats.battles += 1;

    let crystals = (combatResult && combatResult.lootCrystals) || 0;
    if (first) crystals += stage.crystals;
    S.crystals += crystals;

    const xpEach = Math.round(stage.xp * (first ? 1 : 0.4));
    for (const id of S.party) if (S.roster[id]) S.roster[id].xp += xpEach;

    let joined = null;
    if (first && stage.join && !S.roster[stage.join]) {
      grantChar(stage.join);
      joined = stage.join;
    }
    save();
    return { first, crystals, xpEach, joined, outro: stage.outro, chapter };
  }

  function onStageDefeat(stageId) {
    S.stats.battles += 1;
    const cur = S.determination[stageId] || 0;
    S.determination[stageId] = Math.min(3, cur + 1);
    save();
    return S.determination[stageId];
  }

  // Builds combat-ready ally specs for the current party for a given stage.
  function buildParty(stageId) {
    const det = (stageId && S.determination[stageId]) || 0;
    return S.party.filter((id) => S.roster[id]).map((id) => charStats(id, det));
  }

  // ------------------------------------------------------------ daily
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function dailyAvailable() { return S.lastDaily !== todayStr(); }
  function claimDaily() {
    if (!dailyAvailable()) return 0;
    S.lastDaily = todayStr();
    S.crystals += D().DAILY_CRYSTALS;
    save();
    return D().DAILY_CRYSTALS;
  }

  // ------------------------------------------------------------ export/import
  function exportSave() {
    const json = JSON.stringify(S);
    if (typeof btoa !== 'undefined') return btoa(unescape(encodeURIComponent(json)));
    return Buffer.from(json, 'utf8').toString('base64');
  }
  function importSave(code) {
    try {
      const json = typeof atob !== 'undefined'
        ? decodeURIComponent(escape(atob(code.trim())))
        : Buffer.from(code.trim(), 'base64').toString('utf8');
      const parsed = JSON.parse(json);
      if (!parsed || parsed.v !== 1 || !parsed.roster) return false;
      S = parsed;
      save();
      return true;
    } catch (e) { return false; }
  }

  function resetSave() { S = freshState(); save(); }

  RZ.Game = {
    get state() { return S; },
    init() { load(); save(); },
    save, freshState, resetSave, exportSave, importSave,
    levelFromXp, charStats, armoryBonus,
    grantChar, summon, setParty,
    stageById, chapterUnlocked, stageUnlocked,
    onStageVictory, onStageDefeat, buildParty,
    dailyAvailable, claimDaily,
  };
})();
