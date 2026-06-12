# Roadmap — from vertical slice to full game

The web build (`../rezero-impact/`) remains the complete-systems reference:
all 26 stages, trials, climbing, reactions table, Return-by-Death flow, the
full gacha UI. This Unity kit ports the foundation; the rest lands in passes.

## Pass 1 — animation (highest visual payoff)

- Humanoid Animator Controller shared by all VRM characters
  (idle/run/sprint/jump/dodge/attack×weapon/cast/hit/down).
- Hook points: `ThirdPersonController` (speed, grounded, dodge),
  `PlayerCombat.DoStrike` (combo index → attack trigger),
  `EnemyAI` telegraph states (windup/strike triggers).
- Root-motion off; code stays authoritative.

## Pass 2 — the full open world

- Port `terrain.js` heightmap (pure math → C# `TerrainData` heights +
  splat colors), regions, roads, the Priestella basin and platforms.
- Place chapters 2–7 stage spots + camps from `wdata.js` (coordinates carry
  over 1:1), waypoint fast travel, the world-side leash/encounter rules.
- District streaming: one additive scene per region.

## Pass 3 — systems parity

- Trials (tiered horde arenas), climbing + stamina wall rules,
  Return-by-Death overlay scene with Determination stacks,
  elemental DoT/splash riders (table is already in `ElementSystem`),
  full skill kinds (multi-hit, debuffs, energy team-share).
- Party manager + character screen UI (the summon panel pattern scales).
- Gamepad support (swap legacy Input for the Input System once, in
  `ThirdPersonController`/`PlayerCombat` only — input is centralized).

## Pass 4 — content & polish

- Winter/classic outfit toggle per VRM variant prefab.
- Boss gimmicks (Regulus breather, Capella regen) — fields already exist in
  the enemy defs pattern.
- SFX/music hooks, save slots, settings menu.

## Known limitations of the slice

- Placeholder rigs are intentionally simple — VRoid models are the path.
- Deaths respawn at the plaza spawn instead of a full RbD sequence.
- Camp enemies and stage waves share one flat district; no terrain relief yet.
- No Animator yet: rigs glide (Pass 1 fixes this).
