/* Re:Impact World — map layout, stage placement, tuning constants, character looks. */
(function () {
  const RZ = (globalThis.RZ = globalThis.RZ || {});

  const WORLD = {
    size: 2400,            // world spans [-1200, 1200] on x and z
    waterY: 1.6,
    edgeStart: 980,        // mountains rise beyond this radius
    playerSpeed: 7.2,
    sprintMult: 1.65,
    dodgeSpeed: 13,
    dodgeIframes: 0.45,
    dodgeCd: 0.95,
    attackRate: 0.55,      // seconds per swing
    attackRange: 2.8,
    attackArc: 0.25,       // dot() threshold
    skillCdMult: 2.2,      // turn-cd → seconds
    boltSpeed: 26,
    enemyHpScale: 1.25,    // converts menu HP to real-time HP
    playerHpScale: 3.0,
    regenDelay: 6, regenRate: 0.045,
    energyMelee: 6, energySkill: 14, energyHurt: 5,
    aggroRadius: 16, leashRadius: 70,
    encLeash: 130,         // fleeing this far from a story fight resets it
    encounterRadius: 22,   // arriving this close to the objective starts it
    waypointRadius: 5,
    mobRespawn: 45,
    saveEvery: 10,
  };

  // ------------------------------------------------------------ regions
  const REGIONS = [
    { id: 'capital',    name: 'Capital of Lugunica',  anchor: [-700,  600], h: 8,  kind: 'city',   tree: 0.06, tint: [0.78, 0.72, 0.58] },
    { id: 'mansion',    name: 'Roswaal Manor',        anchor: [-150,  350], h: 10, kind: 'manor',  tree: 0.45, tint: [0.45, 0.62, 0.38] },
    { id: 'forest',     name: 'Mathers Forest',       anchor: [ 100,   80], h: 12, kind: 'forest', tree: 1.0,  tint: [0.30, 0.48, 0.28] },
    { id: 'plains',     name: 'Liphas Plains',        anchor: [ 450,  500], h: 6,  kind: 'plains', tree: 0.12, tint: [0.55, 0.68, 0.36] },
    { id: 'cave',       name: 'Witch Cult Hideout',   anchor: [ 350, -200], h: 13, kind: 'cave',   tree: 0.55, tint: [0.42, 0.42, 0.36] },
    { id: 'sanctuary',  name: 'The Sanctuary',        anchor: [ 800, -500], h: 18, kind: 'snow',   tree: 0.35, tint: [0.82, 0.85, 0.88] },
    { id: 'priestella', name: 'Priestella',           anchor: [-600, -700], h: -3, kind: 'water',  tree: 0.0,  tint: [0.50, 0.56, 0.60] },
  ];

  // Roads: polylines between anchors (terrain flattens + recolors along them)
  const ROADS = [
    [[-700, 600], [-400, 470], [-150, 350]],
    [[-150, 350], [100, 80]],
    [[-150, 350], [200, 420], [450, 500]],
    [[450, 500], [400, 150], [350, -200]],
    [[350, -200], [560, -350], [800, -500]],
    [[-700, 600], [-680, 100], [-560, -400], [-520, -560]],
  ];

  // ------------------------------------------------------------ stage placement
  // Each story stage from DATA.STORY gets a physical spot. Boss arenas sit at
  // landmark features; some quests deliberately send you back across the map.
  const STAGE_SPOTS = {
    c1s1: { x: -646, z: 536, region: 'capital' },
    c1s2: { x: -566, z: 478, region: 'capital' },
    c1s3: { x: -512, z: 424, region: 'capital' },
    c1s4: { x: -494, z: 386, region: 'capital' },   // loot house — Elsa
    c2s1: { x:  -44, z: 204, region: 'forest' },
    c2s2: { x:   34, z: 142, region: 'forest' },
    c2s3: { x:   92, z:  78, region: 'forest' },
    c2s4: { x:  152, z:  16, region: 'forest' },    // alpha arena
    c3s1: { x: -626, z: 486, region: 'capital' },
    c3s2: { x: -784, z: 668, region: 'capital' },   // knights' barracks
    c3s3: { x: -322, z: 302, region: 'mansion' },
    c3s4: { x: -204, z: 264, region: 'mansion' },
    c4s1: { x:  346, z: 432, region: 'plains' },
    c4s2: { x:  452, z: 502, region: 'plains' },
    c4s3: { x:  566, z: 592, region: 'plains' },    // great flower tree — Whale
    c5s1: { x:  282, z: -138, region: 'cave' },
    c5s2: { x:  342, z: -202, region: 'cave' },
    c5s3: { x:  424, z: -262, region: 'cave' },     // cave mouth — Petelgeuse
    c6s1: { x:  722, z: -424, region: 'sanctuary' },
    c6s2: { x:  792, z: -502, region: 'sanctuary' },
    c6s3: { x: -172, z: 332, region: 'mansion' },   // Elsa returns — back at the manor
    c6s4: { x:  872, z: -562, region: 'sanctuary' },// lion arena
    c7s1: { x: -524, z: -618, region: 'priestella' },
    c7s2: { x: -584, z: -688, region: 'priestella' },
    c7s3: { x: -662, z: -738, region: 'priestella' },
    c7s4: { x: -722, z: -796, region: 'priestella' },
  };

  // ------------------------------------------------------------ walkable platforms (Priestella decks & bridges)
  // {x, z, w, d, y} — axis-aligned, walkable top at height y
  const PLATFORMS = [
    { x: -505, z: -582, w: 14, d: 140, y: 2.6 },  // entry bridge (reaches dry shore)
    { x: -524, z: -618, w: 44, d: 40, y: 2.6 },   // gate deck (c7s1)
    { x: -560, z: -656, w: 16, d: 46, y: 2.6 },
    { x: -584, z: -688, w: 56, d: 48, y: 2.6 },   // plaza (c7s2)
    { x: -626, z: -714, w: 18, d: 40, y: 2.6 },
    { x: -662, z: -738, w: 52, d: 44, y: 2.6 },   // square (c7s3)
    { x: -694, z: -768, w: 16, d: 40, y: 2.6 },
    { x: -722, z: -796, w: 60, d: 52, y: 2.6 },   // waterfront (c7s4)
  ];

  // ------------------------------------------------------------ open-world mob camps
  // mult scales enemy stats (roughly matches nearby chapter difficulty)
  const MOB_CAMPS = [
    { x: -600, z: 380, key: 'thug',    n: 3, mult: 1.0 },
    { x: -420, z: 440, key: 'tough',   n: 3, mult: 1.0 },
    { x: -260, z: 300, key: 'pup',     n: 4, mult: 1.2 },
    { x:  -60, z: 260, key: 'pup',     n: 3, mult: 1.4 },
    { x:   60, z: 180, key: 'ulgarm',  n: 3, mult: 1.5 },
    { x:  180, z:  90, key: 'ulgarm',  n: 3, mult: 1.8 },
    { x:  240, z: 380, key: 'tough',   n: 3, mult: 1.8 },
    { x:  380, z: 320, key: 'wraith',  n: 2, mult: 2.4 },
    { x:  520, z: 420, key: 'wraith',  n: 3, mult: 2.8 },
    { x:  340, z:  -60, key: 'cultist', n: 3, mult: 3.0 },
    { x:  420, z: -160, key: 'fanatic', n: 3, mult: 3.4 },
    { x:  600, z: -340, key: 'shadow',  n: 2, mult: 4.0 },
    { x:  740, z: -440, key: 'rabbit',  n: 5, mult: 4.2 },
    { x:  860, z: -480, key: 'mabeast', n: 2, mult: 4.4 },
    { x: -560, z: -300, key: 'cultist', n: 3, mult: 4.6 },
    { x: -540, z: -480, key: 'fanatic', n: 4, mult: 5.0 },
  ];

  // ------------------------------------------------------------ character looks & combat style
  // ranged chars fire bolts for their normal attack; others swing melee
  const RANGED = ['emilia', 'beatrice', 'roswaal', 'puck', 'echidna', 'petelgeuse', 'anastasia', 'meili', 'liliana', 'otto', 'petra', 'ferris'];

  // [body, accent/hair, weapon: 'sword'|'staff'|'flail'|'claw'|'knife'|'fist']
  const LOOKS = {
    subaru:    ['#2b2b30', '#e07820', 'sword'],
    emilia:    ['#e8e4f0', '#c9b8e8', 'staff'],
    rem:       ['#3a3f52', '#5b8fd4', 'flail'],
    ram:       ['#3a3f52', '#e89bb8', 'staff'],
    puck:      ['#cfd8e8', '#8fb8e8', 'staff'],
    beatrice:  ['#e8d8c0', '#e8c060', 'staff'],
    roswaal:   ['#2a2a48', '#8060c0', 'staff'],
    wilhelm:   ['#30343c', '#c8ccd4', 'sword'],
    crusch:    ['#2c4434', '#7a9a60', 'sword'],
    julius:    ['#3c3050', '#a890d8', 'sword'],
    priscilla: ['#a83838', '#e8a040', 'sword'],
    ferris:    ['#3858a0', '#d8a850', 'staff'],
    reinhard:  ['#404880', '#d04040', 'sword'],
    echidna:   ['#f0f0f0', '#e0e0e8', 'staff'],
    petelgeuse:['#283028', '#508050', 'fist'],
    felt:      ['#704848', '#e8d060', 'knife'],
    otto:      ['#586048', '#a8a090', 'staff'],
    rom:       ['#605848', '#b0a890', 'fist'],
    petra:     ['#a05858', '#c87850', 'staff'],
    frederica: ['#3c5040', '#d8c878', 'claw'],
    garfiel:   ['#705840', '#e8d060', 'claw'],
    ricardo:   ['#684830', '#a87848', 'sword'],
    mimi:      ['#c87040', '#e8a058', 'staff'],
    anastasia: ['#6048a0', '#c0a8e8', 'staff'],
    al:        ['#383838', '#787878', 'sword'],
    meili:     ['#486078', '#88a8d0', 'staff'],
    elsa:      ['#282030', '#9048a0', 'knife'],
    liliana:   ['#a87858', '#e8c890', 'staff'],
    kadomon:   ['#804838', '#c86848', 'fist'],
  };

  // enemy visual archetype: humanoid | beast | wraith | whale (renderer hint)
  const ENEMY_LOOKS = {
    thug: ['humanoid', '#7a5a48'], tough: ['humanoid', '#6a6a52'], assassin: ['humanoid', '#3a3548'],
    pup: ['beast', '#5a4a3a'], ulgarm: ['beast', '#3a3a44'], cultist: ['humanoid', '#3c3050'],
    finger: ['humanoid', '#48305c'], wraith: ['wraith', '#aab4c8'], fanatic: ['humanoid', '#503060'],
    shadow: ['wraith', '#202028'], rabbit: ['beast', '#d8d8e0'], mabeast: ['beast', '#4c3828'],
    elsa_boss: ['humanoid', '#282030'], giant_ulgarm: ['beast', '#23232c'], julius_boss: ['humanoid', '#3c3050'],
    whale: ['whale', '#dde4ee'], petelgeuse_boss: ['humanoid', '#283028'], elsa_returns: ['humanoid', '#282030'],
    guiltylowe: ['beast', '#c8a040'], sirius: ['humanoid', '#503028'], regulus: ['humanoid', '#e8e8e8'],
    capella: ['beast', '#48202c'],
  };

  // enemies that cast bolts instead of pure melee
  const CASTERS = ['cultist', 'fanatic', 'wraith', 'shadow', 'finger', 'sirius'];

  RZ.WDATA = { WORLD, REGIONS, ROADS, STAGE_SPOTS, PLATFORMS, MOB_CAMPS, RANGED, LOOKS, ENEMY_LOOKS, CASTERS };
})();
