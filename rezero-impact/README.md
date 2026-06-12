# Re:Impact — Starting Life as a Gacha Game in Another World

A browser-playable, Genshin-style gacha RPG re-skinned with the world and cast of
**Re:Zero** — built as an unofficial, non-commercial fan prototype. Two ways to play,
sharing one save: a menu game (gacha + turn-based battles) and a **3D open world**
(Three.js) where you physically travel Lugunica to fight the same story.

## Run it

```bash
# serve it (recommended; also works by just opening index.html)
cd rezero-impact && python3 -m http.server 8000
# → http://localhost:8000            (menu: gacha, party, story)
# → http://localhost:8000/world.html (3D open world)
```

Progress autosaves to `localStorage` (export/import codes in ⚙️ Settings).
Roster, crystals, pity, and story progress are shared between both modes.

## 3D Open World

An explorable low-poly Lugunica (~2.4 km²): the Capital, Roswaal Manor, Mathers
Forest, the Liphas Plains, the Witch Cult hideout, the snowy Sanctuary, and
Priestella built on decks over the water. Each story stage is a real place — a
golden beacon marks the next objective, mob camps roam the roads, and boss
arenas wait at landmarks (the White Whale circles the great flower tree).

- **Weapon-based action combat**: every weapon class (sword, knife, flail, claw,
  fist, fan, caster) has its own light combo chain with distinct swings, plus
  charged heavies, sprint attacks and plunge attacks. Dodge i-frames, stamina,
  skills/bursts from each character's kit, elemental auras and reactions.
- **Enemy movesets**: telegraphed melee and multi-hit combos, charging dashes,
  ground-zone barrages, bolt volleys and boss slam AoEs. Regulus still only
  drops his guard when he pauses for breath.
- **Movement**: jump, Genshin-style climbing on steep rock (stamina-gated),
  sprint, and solid collision against trees, houses, stalls and the fountain.
- **Genshin-style party**: switch between your 4 deployed characters with 1–4;
  if the whole party falls, **Return by Death** wakes you at the last waypoint
  with stacking Determination.
- **The capital plaza**: cobblestone, a tiered fountain, timber-frame houses
  with arched windows, market stalls, lamp posts, a decorated festival tree,
  falling snow, and a wandering crowd of NPCs with ambient chatter (original
  lines, written to fit the setting).
- **Winter Festival outfits**: the whole cast wears original festive variants
  (fur trim, festive colors, the occasional santa hat — Emilia gets her holly);
  toggle Classic/Winter in the pause menu. Cel-shaded rigs with anime faces,
  outlines and bloom.
- **Trials**: four repeatable dungeon-style horde arenas with tier selection
  (marked obelisks; press F). **Summoning works in-world** via the ✦ button.

| Input | Action |
|---|---|
| WASD / mouse | move / camera (click canvas for mouse-look) |
| LMB tap / hold (or RMB) | light combo / charged heavy |
| E / Q | skill / burst (100 energy) |
| Space | jump (auto-climb steep rock while moving into it) |
| Shift | sprint |
| Ctrl or K | dodge roll |
| Tab / F | lock-on / interact (trials) |
| 1–4 | switch character |
| Esc | pause: fast travel, outfits, summon, menu |

## What's in the box

| System | Details |
|---|---|
| **Summoning (gacha)** | Genshin-faithful math: 0.6% base 5★, soft pity at 74, hard pity at 90, 4★ every 10, 50/50 + guarantee on limited banners. 3 limited banners (Reinhard, Echidna, Petelgeuse) + a standard banner. |
| **Roster** | 28 summonable characters from across the anime (Emilia, Rem, Ram, Beatrice, Puck, Roswaal, Wilhelm, Crusch, Julius, Priscilla, Ferris, Felt, Otto, Garfiel, Elsa, ... yes, even Kadomon the appa vendor). Subaru is the free protagonist. |
| **Elements & reactions** | Re:Zero's six magic elements (Fire, Water, Wind, Earth, Yin, Yang) with Genshin-style aura/trigger reactions: Steam Burst, Firestorm, Quagmire, Curse, Purge, **Eclipse** (Yin+Yang). |
| **Combat** | Turn-based party-of-4 battles: skills with cooldowns, bursts with energy, taunts, shields, DoTs, freezes, boss gimmicks (Regulus only drops his guard every 3rd round; Capella regenerates). Manual or auto, 1×/2× speed. |
| **Return by Death** | Subaru's passive revives a wiped party once per battle. Losing a stage outright triggers the full RbD sequence — retry with stacking **Determination** buffs (+8%, max 3). |
| **Story** | 7 chapters / 26 stages following the anime's arcs, from the loot house to Priestella, with original prose summaries. Felt and Emilia join free in Chapter 1. |
| **Progression** | Party XP from battles, resonance from dupes (+4% each), an Armory collection bonus from 3★ pulls, daily crystals. |

## Testing

```bash
node test/smoke.js        # data integrity, gacha math, turn-based combat, balance sim
node test/ui-smoke.js     # executes every menu screen + a live battle via DOM shim
node test/world-smoke.js  # terrain sanity, stage placement, full open-world bot playthrough
```

The menu smoke test validates every data reference, runs 20,000 seeded pulls to
verify pity/guarantee math, and simulates a full turn-based playthrough. The
world smoke test samples 10,000 terrain points, checks every stage spot and
camp is walkable, then has a **bot physically fight through all 26 stages in
real time** (trash 3–17s, final bosses 1.8–2.8 min, zero forced deaths) and
executes the HUD against a DOM shim. The Three.js render layer is the one part
that needs a real browser.

## Project layout

```
index.html           menu game (gacha, party, turn-based story)
world.html           3D open-world mode
css/                 style.css (menu) + world.css (HUD)
js/data.js           characters, banners, enemies, story, tuning constants
js/gacha.js          pull + pity engine
js/combat.js         turn-based battle engine (auras, reactions, gimmicks)
js/game.js           shared save state, progression, rewards
js/sfx.js            synthesized WebAudio sound (no assets)
js/ui.js             menu screens, summon animation, battle UI
js/world/wdata.js    map layout, stage placement, camps, looks, tuning
js/world/terrain.js  procedural heightmap/colors (pure math)
js/world/wcore.js    real-time simulation: combat, AI, quests (no rendering)
js/world/wrender.js  Three.js scene: terrain, landmarks, actors, FX
js/world/whud.js     HUD, dialogs, pause/fast-travel, RbD overlay
js/world/wmain.js    input, camera, main loop
vendor/three.min.js  Three.js r128 (MIT — see vendor/THREE-LICENSE)
test/                smoke.js, ui-smoke.js, world-smoke.js (all Node, headless)
```

## Disclaimer

This is an **unofficial fan project for personal, non-commercial play**.
Re:Zero − Starting Life in Another World is the property of Tappei Nagatsuki,
KADOKAWA, and White Fox; the gacha-RPG formula it lovingly imitates belongs to
HoYoverse. All code, writing, and visuals here are original — no assets, text,
or audio from either franchise are included. Please don't distribute this
commercially.
