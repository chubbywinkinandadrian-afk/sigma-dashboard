/* Re:Impact World — map layout, stage placement, tuning, character appearance specs. */
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
    jumpVel: 9.4, gravity: 24,
    climbSlope: 1.15,      // steeper than this can't be walked — climb it
    climbSpeed: 2.5,
    maxStamina: 100, sprintDrain: 9, climbDrain: 14, staminaRegen: 17,
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

  // ------------------------------------------------------------ trial dungeons (repeatable side content)
  // Tiered horde arenas: 2 mob waves + a boss wave at the marked obelisk.
  const TRIALS = [
    { id: 'sewers', name: 'Capital Sewer Depths', x: -758, z: 546,
      desc: 'Something has been collecting debts beneath the capital.',
      theme: ['thug', 'tough', 'assassin'], boss: 'elsa_boss', baseMult: 1.2 },
    { id: 'shrine', name: 'Forest Shrine of Trials', x: 64, z: 44,
      desc: 'An old shrine the mabeasts treat as a den. The forest watches.',
      theme: ['pup', 'ulgarm', 'cultist'], boss: 'giant_ulgarm', baseMult: 2.2 },
    { id: 'bonepit', name: 'Whalebone Pit', x: 556, z: 412,
      desc: 'A crater of old bones where the mist never fully clears.',
      theme: ['wraith', 'fanatic', 'mabeast'], boss: 'guiltylowe', baseMult: 3.4 },
    { id: 'tomb', name: 'Trial of the Tomb', x: 806, z: -548,
      desc: 'The tomb offers its ordeal to anyone arrogant enough to ask.',
      theme: ['shadow', 'finger', 'fanatic'], boss: 'petelgeuse_boss', baseMult: 4.8 },
  ];
  const TRIAL_TIERS = [
    { name: 'Trial I',   mult: 1.0, crystals: 120, xp: 500 },
    { name: 'Trial II',  mult: 1.6, crystals: 240, xp: 900 },
    { name: 'Trial III', mult: 2.4, crystals: 420, xp: 1500 },
  ];

  // ------------------------------------------------------------ enemy movesets
  // Move types implemented by wcore: melee, combo, slam, charge, volley, zones.
  // Omitted enemies default to [{t:'melee'}] (+ slam if boss).
  const MOVES = {
    assassin:    [{ t: 'combo', hits: 2, cd: 3 }, { t: 'melee' }],
    ulgarm:      [{ t: 'charge', cd: 6 }, { t: 'melee' }],
    rabbit:      [{ t: 'charge', cd: 4, speed: 22 }, { t: 'melee' }],
    mabeast:     [{ t: 'charge', cd: 6 }, { t: 'melee' }],
    cultist:     [{ t: 'volley', count: 1, cd: 2.4 }, { t: 'melee' }],
    fanatic:     [{ t: 'volley', count: 3, cd: 4 }, { t: 'melee' }],
    wraith:      [{ t: 'volley', count: 1, cd: 2.4 }, { t: 'zones', count: 1, cd: 7 }],
    shadow:      [{ t: 'volley', count: 1, cd: 3 }, { t: 'combo', hits: 2, cd: 5 }, { t: 'melee' }],
    finger:      [{ t: 'zones', count: 2, cd: 6 }, { t: 'melee' }],
    elsa_boss:   [{ t: 'combo', hits: 3, cd: 6 }, { t: 'melee' }],
    elsa_returns:[{ t: 'combo', hits: 3, cd: 5 }, { t: 'charge', cd: 8 }, { t: 'melee' }],
    giant_ulgarm:[{ t: 'charge', cd: 7 }, { t: 'slam', cd: 9 }, { t: 'melee' }],
    julius_boss: [{ t: 'volley', count: 6, cd: 8 }, { t: 'combo', hits: 2, cd: 5 }, { t: 'melee' }],
    whale:       [{ t: 'slam', cd: 9, r: 13 }, { t: 'zones', count: 3, cd: 7 }, { t: 'melee' }],
    petelgeuse_boss: [{ t: 'zones', count: 3, cd: 6 }, { t: 'volley', count: 3, cd: 5 }, { t: 'melee' }],
    guiltylowe:  [{ t: 'charge', cd: 7 }, { t: 'slam', cd: 9 }, { t: 'combo', hits: 2, cd: 5 }, { t: 'melee' }],
    sirius:      [{ t: 'zones', count: 2, cd: 6 }, { t: 'volley', count: 3, cd: 5 }, { t: 'slam', cd: 10 }, { t: 'melee' }],
    regulus:     [{ t: 'volley', count: 5, cd: 6, spread: 0.5 }, { t: 'slam', cd: 9 }, { t: 'melee' }],
    capella:     [{ t: 'zones', count: 4, cd: 7 }, { t: 'slam', cd: 9 }, { t: 'melee' }],
  };

  // ------------------------------------------------------------ character appearance
  // Original chibi geometry in canonical colors — built in wrender.buildChibi.
  // hairStyle: short|spiky|bob|long|wavy|ponytail|twintail|braids|drills|none
  // outfit:    plain|dress|maid|tracksuit|suit|coat
  const LOOKS = {
    subaru: { body: '#26262c', outfit2: '#e07820', hair: '#2a2426', eyes: '#7a5638', skin: '#f0d8c0',
      hairStyle: 'spiky', outfit: 'tracksuit', weapon: 'sword' },
    emilia: { body: '#ece9f6', outfit2: '#b9a8e0', hair: '#e3e0ee', eyes: '#9b7bd8', skin: '#f6e6d8',
      hairStyle: 'long', outfit: 'dress', weapon: 'staff', elfEars: true, flower: '#ffffff' },
    rem: { body: '#2e3344', outfit2: '#f2f2f2', hair: '#6fa8dc', eyes: '#5b8fd4', skin: '#f4dfcc',
      hairStyle: 'bob', outfit: 'maid', weapon: 'flail', headband: true, eyeCover: 'L' },
    ram: { body: '#2e3344', outfit2: '#f2f2f2', hair: '#e8a8c0', eyes: '#d86880', skin: '#f4dfcc',
      hairStyle: 'bob', outfit: 'maid', weapon: 'staff', headband: true, eyeCover: 'R' },
    puck: { cat: true, body: '#cfd8e8', outfit2: '#b8c4dc', hair: '#cfd8e8', eyes: '#3a3640', skin: '#cfd8e8' },
    beatrice: { body: '#d8536a', outfit2: '#f2e2c8', hair: '#e8c878', eyes: '#5a8ad8', skin: '#f6e6d8',
      hairStyle: 'drills', outfit: 'dress', weapon: 'staff', scale: 0.84 },
    roswaal: { body: '#2a2a48', outfit2: '#e8e4dc', hair: '#3d3db8', eyes: '#e8c840', eyes2: '#5a8ad8', skin: '#f0e2d4',
      hairStyle: 'bob', outfit: 'coat', weapon: 'staff', faceMark: '#7a4ab0' },
    wilhelm: { body: '#26262a', outfit2: '#9aa3b5', hair: '#c8ccd4', eyes: '#7a9ac8', skin: '#e8d2bc',
      hairStyle: 'short', outfit: 'suit', weapon: 'sword' },
    crusch: { body: '#3c5444', outfit2: '#e0ddd0', hair: '#4a6a50', eyes: '#d8a850', skin: '#f0dcc8',
      hairStyle: 'long', outfit: 'suit', weapon: 'sword' },
    julius: { body: '#3c3050', outfit2: '#c8b8e8', hair: '#9a86d0', eyes: '#d8c860', skin: '#f0dcc8',
      hairStyle: 'wavy', outfit: 'suit', weapon: 'sword' },
    priscilla: { body: '#b03848', outfit2: '#e8a040', hair: '#e8b060', eyes: '#d05858', skin: '#f6e2d0',
      hairStyle: 'long', outfit: 'dress', weapon: 'fan' },
    ferris: { body: '#4a6ad0', outfit2: '#eef0f6', hair: '#b08858', eyes: '#d8c850', skin: '#f4dfcc',
      hairStyle: 'bob', outfit: 'dress', weapon: 'staff', catEars: true },
    reinhard: { body: '#e8e8f0', outfit2: '#4a6ad0', hair: '#d04848', eyes: '#5a9ad8', skin: '#f0dcc8',
      hairStyle: 'short', outfit: 'suit', weapon: 'sword' },
    echidna: { body: '#26242c', outfit2: '#4a4654', hair: '#f0f0f4', eyes: '#2a2a30', skin: '#f8f0e8',
      hairStyle: 'long', outfit: 'dress', weapon: 'staff' },
    petelgeuse: { body: '#2c3030', outfit2: '#1e2422', hair: '#3a5848', eyes: '#88b890', skin: '#ded0c0',
      hairStyle: 'spiky', outfit: 'coat', weapon: 'fist' },
    felt: { body: '#3a3434', outfit2: '#c8b8a0', hair: '#e8d060', eyes: '#d05858', skin: '#f4dfcc',
      hairStyle: 'short', outfit: 'plain', weapon: 'knife', ribbon: '#c03838' },
    otto: { body: '#586048', outfit2: '#c8c0a8', hair: '#a8a890', eyes: '#7a9ac8', skin: '#f0dcc8',
      hairStyle: 'bob', outfit: 'coat', weapon: 'staff' },
    rom: { body: '#5a4a3c', outfit2: '#8a7a64', hair: '#c8c4bc', eyes: '#3a3630', skin: '#d8b894',
      hairStyle: 'none', outfit: 'plain', weapon: 'fist', beard: '#c8c4bc', scale: 1.4 },
    petra: { body: '#a05858', outfit2: '#f0e4d0', hair: '#c87850', eyes: '#8a5a40', skin: '#f6e2d0',
      hairStyle: 'bob', outfit: 'dress', weapon: 'staff', ribbon: '#e88aa0' },
    frederica: { body: '#2e3344', outfit2: '#f2f2f2', hair: '#d8c878', eyes: '#5ab878', skin: '#f0dcc8',
      hairStyle: 'long', outfit: 'maid', weapon: 'claw', headband: true },
    garfiel: { body: '#4a6848', outfit2: '#c8b890', hair: '#e8d060', eyes: '#5ab878', skin: '#e8d0b4',
      hairStyle: 'spiky', outfit: 'plain', weapon: 'claw' },
    ricardo: { body: '#684830', outfit2: '#a88858', hair: '#a87848', eyes: '#d8a840', skin: '#a87848',
      hairStyle: 'short', outfit: 'plain', weapon: 'sword', beastEars: true, muzzle: true, scale: 1.18 },
    mimi: { body: '#d88848', outfit2: '#f0d8b0', hair: '#e8a058', eyes: '#5a9ad8', skin: '#f6e2d0',
      hairStyle: 'bob', outfit: 'dress', weapon: 'staff', catEars: true, scale: 0.78 },
    anastasia: { body: '#d8d8e8', outfit2: '#7a9ad0', hair: '#c0aede', eyes: '#5ab8a8', skin: '#f6e6d8',
      hairStyle: 'wavy', outfit: 'coat', weapon: 'staff', scarf: '#e8e0d0' },
    al: { body: '#383838', outfit2: '#5a5a60', hair: '#383838', eyes: '#000000', skin: '#5a5a60',
      hairStyle: 'none', outfit: 'plain', weapon: 'sword', helmet: '#4a4a52' },
    meili: { body: '#486078', outfit2: '#a8b8c8', hair: '#88a8d0', eyes: '#b05858', skin: '#f4dfcc',
      hairStyle: 'braids', outfit: 'dress', weapon: 'staff' },
    elsa: { body: '#221e28', outfit2: '#6a4880', hair: '#1e1c24', eyes: '#9048a0', skin: '#f2e0d4',
      hairStyle: 'ponytail', outfit: 'plain', weapon: 'knife' },
    liliana: { body: '#a87858', outfit2: '#e8c890', hair: '#6a4838', eyes: '#d8a850', skin: '#e8d0b4',
      hairStyle: 'braids', outfit: 'dress', weapon: 'lute' },
    kadomon: { body: '#804838', outfit2: '#4a6848', hair: '#b05838', eyes: '#3a3630', skin: '#e0c0a0',
      hairStyle: 'short', outfit: 'plain', weapon: 'fist', headband: true },
  };

  // chars whose normal attack is a ranged bolt
  const RANGED = ['emilia', 'beatrice', 'roswaal', 'puck', 'echidna', 'petelgeuse', 'anastasia', 'meili', 'liliana', 'otto', 'petra', 'ferris'];

  // enemy visual archetype + body color + eye color
  const ENEMY_LOOKS = {
    thug: ['humanoid', '#7a5a48', '#2a2620'], tough: ['humanoid', '#6a6a52', '#2a2620'], assassin: ['humanoid', '#3a3548', '#c04040'],
    pup: ['beast', '#5a4a3a', '#d8b840'], ulgarm: ['beast', '#3a3a44', '#d84040'], cultist: ['humanoid', '#3c3050', '#c04040'],
    finger: ['humanoid', '#48305c', '#c04040'], wraith: ['wraith', '#aab4c8', '#80e8ff'], fanatic: ['humanoid', '#503060', '#c04040'],
    shadow: ['wraith', '#202028', '#b080ff'], rabbit: ['beast', '#d8d8e0', '#c04040'], mabeast: ['beast', '#4c3828', '#d8b840'],
    elsa_boss: ['humanoid', '#282030', '#9048a0'], giant_ulgarm: ['beast', '#23232c', '#ff5040'], julius_boss: ['humanoid', '#3c3050', '#d8c860'],
    whale: ['whale', '#dde4ee', '#3a4a6a'], petelgeuse_boss: ['humanoid', '#283028', '#88b890'], elsa_returns: ['humanoid', '#282030', '#9048a0'],
    guiltylowe: ['beast', '#c8a040', '#d84040'], sirius: ['humanoid', '#503028', '#e86840'], regulus: ['humanoid', '#e8e8e8', '#c8b840'],
    capella: ['beast', '#48202c', '#d83050'],
  };

  // ------------------------------------------------------------ weapon movesets
  // Light combos chain while you keep attacking; heavy = hold/RMB; sprint and
  // plunge attacks have their own entries. anim names drive the rig animation.
  const WEAPON_MOVES = {
    sword: {
      combo: [
        { anim: 'slashR', mult: 0.85, range: 2.9, arc: 0.2, rate: 0.5, lunge: 1.1 },
        { anim: 'slashL', mult: 0.9, range: 2.9, arc: 0.2, rate: 0.5, lunge: 1.1 },
        { anim: 'thrust', mult: 1.05, range: 3.6, arc: 0.55, rate: 0.55, lunge: 2.2 },
        { anim: 'over', mult: 1.4, range: 3.0, arc: 0.25, rate: 0.75, lunge: 0.8, dur: 0.4 },
      ],
      heavy: { anim: 'spin', mult: 2.2, range: 3.5, arc: -1, rate: 1.1, dur: 0.5, stagger: 0.45 },
      sprintAtk: { anim: 'thrust', mult: 1.35, range: 3.6, arc: 0.5, rate: 0.7, lunge: 3.2 },
      plunge: { mult: 1.7, r: 3.4 },
    },
    knife: {
      combo: [
        { anim: 'slashR', mult: 0.55, range: 2.5, arc: 0.15, rate: 0.32, lunge: 0.8 },
        { anim: 'slashL', mult: 0.55, range: 2.5, arc: 0.15, rate: 0.32, lunge: 0.8 },
        { anim: 'thrust', mult: 0.62, range: 2.8, arc: 0.5, rate: 0.34, lunge: 1.4 },
        { anim: 'slashR', mult: 0.62, range: 2.5, arc: 0.15, rate: 0.32, lunge: 0.8 },
        { anim: 'spin', mult: 1.1, range: 2.8, arc: -1, rate: 0.55, dur: 0.38 },
      ],
      heavy: { anim: 'thrust', mult: 1.8, range: 3.2, arc: 0.4, rate: 0.9, lunge: 3.6, dur: 0.42, stagger: 0.3 },
      sprintAtk: { anim: 'slashR', mult: 1.1, range: 2.8, arc: 0.2, rate: 0.5, lunge: 3.0 },
      plunge: { mult: 1.4, r: 2.9 },
    },
    flail: {
      combo: [
        { anim: 'slashR', mult: 1.1, range: 3.3, arc: 0.0, rate: 0.72, lunge: 0.8, dur: 0.4 },
        { anim: 'slashL', mult: 1.15, range: 3.3, arc: 0.0, rate: 0.72, lunge: 0.8, dur: 0.4 },
        { anim: 'over', mult: 1.6, range: 3.2, arc: 0.25, rate: 0.95, dur: 0.48, stagger: 0.3 },
      ],
      heavy: { anim: 'spin', mult: 2.7, range: 3.8, arc: -1, rate: 1.3, dur: 0.6, stagger: 0.6 },
      sprintAtk: { anim: 'over', mult: 1.6, range: 3.3, arc: 0.3, rate: 0.9, lunge: 2.4, dur: 0.45 },
      plunge: { mult: 2.1, r: 3.8 },
    },
    claw: {
      combo: [
        { anim: 'slashR', mult: 0.6, range: 2.6, arc: 0.15, rate: 0.36, lunge: 1.0 },
        { anim: 'slashL', mult: 0.6, range: 2.6, arc: 0.15, rate: 0.36, lunge: 1.0 },
        { anim: 'slashR', mult: 0.66, range: 2.6, arc: 0.15, rate: 0.36, lunge: 1.0 },
        { anim: 'spin', mult: 1.25, range: 3.0, arc: -1, rate: 0.6, dur: 0.4 },
      ],
      heavy: { anim: 'over', mult: 1.9, range: 3.0, arc: 0.25, rate: 0.95, lunge: 2.2, dur: 0.45, stagger: 0.4 },
      sprintAtk: { anim: 'slashR', mult: 1.2, range: 2.8, arc: 0.2, rate: 0.55, lunge: 3.0 },
      plunge: { mult: 1.6, r: 3.2 },
    },
    fist: {
      combo: [
        { anim: 'thrust', mult: 0.8, range: 2.5, arc: 0.35, rate: 0.42, lunge: 1.2 },
        { anim: 'slashL', mult: 0.85, range: 2.5, arc: 0.3, rate: 0.42, lunge: 1.2 },
        { anim: 'uppercut', mult: 1.3, range: 2.6, arc: 0.35, rate: 0.65, dur: 0.42, stagger: 0.35 },
      ],
      heavy: { anim: 'uppercut', mult: 2.1, range: 2.8, arc: 0.3, rate: 1.0, lunge: 1.6, dur: 0.5, stagger: 0.6 },
      sprintAtk: { anim: 'thrust', mult: 1.25, range: 2.7, arc: 0.35, rate: 0.6, lunge: 3.4 },
      plunge: { mult: 1.8, r: 3.2 },
    },
    fan: {
      combo: [
        { anim: 'slashR', mult: 0.78, range: 3.0, arc: 0.0, rate: 0.5, lunge: 0.9 },
        { anim: 'slashL', mult: 0.82, range: 3.0, arc: 0.0, rate: 0.5, lunge: 0.9 },
        { anim: 'spin', mult: 1.3, range: 3.3, arc: -1, rate: 0.7, dur: 0.42 },
      ],
      heavy: { anim: 'spin', mult: 2.0, range: 3.6, arc: -1, rate: 1.0, dur: 0.5, stagger: 0.4 },
      sprintAtk: { anim: 'slashR', mult: 1.2, range: 3.2, arc: 0.1, rate: 0.6, lunge: 2.6 },
      plunge: { mult: 1.6, r: 3.4 },
    },
    caster: {
      combo: [
        { anim: 'cast', bolt: 1, mult: 0.8, rate: 0.5 },
        { anim: 'cast', bolt: 1, mult: 0.8, rate: 0.5 },
        { anim: 'cast', bolt: 2, mult: 0.62, spread: 0.2, rate: 0.7 },
      ],
      heavy: { anim: 'cast', bolt: 1, mult: 2.0, speed: 17, pierce: true, rate: 1.15 },
      sprintAtk: { anim: 'cast', bolt: 1, mult: 1.15, rate: 0.6 },
      plunge: { mult: 1.5, r: 4.0 },
    },
  };
  WEAPON_MOVES.lute = WEAPON_MOVES.caster;
  WEAPON_MOVES.staff = WEAPON_MOVES.caster;

  // ------------------------------------------------------------ Winter Festival outfits
  // Festive recolors layered onto LOOKS by the renderer; hair/eyes/faces stay canonical.
  const XMAS = {
    emilia: { body: '#b8323c', outfit2: '#3e7b4e', flower: '#c03030' }, // the reference look: red dress, green trim, holly
    subaru: { body: '#7d2730', outfit2: '#e8e4dc' },
    rem:    { body: '#7d2730', outfit2: '#f2f2f2' },
    ram:    { body: '#2e6b46', outfit2: '#f2f2f2' },
    beatrice: { body: '#b8323c', outfit2: '#f2e8d8' },
    default: ['#a8323c', '#2e6b46', '#8d2f38', '#356b50'],
    trim: '#f2efe8',
  };

  // ------------------------------------------------------------ ambient NPCs (visual + barks; original lines)
  const NPC_KINDS = {
    villager: { bodies: ['#a08458', '#7a8a9a', '#8a6a7a', '#6a8a6a'], hair: ['#5a4632', '#3a3026', '#b89868', '#8a7a5a'] },
    noble:    { bodies: ['#4a3c6a', '#6a3c4a', '#3c5a6a'], hair: ['#c8c0a8', '#5a4632', '#8a5a3a'] },
    beastfolk:{ bodies: ['#7a6a4a', '#5a6a5a', '#6a5a6a'], hair: ['#a87848', '#c8b888', '#8a8a7a'], ears: true },
    guard:    { bodies: ['#3a4a6a'], hair: ['#5a4632', '#3a3026'] },
  };
  const cap = REGIONS[0].anchor, man = REGIONS[1].anchor;
  const NPCS = [
    // capital plaza crowd
    { x: cap[0] + 10, z: cap[1] + 6, kind: 'villager', wander: 10, line: 'Appas! Fresh appas! Cheaper than the dragon\'s blessing and twice as sweet!' },
    { x: cap[0] - 12, z: cap[1] + 9, kind: 'villager', wander: 9, line: 'They say the royal selection has five candidates now. Five! Imagine the paperwork.' },
    { x: cap[0] + 18, z: cap[1] - 8, kind: 'beastfolk', wander: 12, line: 'Kararagi silks, half price! My cousin swims them across the border herself.' },
    { x: cap[0] - 20, z: cap[1] - 12, kind: 'noble', wander: 8, line: 'A half-elf, seeking the throne? The capital does love its gossip...' },
    { x: cap[0] + 4, z: cap[1] + 22, kind: 'guard', wander: 6, line: 'Move along. The fountain is for wishes, not for swimming. Yes, again.' },
    { x: cap[0] - 6, z: cap[1] - 24, kind: 'villager', wander: 10, line: 'Snow before the Festival! The spirits must be in a generous mood this year.' },
    { x: cap[0] + 26, z: cap[1] + 14, kind: 'beastfolk', wander: 10, line: 'I heard a boy in a strange black-and-orange robe shouted at a noble. Bold or stupid?' },
    { x: cap[0] - 28, z: cap[1] + 4, kind: 'villager', wander: 8, line: 'Wreaths! Winter wreaths! Hang one for luck, hang two for love!' },
    { x: cap[0] + 12, z: cap[1] - 26, kind: 'villager', wander: 9, line: 'My grandmother swears the White Whale is real. My grandfather swears she snores.' },
    { x: cap[0] - 16, z: cap[1] + 24, kind: 'noble', wander: 7, line: 'The knight Reinhard passed through this morning. The crowd nearly fainted in unison.' },
    { x: cap[0] + 30, z: cap[1] - 18, kind: 'guard', wander: 6, line: 'Lost children gather by the flower stall. Lost adults gather by the tavern.' },
    { x: cap[0] - 32, z: cap[1] - 6, kind: 'villager', wander: 10, line: 'Hot milk and honey! Warm your hands, warm your heart!' },
    { x: cap[0] + 2, z: cap[1] - 34, kind: 'beastfolk', wander: 11, line: 'The festival tree gets taller every year. The ladders, sadly, do not.' },
    { x: cap[0] - 8, z: cap[1] + 36, kind: 'villager', wander: 9, line: 'A toast to the Dragon! May the winter be short and the appas be crisp!' },
    // manor village
    { x: man[0] - 30, z: man[1] + 30, kind: 'villager', wander: 8, line: 'The margrave\'s maids came by for the festival. The pink one critiqued my soup.' },
    { x: man[0] - 12, z: man[1] + 38, kind: 'villager', wander: 8, line: 'Wolves in the woods again... keep the children inside after dusk, alright?' },
    { x: man[0] + 4, z: man[1] + 30, kind: 'villager', wander: 7, line: 'Petra\'s been practicing her letters. Says she\'ll work in the capital someday!' },
    { x: man[0] - 22, z: man[1] + 22, kind: 'beastfolk', wander: 8, line: 'The manor lights stay on all night lately. Rich people and their mysteries.' },
    // priestella decks
    { x: -584, z: -676, kind: 'villager', wander: 6, line: 'The canals freeze pretty at the edges this season. Mind your step, traveler.' },
    { x: -596, z: -700, kind: 'beastfolk', wander: 7, line: 'A songstress plays by the waterfront at dusk. The whole city goes quiet for her.' },
    { x: -662, z: -726, kind: 'noble', wander: 6, line: 'Water gate maintenance again. The council argues; the fish do not care.' },
    { x: -722, z: -784, kind: 'villager', wander: 7, line: 'Lanterns on the water for the festival — like the stars came down for a swim.' },
    // sanctuary
    { x: 792, z: -488, kind: 'villager', wander: 6, line: 'Strangers, in the Sanctuary? The snow must have wanted you here.' },
    { x: 806, z: -512, kind: 'beastfolk', wander: 6, line: 'The barrier\'s gone, but old habits stay. We still wave at the tomb, just in case.' },
  ];

  RZ.WDATA = {
    WORLD, REGIONS, ROADS, STAGE_SPOTS, PLATFORMS, MOB_CAMPS,
    TRIALS, TRIAL_TIERS, MOVES, RANGED, LOOKS, ENEMY_LOOKS,
    WEAPON_MOVES, XMAS, NPCS, NPC_KINDS,
  };
})();
