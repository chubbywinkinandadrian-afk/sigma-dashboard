/* Re:Impact — game data. Unofficial, non-commercial fan project.
   All prose here is original; character names reference the Re:Zero anime as fan-work flavor. */
(function () {
  const RZ = (globalThis.RZ = globalThis.RZ || {});

  // ---------------------------------------------------------------- elements
  const ELEMENTS = {
    fire:  { name: 'Fire',  glyph: '🔥', color: '#e25c4a' },
    water: { name: 'Water', glyph: '❄️', color: '#5db6e8' },
    wind:  { name: 'Wind',  glyph: '🍃', color: '#3ecf9a' },
    earth: { name: 'Earth', glyph: '⛰️', color: '#c9913d' },
    yin:   { name: 'Yin',   glyph: '🌑', color: '#9b6bd4' },
    yang:  { name: 'Yang',  glyph: '☀️', color: '#f0c33c' },
  };

  // Elemental reactions: triggered when a hit's element differs from the
  // aura already on the target. Key is the two elements sorted+joined.
  // mult: damage multiplier. Extra fields are applied by the combat engine.
  const REACTIONS = {
    'fire+water': { name: 'Steam Burst',  mult: 1.75 },
    'fire+wind':  { name: 'Firestorm',    mult: 1.4, splash: 0.3 },
    'earth+fire': { name: 'Magma',        mult: 1.2, debuff: { stat: 'def', val: -0.3, turns: 2 } },
    'water+wind': { name: 'Tempest',      mult: 1.25, splash: 0.25 },
    'earth+water':{ name: 'Quagmire',     mult: 1.2, debuff: { stat: 'atk', val: -0.25, turns: 2 } },
    'earth+wind': { name: 'Sandstorm',    mult: 1.2, stun: 0.25 },
    'yang+yin':   { name: 'Eclipse',      mult: 2.0 },
  };
  // yin onto any base element = Curse (DoT); yang onto any = Purge (burst dmg)
  const YIN_REACTION  = { name: 'Curse', mult: 1.1, dot: { mult: 0.5, turns: 2 } };
  const YANG_REACTION = { name: 'Purge', mult: 1.6 };

  // ---------------------------------------------------------------- skills
  // Skill kinds understood by the engine:
  //  st (single target dmg) | aoe (all enemies) | multi (N random hits) |
  //  heal (lowest ally) | healall | shieldall | shieldself |
  //  buff (team) | selfbuff | debuff (target) | debuffall (all enemies) |
  //  Extra flags: dot {mult,turns}, stun (chance), loot (bonus crystals),
  //  energyTeam, selfheal (fraction of dmg), critGuaranteed, randomMult [lo,hi]

  // ---------------------------------------------------------------- characters
  const CHARACTERS = [
    // ------ protagonist (free, never in gacha)
    {
      id: 'subaru', name: 'Natsuki Subaru', title: 'The Boy from Another World',
      rarity: 4, element: 'yin', icon: '🏃',
      base: { hp: 820, atk: 68, def: 42, spd: 95, crit: 8 },
      skill: { name: 'Shamak', cd: 3, kind: 'aoe', mult: 1.0, debuffAll: { stat: 'atk', val: -0.15, turns: 2 },
        desc: 'A burst of darkening mist. 100% ATK Yin damage to all enemies and lowers their ATK by 15% for 2 turns.' },
      burst: { name: "Tactician's Call", kind: 'buff', buff: { stat: 'atk', val: 0.3, turns: 3 }, healall: 0.6,
        desc: 'Subaru reads the flow of the battle and calls the play. Team ATK +30% for 3 turns and all allies recover 60% of his ATK as HP.' },
      passive: { name: 'Return by Death', kind: 'rbd',
        desc: 'Once per battle, when the whole party falls while Subaru is deployed, time claws backward: the entire party revives at 40% HP.' },
      blurb: 'An ordinary tracksuit-wearing teen dropped into another world with no powers — except the one nobody can ever know about.',
    },

    // ------ 5★ standard pool
    {
      id: 'emilia', name: 'Emilia', title: 'The Frozen Bond',
      rarity: 5, element: 'water', icon: '❄️',
      base: { hp: 1060, atk: 104, def: 68, spd: 100, crit: 10 },
      skill: { name: 'El Huma', cd: 3, kind: 'st', mult: 1.8,
        desc: 'A lance of ice driven through one enemy for 180% ATK Water damage.' },
      burst: { name: 'Frozen Kingdom', kind: 'aoe', mult: 2.0, stun: 0.4,
        desc: 'The air itself crystallizes. 200% ATK Water damage to all enemies with a 40% chance to freeze each for 1 turn.' },
      blurb: 'A silver-haired half-elf candidate for the throne, kinder than the world has ever been to her.',
    },
    {
      id: 'rem', name: 'Rem', title: 'Demon of the Mansion',
      rarity: 5, element: 'water', icon: '⛓️',
      base: { hp: 1020, atk: 112, def: 64, spd: 105, crit: 12 },
      skill: { name: 'Morning Star', cd: 3, kind: 'st', mult: 1.9,
        desc: 'A spiked flail crashes down for 190% ATK Water damage.' },
      burst: { name: 'Oni Blood', kind: 'st', mult: 2.4, selfbuff: { stat: 'atk', val: 0.4, turns: 2 },
        desc: 'Her horn awakens. 240% ATK Water damage to one enemy, and Rem\'s ATK rises 40% for 2 turns.' },
      blurb: 'The blue-haired maid who decided, one starry night, who her hero would be.',
    },
    {
      id: 'ram', name: 'Ram', title: 'Pride of the Oni',
      rarity: 5, element: 'wind', icon: '🌸',
      base: { hp: 940, atk: 108, def: 58, spd: 108, crit: 12 },
      skill: { name: 'El Fura', cd: 3, kind: 'aoe', mult: 1.3,
        desc: 'Invisible wind blades sweep the field for 130% ATK Wind damage to all enemies.' },
      burst: { name: 'Wind Scythes', kind: 'aoe', mult: 2.2,
        desc: 'Far beyond what her remaining horn should allow: 220% ATK Wind damage to all enemies.' },
      blurb: 'The pink-haired maid. Everything she says is condescending and most of it is correct.',
    },
    {
      id: 'puck', name: 'Puck', title: 'Great Spirit of Fire... of Ice',
      rarity: 5, element: 'water', icon: '🐱',
      base: { hp: 900, atk: 110, def: 55, spd: 102, crit: 12 },
      skill: { name: 'Icicle Volley', cd: 3, kind: 'multi', hits: 3, mult: 0.7,
        desc: 'Three homing icicles, each dealing 70% ATK Water damage to random enemies.' },
      burst: { name: 'Beast of the End', kind: 'aoe', mult: 2.4,
        desc: 'A glimpse of the giant beast behind the kitten. 240% ATK Water damage to all enemies.' },
      blurb: 'An adorable cat spirit. Do not make his daughter cry. Seriously.',
    },
    {
      id: 'beatrice', name: 'Beatrice', title: 'Keeper of the Forbidden Library',
      rarity: 5, element: 'yin', icon: '📚',
      base: { hp: 960, atk: 96, def: 70, spd: 92, crit: 8 },
      skill: { name: 'El Minya', cd: 3, kind: 'st', mult: 1.6, debuff: { stat: 'def', val: -0.2, turns: 2 },
        desc: 'Crystallized yin magic pierces one enemy: 160% ATK Yin damage and DEF -20% for 2 turns.' },
      burst: { name: 'Door Crossing', kind: 'shieldall', mult: 2.0, energyTeam: 15,
        desc: 'Space folds protectively around the party, I suppose. Shields all allies for 200% of ATK and grants 15 energy.' },
      blurb: 'A drill-haired spirit who has waited four hundred years in a library for "that person", in fact.',
    },
    {
      id: 'roswaal', name: 'Roswaal L. Mathers', title: 'Margrave of the Border',
      rarity: 5, element: 'fire', icon: '🎭',
      base: { hp: 950, atk: 115, def: 60, spd: 99, crit: 10 },
      skill: { name: 'Al Goa', cd: 3, kind: 'st', mult: 2.0,
        desc: 'A condensed sphere of flame: 200% ATK Fire damage to one enemy.' },
      burst: { name: 'Sixfold Chant', kind: 'aoe', mult: 2.3,
        desc: 'Magic of every hue woven at once. 230% ATK Fire damage to all enemies.' },
      blurb: 'The clown-faced lord of the mansion. His smile never quite reaches whatever he is actually planning.',
    },
    {
      id: 'wilhelm', name: 'Wilhelm van Astrea', title: 'The Sword Demon',
      rarity: 5, element: 'wind', icon: '🗡️',
      base: { hp: 980, atk: 118, def: 62, spd: 112, crit: 15 },
      skill: { name: 'Sword Demon\'s Dance', cd: 3, kind: 'stmulti', hits: 4, mult: 0.55,
        desc: 'Four strikes faster than sight against one enemy, 55% ATK each.' },
      burst: { name: 'Dance of Steel', kind: 'st', mult: 3.2,
        desc: 'A lifetime of swordsmanship in a single cut. 320% ATK damage to one enemy.' },
      blurb: 'An old man with a sword and a promise to keep to his late wife.',
    },
    {
      id: 'crusch', name: 'Crusch Karsten', title: 'Duchess of the Hundred Blades',
      rarity: 5, element: 'wind', icon: '⚜️',
      base: { hp: 1000, atk: 106, def: 66, spd: 107, crit: 10 },
      skill: { name: 'Invisible Blade', cd: 3, kind: 'st', mult: 1.9,
        desc: 'A sword swing that arrives before the wind does: 190% ATK Wind damage.' },
      burst: { name: 'One Hundred Blades', kind: 'aoe', mult: 2.1, debuffAll: { stat: 'def', val: -0.2, turns: 2 },
        desc: 'A volley of unseen edges. 210% ATK Wind damage to all enemies and DEF -20% for 2 turns.' },
      blurb: 'A duchess who cannot abide lies — her blessing tells her when she hears one.',
    },
    {
      id: 'julius', name: 'Julius Juukulius', title: 'The Finest of Knights',
      rarity: 5, element: 'yang', icon: '✨',
      base: { hp: 990, atk: 107, def: 68, spd: 106, crit: 12 },
      skill: { name: 'Spirit Arts', cd: 3, kind: 'multi', hits: 2, mult: 1.0,
        desc: 'Two quasi-spirits dart out, each dealing 100% ATK Yang damage to a random enemy.' },
      burst: { name: 'Six Hues', kind: 'aoe', mult: 2.2, buff: { stat: 'atk', val: 0.15, turns: 2 },
        desc: 'All six quasi-spirits answer at once: 220% ATK Yang damage to all enemies, team ATK +15% for 2 turns.' },
      blurb: 'A knight so knightly it is genuinely irritating. He would agree, politely.',
    },
    {
      id: 'priscilla', name: 'Priscilla Barielle', title: 'The Bloodstained Bride',
      rarity: 5, element: 'yang', icon: '🌞',
      base: { hp: 970, atk: 113, def: 60, spd: 101, crit: 12 },
      skill: { name: 'Yang Sword', cd: 3, kind: 'st', mult: 1.9,
        desc: 'A blade of condensed sunlight: 190% ATK Yang damage to one enemy.' },
      burst: { name: 'The World Bends', kind: 'st', mult: 2.4, buff: { stat: 'atk', val: 0.2, turns: 2 },
        desc: 'Everything in this world is arranged in her favor. 240% ATK Yang damage, team ATK +20% for 2 turns.' },
      blurb: 'Utterly convinced the world exists for her convenience. The world keeps proving her right.',
    },
    {
      id: 'ferris', name: 'Ferris', title: 'Blue of the Royal Guard',
      rarity: 5, element: 'water', icon: '😺',
      base: { hp: 920, atk: 88, def: 62, spd: 96, crit: 6 },
      skill: { name: 'Healing Waters', cd: 2, kind: 'heal', mult: 1.6,
        desc: 'Restores the most wounded ally for 160% of Ferris\'s ATK.' },
      burst: { name: 'Blessing of Water', kind: 'healall', mult: 1.8, shieldall: 0.8,
        desc: 'The kingdom\'s finest healer at work: heals all allies for 180% ATK and shields them for 80% ATK.' },
      blurb: 'The best healer in the kingdom, nya. The cat ears are non-negotiable.',
    },

    // ------ 5★ limited exclusives
    {
      id: 'reinhard', name: 'Reinhard van Astrea', title: 'The Sword Saint',
      rarity: 5, element: 'yang', icon: '⚔️', limited: true,
      base: { hp: 1350, atk: 142, def: 85, spd: 125, crit: 18 },
      skill: { name: 'Divine Protection', cd: 2, kind: 'st', mult: 2.4,
        desc: 'Whichever blessing this situation calls for, he has it. 240% ATK Yang damage to one enemy.' },
      burst: { name: 'Sword Saint', kind: 'aoe', mult: 3.0,
        desc: 'He draws the sword. That is usually the end of the story. 300% ATK Yang damage to all enemies.' },
      blurb: 'The strongest human alive. This is not a boast; it is a measurement. (Yes, his numbers are unfair. That is the point.)',
    },
    {
      id: 'echidna', name: 'Echidna', title: 'Witch of Greed',
      rarity: 5, element: 'yin', icon: '🫖', limited: true,
      base: { hp: 1000, atk: 110, def: 64, spd: 97, crit: 10 },
      skill: { name: "Greed's Inquiry", cd: 3, kind: 'st', mult: 1.7, energyTeam: 10,
        desc: 'Knowledge is extracted, painfully. 170% ATK Yin damage and the whole team gains 10 energy.' },
      burst: { name: 'Tea Party of the Dead', kind: 'aoe', mult: 2.0, dot: { mult: 0.4, turns: 2 },
        desc: 'You are cordially invited. 200% ATK Yin damage to all enemies, who are Cursed for 2 turns.' },
      blurb: 'A white-haired witch who wants to know everything — including exactly what your despair tastes like. The tea is questionable.',
    },
    {
      id: 'petelgeuse', name: 'Petelgeuse Romanée-Conti', title: 'Sin Archbishop of Sloth',
      rarity: 5, element: 'yin', icon: '🤲', limited: true,
      base: { hp: 1010, atk: 116, def: 58, spd: 103, crit: 12 },
      skill: { name: 'Unseen Hand', cd: 3, kind: 'multi', hits: 3, mult: 0.75,
        desc: 'Invisible arms lash out: three hits of 75% ATK Yin damage to random enemies.' },
      burst: { name: 'DILIGENCE!!', kind: 'aoe', mult: 2.3, selfbuff: { stat: 'atk', val: 0.25, turns: 2 },
        desc: 'His brain trembles with effort! 230% ATK Yin damage to all enemies and his own ATK rises 25% for 2 turns.' },
      blurb: 'A Witch Cult archbishop with a flexible neck and an inflexible devotion. Playable because villains need love too.',
    },

    // ------ 4★ pool
    {
      id: 'felt', name: 'Felt', title: 'Wind of the Slums',
      rarity: 4, element: 'wind', icon: '🗝️',
      base: { hp: 760, atk: 82, def: 44, spd: 115, crit: 14 },
      skill: { name: 'Swift Steal', cd: 3, kind: 'st', mult: 1.5, loot: 20,
        desc: 'Cuts a purse mid-strike: 150% ATK Wind damage and pockets 20 Witch Crystals for you.' },
      burst: { name: 'Slum Rat Royale', kind: 'aoe', mult: 1.7, selfbuff: { stat: 'spd', val: 0.3, turns: 2 },
        desc: '170% ATK Wind damage to all enemies; Felt\'s SPD +30% for 2 turns.' },
      blurb: 'A thief from the capital\'s gutters who stole one insignia too many and got drafted into destiny.',
    },
    {
      id: 'otto', name: 'Otto Suwen', title: 'The Unluckiest Merchant',
      rarity: 4, element: 'earth', icon: '📦',
      base: { hp: 780, atk: 74, def: 50, spd: 98, crit: 8 },
      skill: { name: 'Soul Greeting', cd: 3, kind: 'st', mult: 1.2, debuff: { stat: 'atk', val: -0.25, turns: 2 },
        desc: 'He negotiates with everything nearby — including the enemy\'s nerve. 120% ATK damage, target ATK -25% for 2 turns.' },
      burst: { name: 'Caravan Rush', kind: 'aoe', mult: 1.6, buff: { stat: 'def', val: 0.25, turns: 2 },
        desc: 'A stampede of commerce. 160% ATK Earth damage to all enemies; team DEF +25% for 2 turns.' },
      blurb: 'A traveling merchant whose worst deal was befriending Subaru. He complains. He stays.',
    },
    {
      id: 'rom', name: 'Old Man Rom', title: 'Giant of the Loot House',
      rarity: 4, element: 'earth', icon: '🍺',
      base: { hp: 950, atk: 80, def: 62, spd: 85, crit: 6 },
      skill: { name: 'Club Smash', cd: 3, kind: 'st', mult: 1.7, stun: 0.2,
        desc: 'A tavern-shaking blow: 170% ATK Earth damage with a 20% chance to stun.' },
      burst: { name: "Giant's Rage", kind: 'st', mult: 2.4, selfbuff: { stat: 'def', val: 0.3, turns: 2 },
        desc: '240% ATK Earth damage; Rom\'s DEF +30% for 2 turns.' },
      blurb: 'Retired giant, active bartender, unofficial grandfather to every stray in the slums.',
    },
    {
      id: 'petra', name: 'Petra Leyte', title: 'Apprentice of the Mansion',
      rarity: 4, element: 'yang', icon: '🎀',
      base: { hp: 720, atk: 70, def: 46, spd: 97, crit: 6 },
      skill: { name: 'Handkerchief Charm', cd: 2, kind: 'heal', mult: 1.3,
        desc: 'A keepsake that protects: heals the most wounded ally for 130% of Petra\'s ATK.' },
      burst: { name: 'Village Heart', kind: 'healall', mult: 1.4, buff: { stat: 'atk', val: 0.1, turns: 2 },
        desc: 'Heals all allies for 140% ATK and raises team ATK 10% for 2 turns.' },
      blurb: 'A village girl who decided maid work beats mabeast bait, and grew braver than most knights.',
    },
    {
      id: 'frederica', name: 'Frederica Baumann', title: 'Fanged Maid',
      rarity: 4, element: 'earth', icon: '🐆',
      base: { hp: 840, atk: 84, def: 54, spd: 100, crit: 10 },
      skill: { name: 'Beast Claws', cd: 3, kind: 'stmulti', hits: 2, mult: 0.8,
        desc: 'Two raking slashes at one enemy, 80% ATK each.' },
      burst: { name: 'Garden Guardian', kind: 'shieldall', mult: 1.5, st: 1.6,
        desc: 'Shields all allies for 150% ATK, then strikes one enemy for 160% ATK Earth damage.' },
      blurb: 'An immaculate senior maid with a half-beast bloodline and a smile full of very sincere teeth.',
    },
    {
      id: 'garfiel', name: 'Garfiel Tinzel', title: 'Shield of the Sanctuary',
      rarity: 4, element: 'earth', icon: '🐯',
      base: { hp: 1000, atk: 86, def: 70, spd: 94, crit: 10 },
      skill: { name: 'Sanctuary Shield', cd: 3, kind: 'taunt', selfshield: 2.0, selfbuff: { stat: 'def', val: 0.5, turns: 2 },
        desc: 'Garfiel plants himself in front of everyone: taunts all enemies for 2 turns, shields himself for 200% ATK, DEF +50%.' },
      burst: { name: 'Fangs of Earth', kind: 'st', mult: 2.5,
        desc: 'A tiger\'s pounce that cracks the ground: 250% ATK Earth damage.' },
      blurb: 'The Sanctuary\'s short-tempered guardian. Speaks mostly in proverbs nobody has ever heard of.',
    },
    {
      id: 'ricardo', name: 'Ricardo Welkin', title: 'Captain of the Fang',
      rarity: 4, element: 'fire', icon: '🐺',
      base: { hp: 880, atk: 88, def: 52, spd: 103, crit: 12 },
      skill: { name: 'Mercenary Cleave', cd: 3, kind: 'aoe', mult: 1.2,
        desc: 'A great curved blade sweeps the line: 120% ATK Fire damage to all enemies.' },
      burst: { name: 'Iron Fang', kind: 'st', mult: 2.3, selfbuff: { stat: 'atk', val: 0.2, turns: 2 },
        desc: '230% ATK Fire damage to one enemy; Ricardo\'s ATK +20% for 2 turns.' },
      blurb: 'A boisterous wolf-man mercenary captain. Laughs loudest right before the dangerous part.',
    },
    {
      id: 'mimi', name: 'Mimi Pearlbaton', title: 'Vice-Captain (Self-Proclaimed Loudest)',
      rarity: 4, element: 'yang', icon: '📣',
      base: { hp: 740, atk: 86, def: 44, spd: 105, crit: 10 },
      skill: { name: 'Mimi Shout', cd: 3, kind: 'aoe', mult: 1.3,
        desc: 'A magical shout that splits the air: 130% ATK Yang damage to all enemies.' },
      burst: { name: 'MAXIMUM SHOUT', kind: 'aoe', mult: 1.9,
        desc: 'The big one. 190% ATK Yang damage to all enemies. Cover your ears.' },
      blurb: 'Small, loud, devastating. The Iron Fang\'s secret weapon and morale department.',
    },
    {
      id: 'anastasia', name: 'Anastasia Hoshin', title: 'Merchant Princess',
      rarity: 4, element: 'yin', icon: '🦊',
      base: { hp: 760, atk: 72, def: 48, spd: 99, crit: 8 },
      skill: { name: 'Shrewd Bargain', cd: 3, kind: 'st', mult: 1.1, debuff: { stat: 'def', val: -0.3, turns: 2 },
        desc: 'Everything has a price, including armor: 110% ATK Yin damage, target DEF -30% for 2 turns.' },
      burst: { name: "Hoshin's Cunning", kind: 'debuffall', debuffAll: { stat: 'atk', val: -0.2, turns: 2 }, energyTeam: 15,
        desc: 'The deal turns against everyone but her. All enemies ATK -20% for 2 turns; team gains 15 energy.' },
      blurb: 'A royal candidate who built a trading empire from nothing and intends to buy the throne fair and square.',
    },
    {
      id: 'al', name: 'Al', title: 'Helmeted Swordsman',
      rarity: 4, element: 'yin', icon: '⛑️',
      base: { hp: 820, atk: 80, def: 50, spd: 96, crit: 10 },
      skill: { name: 'Helmeted Gamble', cd: 3, kind: 'st', mult: 1.5, randomMult: [0.5, 2.5],
        desc: 'Swing first, check later: Yin damage anywhere between 50% and 250% ATK.' },
      burst: { name: 'Lucky Break', kind: 'st', mult: 2.0, critGuaranteed: true,
        desc: 'Somehow it always lands: 200% ATK Yin damage, guaranteed critical hit.' },
      blurb: 'A one-armed swordsman from "somewhere else" with a helmet he never removes and jokes a decade out of date.',
    },
    {
      id: 'meili', name: 'Meili Portroute', title: 'Mabeast Whisperer',
      rarity: 4, element: 'wind', icon: '🐛',
      base: { hp: 740, atk: 78, def: 46, spd: 101, crit: 8 },
      skill: { name: 'Mabeast Whistle', cd: 3, kind: 'multi', hits: 2, mult: 0.85,
        desc: 'Something with too many teeth answers: two hits of 85% ATK to random enemies.' },
      burst: { name: 'Stampede', kind: 'aoe', mult: 1.8,
        desc: 'The forest itself charges. 180% ATK Wind damage to all enemies.' },
      blurb: 'A cheerful little girl whose pets are the things other characters have nightmares about.',
    },
    {
      id: 'elsa', name: 'Elsa Granhiert', title: 'The Bowel Hunter',
      rarity: 4, element: 'yin', icon: '🔪',
      base: { hp: 860, atk: 92, def: 48, spd: 110, crit: 16 },
      skill: { name: 'Carving Pleasure', cd: 3, kind: 'st', mult: 1.6, dot: { mult: 0.5, turns: 2 },
        desc: 'A curved knife finds its favorite place: 160% ATK Yin damage plus Bleed for 2 turns.' },
      burst: { name: 'Bowel Hunter', kind: 'st', mult: 2.6, selfheal: 0.5,
        desc: '260% ATK Yin damage to one enemy; Elsa heals for 50% of the damage dealt.' },
      blurb: 'An assassin who treats her work as a love language. Playable, regrettably charming.',
    },
    {
      id: 'liliana', name: 'Liliana Masquerade', title: 'Songstress of Priestella',
      rarity: 4, element: 'yang', icon: '🎵',
      base: { hp: 700, atk: 68, def: 42, spd: 98, crit: 6 },
      skill: { name: 'Ballad of Heroes', cd: 3, kind: 'buff', buff: { stat: 'atk', val: 0.2, turns: 2 },
        desc: 'A song that makes everyone braver than they are: team ATK +20% for 2 turns.' },
      burst: { name: 'Encore!', kind: 'healall', mult: 1.2, energyTeam: 20,
        desc: 'Heals all allies for 120% ATK and grants the team 20 energy.' },
      blurb: 'A wandering musician whose songs stop battles — sometimes because they are that beautiful, sometimes because she fell off the stage.',
    },
    {
      id: 'kadomon', name: 'Kadomon Risch', title: 'Appa Vendor, Scary Face',
      rarity: 4, element: 'fire', icon: '🍎',
      base: { hp: 800, atk: 76, def: 52, spd: 90, crit: 8 },
      skill: { name: 'Appa Toss', cd: 2, kind: 'st', mult: 1.4,
        desc: 'A fastball special, produce edition: 140% ATK Fire damage.' },
      burst: { name: 'Family Business', kind: 'st', mult: 1.8, selfbuff: { stat: 'atk', val: 0.4, turns: 2 },
        desc: 'You threatened the shop?! 180% ATK Fire damage; Kadomon\'s ATK +40% for 2 turns.' },
      blurb: 'The capital\'s most intimidating fruit vendor. A devoted family man. The appas are excellent. Yes, he is really in the gacha.',
    },
  ];

  // ---------------------------------------------------------------- weapons (3★ pulls → Armory collection)
  const WEAPONS = [
    { id: 'practice_sword', name: 'Royal Guard Practice Sword', icon: '🗡️', desc: 'Standard issue. Reinhard could conquer a country with it.' },
    { id: 'whip', name: 'Whip of Promise', icon: '➰', desc: 'A gift bought in the capital, carried into every doomed loop.' },
    { id: 'kararagi_dagger', name: 'Kararagi Dagger', icon: '🔪', desc: 'Western-made, merchant-approved, surprisingly legal.' },
    { id: 'shield_stone', name: 'Meteor: Shield Stone', icon: '🛡️', desc: 'A single-use barrier artifact that everyone forgets to use.' },
    { id: 'healing_ring', name: 'Healing Crystal Ring', icon: '💍', desc: 'Faintly warm. Probably blessed. Possibly cursed. Warm, though.' },
    { id: 'wind_pendant', name: 'Wind Crystal Pendant', icon: '📿', desc: 'Hums when the wind changes. Useless indoors, beloved anyway.' },
    { id: 'miasma_charm', name: "Witch's Miasma Charm", icon: '🧿', desc: 'Reeks faintly of the witch. Mabeasts find it... motivating.' },
    { id: 'appa_crate', name: 'Crate of Appas', icon: '🧺', desc: 'Kadomon-certified produce. Morale +100%, in spirit.' },
  ];

  // ---------------------------------------------------------------- banners
  const BANNERS = [
    {
      id: 'sword-saint', type: 'limited', name: "Oath of the Sword Saint",
      tagline: 'The strongest blade in the kingdom answers the call.',
      featured5: 'reinhard', featured4: ['felt', 'otto', 'petra'],
      art: { emoji: '⚔️', from: '#2b3a67', to: '#e6c35c' },
    },
    {
      id: 'greed', type: 'limited', name: "Tea Party of Greed",
      tagline: 'The Witch of Greed pours a cup. It would be rude to refuse.',
      featured5: 'echidna', featured4: ['anastasia', 'al', 'meili'],
      art: { emoji: '🫖', from: '#1d1430', to: '#9b6bd4' },
    },
    {
      id: 'sloth', type: 'limited', name: "Trembling Devotion",
      tagline: 'The Archbishop of Sloth demonstrates extraordinary... diligence.',
      featured5: 'petelgeuse', featured4: ['elsa', 'garfiel', 'mimi'],
      art: { emoji: '🤲', from: '#221a2e', to: '#6d4ba0' },
    },
    {
      id: 'fate', type: 'standard', name: 'Crossroads of Fate',
      tagline: 'The permanent summon. Every road leads somewhere.',
      featured5: null, featured4: null,
      art: { emoji: '🌟', from: '#22304a', to: '#5d86c5' },
    },
  ];

  const GACHA = {
    costSingle: 160,
    rate5: 0.006, rate4: 0.051,
    softPityStart: 74, hardPity5: 90, pity4: 10,
    softPityStep: 0.06,
    featured5Chance: 0.5, featured4Chance: 0.5,
    dupCrystals: 160,      // refund per dupe beyond max resonance
    maxResonance: 6,
    standard5: ['emilia', 'rem', 'ram', 'puck', 'beatrice', 'roswaal', 'wilhelm', 'crusch', 'julius', 'priscilla', 'ferris'],
    pool4: ['felt', 'otto', 'rom', 'petra', 'frederica', 'garfiel', 'ricardo', 'mimi', 'anastasia', 'al', 'meili', 'elsa', 'liliana', 'kadomon'],
  };

  // ---------------------------------------------------------------- enemies
  // Base stats are chapter-1 scale; stages multiply hp/atk by chapter mult
  // (def/spd grow on a gentler curve in combat.js scaling).
  const ENEMIES = {
    thug:        { name: 'Capital Thug', icon: '🥊', hp: 55,  atk: 11, def: 8,  spd: 85 },
    tough:       { name: 'Street Tough', icon: '🪓', hp: 80,  atk: 14, def: 10, spd: 88 },
    assassin:    { name: 'Hired Knife', icon: '🗡️', hp: 110, atk: 20, def: 10, spd: 108 },
    pup:         { name: 'Mabeast Pup', icon: '🐾', hp: 70,  atk: 13, def: 8,  spd: 95 },
    ulgarm:      { name: 'Ulgarm', icon: '🐺', hp: 130, atk: 19, def: 12, spd: 100 },
    cultist:     { name: 'Witch Cultist', icon: '🕯️', hp: 150, atk: 22, def: 12, spd: 95, element: 'yin' },
    finger:      { name: 'Finger of Sloth', icon: '🫳', hp: 210, atk: 26, def: 14, spd: 100, element: 'yin',
                   skill: { name: 'Unseen Grasp', cd: 3, kind: 'st', mult: 1.5 } },
    wraith:      { name: 'Mist Wraith', icon: '🌫️', hp: 240, atk: 28, def: 14, spd: 98 },
    fanatic:     { name: 'Cult Fanatic', icon: '🔮', hp: 280, atk: 31, def: 16, spd: 99, element: 'yin',
                   skill: { name: 'Zealous Chant', cd: 3, kind: 'aoe', mult: 0.7 } },
    shadow:      { name: 'Shadow of the Past', icon: '👤', hp: 380, atk: 36, def: 18, spd: 100, element: 'yin' },
    rabbit:      { name: 'Great Rabbit', icon: '🐰', hp: 150, atk: 30, def: 10, spd: 112 },
    mabeast:     { name: 'Greater Mabeast', icon: '🦂', hp: 420, atk: 38, def: 20, spd: 96 },

    // bosses
    elsa_boss:   { name: 'Elsa, the Bowel Hunter', icon: '🔪', boss: true, hp: 620, atk: 26, def: 14, spd: 110, element: 'yin',
                   skill: { name: 'Carving Knife', cd: 3, kind: 'st', mult: 1.6, dot: { mult: 0.5, turns: 2 } } },
    giant_ulgarm:{ name: 'Alpha Ulgarm', icon: '🐺', boss: true, hp: 850, atk: 30, def: 16, spd: 102,
                   skill: { name: 'Night Howl', cd: 3, kind: 'aoe', mult: 0.9 } },
    julius_boss: { name: 'Julius (Duel)', icon: '✨', boss: true, hp: 1050, atk: 36, def: 20, spd: 106, element: 'yang',
                   skill: { name: 'Spirit Arts', cd: 3, kind: 'multi', hits: 3, mult: 0.8 } },
    whale:       { name: 'The White Whale', icon: '🐋', boss: true, hp: 2400, atk: 46, def: 22, spd: 90,
                   skill: { name: 'Mist of Elimination', cd: 3, kind: 'aoe', mult: 0.7, dot: { mult: 0.3, turns: 2 } } },
    petelgeuse_boss: { name: 'Petelgeuse, Sloth Incarnate', icon: '🤲', boss: true, hp: 2400, atk: 54, def: 24, spd: 104, element: 'yin',
                   skill: { name: 'Unseen Hands', cd: 2, kind: 'multi', hits: 4, mult: 0.8 } },
    elsa_returns:{ name: 'Elsa Returns', icon: '🔪', boss: true, hp: 1600, atk: 56, def: 24, spd: 112, element: 'yin',
                   skill: { name: 'Carving Knife', cd: 3, kind: 'st', mult: 1.7, dot: { mult: 0.5, turns: 2 } } },
    guiltylowe:  { name: 'Guiltylowe, the Golden Lion', icon: '🦁', boss: true, hp: 2400, atk: 62, def: 28, spd: 100,
                   skill: { name: 'Rending Pounce', cd: 3, kind: 'st', mult: 2.0 } },
    sirius:      { name: 'Sirius, Authority of Wrath', icon: '⛓️', boss: true, hp: 2000, atk: 64, def: 26, spd: 102, element: 'fire',
                   skill: { name: 'Shared Flame', cd: 3, kind: 'aoe', mult: 0.8, debuffAll: { stat: 'atk', val: -0.15, turns: 2 } } },
    regulus:     { name: 'Regulus, the Most Unpleasant', icon: '💍', boss: true, hp: 1800, atk: 70, def: 170, spd: 101, element: 'yang',
                   gimmick: 'breather',
                   skill: { name: 'Lion\'s Claw', cd: 3, kind: 'st', mult: 1.9 } },
    capella:     { name: 'Capella, Dragon of Corruption', icon: '🐉', boss: true, hp: 2400, atk: 68, def: 28, spd: 103, element: 'yin',
                   selfheal: 0.02,
                   skill: { name: 'Corrupted Breath', cd: 3, kind: 'aoe', mult: 0.85 } },
  };

  // ---------------------------------------------------------------- story
  // Chapter mult scales enemy hp/atk. recLvl is a UI hint only.
  const STORY = [
    {
      id: 'c1', num: 1, title: 'Starting Life from Zero', mult: 1.0, recLvl: 1,
      intro: 'One blink, and the convenience store is gone. Subaru stands in a fantasy capital with lint in his pockets and absolutely no protagonist powers. Probably fine.',
      stages: [
        { id: 'c1s1', name: 'Alleyway Welcome', enemies: [['thug', 'thug', 'thug']], crystals: 80, xp: 160,
          intro: 'Twenty minutes into another world, Subaru is cordially invited into an alley by three gentlemen interested in his wallet.',
          outro: 'Victory! Technically. Subaru declares this the start of his legend. The thugs disagree but are unconscious.' },
        { id: 'c1s2', name: 'Chasing the Thief', enemies: [['tough', 'thug', 'tough']], crystals: 80, xp: 160,
          intro: 'A silver-haired girl is searching for a stolen insignia. Subaru, owing her his life, volunteers for the chase with full confidence and zero plan.',
          outro: 'The trail leads to the loot house — and the blonde thief turns out to be more ally than enemy. Felt joins the roster!', join: 'felt' },
        { id: 'c1s3', name: 'The Loot House', enemies: [['assassin', 'assassin']], crystals: 80, xp: 160,
          intro: 'Inside the loot house the air is wrong. Someone got here first — someone who enjoys her work far too much, and brought friends.',
          outro: 'The hired knives fall, but their employer steps out of the shadows, knife gleaming, smile wide.' },
        { id: 'c1s4', name: 'The Bowel Hunter', enemies: [['elsa_boss']], boss: true, crystals: 160, xp: 400,
          intro: 'Elsa Granhiert. She introduces herself the way storms introduce themselves: by what she is about to do to you.',
          outro: 'With the half-elf\'s spirit magic turning the tide, Elsa withdraws into the night. The girl gives her name — a beautiful lie at first: but soon, the truth. Emilia joins!', join: 'emilia' },
      ],
    },
    {
      id: 'c2', num: 2, title: 'A Week at the Mansion', mult: 1.5, recLvl: 4,
      intro: 'Subaru wakes in the Roswaal mansion as its newest, least qualified servant. The maids are twins, the librarian is grumpy, and the forest is growling.',
      stages: [
        { id: 'c2s1', name: 'Pups in the Woods', enemies: [['pup', 'pup', 'pup', 'pup']], crystals: 80, xp: 200,
          intro: 'The village children wandered toward the forest. The forest, unfortunately, wandered back. Small mabeasts circle with glowing eyes.',
          outro: 'The pups scatter. On Subaru\'s ankle: a small, suspicious bite mark that he decides to mention to no one.' },
        { id: 'c2s2', name: 'The Ulgarm Pack', enemies: [['ulgarm', 'ulgarm'], ['ulgarm', 'ulgarm', 'ulgarm']], crystals: 80, xp: 200,
          intro: 'The bite was a curse, and the cure is in the forest, guarded by the pack that cast it. Rem\'s knuckles are white around her flail.',
          outro: 'Wave after wave falls. Somewhere deeper in the dark, something much larger inhales.' },
        { id: 'c2s3', name: 'Cursed Night', enemies: [['cultist', 'ulgarm', 'cultist']], crystals: 80, xp: 200,
          intro: 'Robed figures move between the trees — the beasts were never wild. Someone is conducting this.',
          outro: 'The cultists fall, but their chanting has already done its work: the alpha is awake.' },
        { id: 'c2s4', name: 'Alpha of the Forest', enemies: [['pup', 'giant_ulgarm', 'pup']], boss: true, crystals: 160, xp: 500,
          intro: 'It steps out of the treeline like a piece of the night sky given teeth. The Alpha Ulgarm, dog of the witch\'s scent.',
          outro: 'The alpha falls and the curse breaks. At the mansion, breakfast is served as if none of it happened. Ram takes credit anyway.' },
      ],
    },
    {
      id: 'c3', num: 3, title: 'The Royal Selection', mult: 2.2, recLvl: 6,
      intro: 'Five candidates. One dragon\'s covenant. The capital gathers to choose a ruler, and Subaru manages to make it about himself in record time.',
      stages: [
        { id: 'c3s1', name: 'Streets of the Capital', enemies: [['tough', 'tough', 'tough']], crystals: 80, xp: 260,
          intro: 'Old "friends" from the alley have upgraded their equipment and their grudge.',
          outro: 'Some people never learn. The walk to the palace continues, slightly delayed.' },
        { id: 'c3s2', name: 'Duel with a Knight', enemies: [['julius_boss']], boss: true, crystals: 160, xp: 520,
          intro: 'Words were said in the royal hall. Pride was wounded. Julius, finest of knights, requests the honor of correcting Subaru\'s manners — publicly.',
          outro: 'In the anime this goes... differently. Here, your party stands victorious, and Julius bows with infuriating grace. He still thinks he made his point.' },
        { id: 'c3s3', name: 'Eyes in the Forest', enemies: [['cultist', 'cultist', 'cultist']], crystals: 80, xp: 260,
          intro: 'On the road back to the mansion, the trees are full of candle smoke and whispered prayers. The Witch Cult has found its next "ordeal".',
          outro: 'The scouts are silenced, but their map is marked. The mansion. The village. Everyone.' },
        { id: 'c3s4', name: 'The Fingers', enemies: [['finger', 'finger'], ['finger', 'finger']], crystals: 160, xp: 520,
          intro: 'The Archbishop\'s "Fingers" arrive first — fanatics hollowed out and refilled with borrowed madness.',
          outro: 'The Fingers bend and break. Their master, somewhere, weeps with joy at the entertainment. His brain, reportedly, trembles.' },
      ],
    },
    {
      id: 'c4', num: 4, title: 'The White Whale', mult: 3.0, recLvl: 8,
      intro: 'Four hundred years of fog and grief swim above the Liphas plains. Tonight, an alliance of grudges goes whale hunting.',
      stages: [
        { id: 'c4s1', name: 'Mist on the Plains', enemies: [['wraith', 'wraith', 'wraith']], crystals: 100, xp: 460,
          intro: 'The fog arrives ahead of the beast, and the fog is hungry. Shapes condense out of it with borrowed faces.',
          outro: 'The wraiths disperse. In the distance, a sound like a mountain clearing its throat.' },
        { id: 'c4s2', name: 'The Great Hunt Begins', enemies: [['wraith', 'ulgarm', 'wraith', 'ulgarm']], crystals: 100, xp: 460,
          intro: 'The mist drives the plains\' beasts mad. The hunt fights its way toward the great flower tree where the trap is set.',
          outro: 'The ground trembles. The fog parts like a curtain that has been waiting four hundred years for its cue.' },
        { id: 'c4s3', name: 'The White Whale', enemies: [['whale']], boss: true, crystals: 300, xp: 1100,
          intro: 'It is less an animal than a weather system with intent. Those its mist erases are forgotten by the world itself. Wilhelm has not forgotten. Wilhelm will never forget.',
          outro: 'The Whale crashes down like a falling cathedral. An old swordsman stands on its silent bulk and finally, finally says goodbye to his wife.' },
      ],
    },
    {
      id: 'c5', num: 5, title: 'The Madman\'s Sloth', mult: 3.9, recLvl: 10,
      intro: 'One archbishop remains between the hunt and home. He is very excited to meet everyone. He is always very excited.',
      stages: [
        { id: 'c5s1', name: 'Witch Cult Hideout', enemies: [['fanatic', 'fanatic', 'fanatic']], crystals: 100, xp: 600,
          intro: 'A cave system stuffed with candles, gospel pages, and people who gave up their names. The cleanup begins.',
          outro: 'The chanting stops, cell by cell. The silence left behind is somehow worse.' },
        { id: 'c5s2', name: 'Ten Fingers', enemies: [['finger', 'finger'], ['finger', 'fanatic', 'finger']], crystals: 100, xp: 600,
          intro: 'The remaining Fingers converge to protect their master\'s ordeal. Each one moves like a puppet whose strings are pulled from very far away.',
          outro: 'The last Finger drops. From the trees, applause. One set of hands. Then, somehow, more than one set of hands.' },
        { id: 'c5s3', name: 'Sloth Incarnate', enemies: [['petelgeuse_boss']], boss: true, crystals: 300, xp: 1400,
          intro: 'Petelgeuse Romanée-Conti, Sin Archbishop of Sloth, bends backward at an angle necks do not go, and asks if you are diligent.',
          outro: 'The madman\'s unseen hands fall still at last. The road home is clear, and for once nobody has to remember a version of today that went worse.' },
      ],
    },
    {
      id: 'c6', num: 6, title: 'Sanctuary of Greed', mult: 4.6, recLvl: 14,
      intro: 'A hidden village, a barrier that judges blood, and a tomb where a dead witch serves tea. Behind every trial waits a version of yourself you buried.',
      stages: [
        { id: 'c6s1', name: 'Trial of the Past', enemies: [['shadow', 'shadow', 'shadow']], crystals: 120, xp: 800,
          intro: 'The tomb\'s first trial: face your past. It manifests as shadows wearing familiar silhouettes, saying the things you never stopped hearing.',
          outro: 'The shadows thin into morning light. The past does not get smaller — but you got bigger.' },
        { id: 'c6s2', name: 'The Great Rabbit', enemies: [['rabbit', 'rabbit', 'rabbit'], ['rabbit', 'rabbit', 'rabbit']], crystals: 120, xp: 800,
          intro: 'It looks like one small rabbit. It is never one small rabbit. The snow begins to move.',
          outro: 'The swarm is scattered before it can become a tide. The Sanctuary\'s snow settles, briefly innocent again.' },
        { id: 'c6s3', name: 'Assault on the Mansion', enemies: [['mabeast', 'elsa_returns', 'mabeast']], boss: true, crystals: 200, xp: 1100,
          intro: 'While the Sanctuary holds its trials, the Bowel Hunter pays the mansion a return visit — on a night when almost no one is home.',
          outro: 'This time there is no withdrawal into the night. The mansion stands, scarred but standing, and Elsa\'s contract goes forever unfulfilled.' },
        { id: 'c6s4', name: 'The Golden Lion', enemies: [['guiltylowe']], boss: true, crystals: 300, xp: 1600,
          intro: 'The Sanctuary\'s final guardian: a mabeast of gold fur and patient hunger that has outlived every hero sent against it.',
          outro: 'The lion bows its great head into the snow. The barrier dissolves, and the people of the Sanctuary walk out under an open sky.' },
      ],
    },
    {
      id: 'c7', num: 7, title: 'The City of Water', mult: 5.4, recLvl: 17,
      intro: 'Priestella, city of canals and songs, is taken hostage by three Sin Archbishops at once. The broadcast horns crackle with demands. Time to give the city its voice back.',
      stages: [
        { id: 'c7s1', name: 'Priestella Under Siege', enemies: [['fanatic', 'fanatic', 'fanatic', 'fanatic']], crystals: 150, xp: 1000,
          intro: 'Cultists hold the control tower and the waterways. The counterattack moves bridge by bridge.',
          outro: 'One district breathes free. From a rooftop, the sound of chains — and a voice preaching about love.' },
        { id: 'c7s2', name: 'Authority of Wrath', enemies: [['fanatic', 'sirius', 'fanatic']], boss: true, crystals: 300, xp: 1600,
          intro: 'Sirius shares her feelings. Literally. Her madness spreads heart to heart like fire through dry grass.',
          outro: 'The chains fall slack and the borrowed rage drains out of the crowd. The city\'s heartbeat is its own again.' },
        { id: 'c7s3', name: 'The Most Unpleasant', enemies: [['regulus']], boss: true, crystals: 300, xp: 1600,
          intro: 'Regulus Corneas cannot be cut, burned, or inconvenienced — and he will explain why he deserves all this, at length, forever. Strike when he pauses for breath.',
          outro: 'Mid-monologue, his perfect, untouchable world springs a leak. For the first time in centuries, Regulus experiences consequences. He files a complaint. It is denied.' },
        { id: 'c7s4', name: 'Dragon of Corruption', enemies: [['capella']], boss: true, crystals: 400, xp: 2000,
          intro: 'Capella, Archbishop of Lust, wears a dragon the way other people wear a grin. The canals boil black where her blood touches them.',
          outro: 'The dragon\'s laughter gutters out over the water. Priestella sings that night — off-key, exhausted, and entirely, defiantly alive.' },
      ],
    },
  ];

  // ---------------------------------------------------------------- misc
  const FREE_STARTERS = ['subaru'];
  const DAILY_CRYSTALS = 160;
  const START_CRYSTALS = 3200;
  const LEVEL_CAP = 80;
  const XP_CURVE = (lvl) => Math.floor(60 * Math.pow(lvl, 1.5)); // xp to go lvl -> lvl+1
  const LVL_STAT = (lvl) => 1 + 0.045 * (lvl - 1);               // stat multiplier at level
  const RES_BONUS = 0.04;                                        // +4% atk/hp per resonance
  const ARMORY_UNIQUE = 0.01;                                    // +1% team atk/hp per unique weapon
  const ARMORY_REFINE = 0.0025;                                  // +0.25% per refinement (cap 5)
  const DETERMINATION_BONUS = 0.08;                               // +8% per stack, max 3

  const charById = {};
  CHARACTERS.forEach((c) => { charById[c.id] = c; });
  const weaponById = {};
  WEAPONS.forEach((w) => { weaponById[w.id] = w; });
  const bannerById = {};
  BANNERS.forEach((b) => { bannerById[b.id] = b; });

  RZ.DATA = {
    ELEMENTS, REACTIONS, YIN_REACTION, YANG_REACTION,
    CHARACTERS, charById, WEAPONS, weaponById, BANNERS, bannerById,
    GACHA, ENEMIES, STORY,
    FREE_STARTERS, DAILY_CRYSTALS, START_CRYSTALS,
    LEVEL_CAP, XP_CURVE, LVL_STAT, RES_BONUS,
    ARMORY_UNIQUE, ARMORY_REFINE, DETERMINATION_BONUS,
  };
})();
