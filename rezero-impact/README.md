# Re:Impact — Starting Life as a Gacha Game in Another World

A browser-playable, Genshin-style gacha RPG re-skinned with the world and cast of
**Re:Zero** — built as an unofficial, non-commercial fan prototype. No engine, no
build step, no dependencies: open `index.html` and play.

## Run it

```bash
# option 1: just open the file
open rezero-impact/index.html        # macOS
xdg-open rezero-impact/index.html    # Linux

# option 2: serve it (recommended)
cd rezero-impact && python3 -m http.server 8000
# → http://localhost:8000
```

Progress autosaves to `localStorage` (export/import codes in ⚙️ Settings).

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
node test/smoke.js      # data integrity, gacha math, combat, balance sim
node test/ui-smoke.js   # executes every screen + a live battle via DOM shim
```

The smoke test validates data integrity (every enemy/banner/join reference),
runs 20,000 seeded pulls to verify pity/guarantee math, unit-tests reactions,
loot, and the RbD revive, and **simulates a full playthrough** with a budget
party to prove the difficulty curve is clearable without grinding (bosses land
in the 10–26 round range). The UI smoke test renders every screen and plays an
auto-battle end-to-end to catch runtime template errors.

## Project layout

```
index.html        shell + script order
css/style.css     all styling (dark/gold, rarity glows, RbD overlay)
js/data.js        characters, banners, enemies, story, tuning constants
js/gacha.js       pull + pity engine
js/combat.js      turn-based battle engine (auras, reactions, gimmicks)
js/game.js        save state, progression, rewards
js/sfx.js         synthesized WebAudio sound (no assets)
js/ui.js          every screen, summon animation, battle UI
test/smoke.js     headless validation + balance simulation (Node)
```

## Disclaimer

This is an **unofficial fan project for personal, non-commercial play**.
Re:Zero − Starting Life in Another World is the property of Tappei Nagatsuki,
KADOKAWA, and White Fox; the gacha-RPG formula it lovingly imitates belongs to
HoYoverse. All code, writing, and visuals here are original — no assets, text,
or audio from either franchise are included. Please don't distribute this
commercially.
