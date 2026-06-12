# Re:Impact Unity — Anime-Style Open World Kit

A Unity port of the Re:Impact prototype, built for one goal the browser version
can't reach: **real anime-style visuals**. Cel-shaded characters with proper
faces and hair come from the **VRoid pipeline** (you create them — see
`Docs/VRoidPipeline.md`); until models are dropped in, every character renders
as a color-coded placeholder rig so the game is playable from minute one.

**Unity 2022.3 LTS · Built-in Render Pipeline · no paid assets · no packages
required** (UniVRM optional, for character import).

> Unofficial, non-commercial fan project. All code, shaders and placeholder
> content here are original. Character likenesses enter the project only as
> models **you** create (e.g. in VRoid Studio) or have a license to use — this
> kit ships none. Do not distribute commercially.

## Quickstart (~10 minutes)

1. Create a new **3D (Built-in)** project in **Unity 2022.3 LTS**.
2. Copy this folder's `Assets/` contents into your project's `Assets/`.
3. **Project Settings → Player → Color Space = Linear**, and
   **Active Input Handling = Input Manager (Old)** (or *Both*).
4. Open an empty scene, then run the menu items in order:
   - `Tools → Re:Impact → 1. Build Capital District` — plaza, fountain,
     timber houses (with colliders), market stalls, festival tree, snow,
     lighting, Chapter 1 stage markers, a mob camp, NPCs.
   - `Tools → Re:Impact → 2. Build Player & Game Systems` — player rig,
     orbit camera, HUD, quest manager, save bootstrap.
5. Press **Play**. Walk to the golden beacon, fight Chapter 1, summon from
   the HUD (✦), switch party members with 1–4.

Re-running either menu item tears down and rebuilds its own objects
(idempotent, safe).

## Controls

| Input | Action |
|---|---|
| WASD / mouse | move / camera (click to lock cursor) |
| LMB / RMB | light combo / heavy attack |
| Space / Shift | jump / sprint (stamina) |
| Ctrl or K | dodge roll (i-frames) |
| E / Q | skill / burst (energy) |
| Tab | lock-on |
| 1–4 | switch character |
| Esc | release cursor |

## What's ported (vertical slice)

- **Data**: all 29 characters (stats, elements, weapons, simplified kits),
  enemies with movesets (melee/combo/charge/volley/zones/slam), Chapter 1
  stages placed in-world (full stage table included for later districts),
  banners.
- **Systems**: gacha with soft/hard pity and 50/50 guarantee; JSON save
  (crystals, roster, party, pity, cleared stages); elemental aura reactions.
- **Gameplay**: third-person controller (jump/sprint/dodge/stamina),
  weapon-class light combos + heavy attacks, skills/bursts with energy,
  lock-on, party switching, enemy AI with telegraphed attacks, quest chain
  with beacon, rewards, code-built HUD and summon panel.
- **Look**: `ReImpact/Toon` cel shader (banded light, tinted shadow, rim,
  outline pass), golden-hour lighting preset, falling snow, festival plaza.

Not yet ported (see `Docs/Roadmap.md`): the full 2.4 km open world and
chapters 2–7 placement, trials, climbing, Return-by-Death overlay (deaths
respawn at the plaza), menu-game UI parity.

## Making it look like the anime

That is `Docs/VRoidPipeline.md`. Short version: model each character in the
free **VRoid Studio**, export VRM, import with **UniVRM**, drag the prefab
into the `CharacterVisuals` registry next to its character id — the game
swaps it in everywhere (field, party, summons) automatically, with the toon
post stack from `Docs/VisualStyleGuide.md` doing the rest.
