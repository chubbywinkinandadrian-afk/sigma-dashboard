# SAO Aincrad — Unity Starter Kit

A first-person RPG foundation targeting the look of the Aincrad arc: cel-shaded,
clean, warm. **Unity 2022.3 LTS · Built-in Render Pipeline · no paid assets.**
Everything visual is primitives + one toon shader, so each greybox piece can be
swapped for a real model later without touching code.

> Why Built-in RP (not URP): the requested Post-Processing Stack v2 is a
> Built-in package, and the single-file toon shader (outline pass + banded
> ForwardAdd lantern pass) needs no Renderer Features there. Full rationale in
> `Docs/VisualStyleGuide.md`.

## Quickstart (~10 minutes)

1. Create a new **3D (Built-in)** project in **Unity 2022.3 LTS**.
2. Copy this folder's `Assets/` contents into your project's `Assets/`.
3. **Project Settings → Player → Color Space = Linear.**
4. **Package Manager → Unity Registry → Post Processing → Install.**
5. Quality settings: Pixel Light Count **6**, Soft Shadows, MSAA **off**.
6. Build the game scene — new empty scene, then:
   - `Tools → SAO → 2. Build Inn Greybox (Town of Beginnings)`
   - `Tools → SAO → 3. Build FPS Player Rig`
   - Save as `Assets/Scenes/TownOfBeginnings.unity`
7. Build the menu — new empty scene, then:
   - `Tools → SAO → 4. Build Main Menu Scene Content`
   - Save as `Assets/Scenes/MainMenu.unity`
8. **File → Build Settings → Add Open Scenes** (`MainMenu` at index 0, then
   `TownOfBeginnings`).
9. Add the PPv2 profile from `Docs/VisualStyleGuide.md` §4 (~2 min) — this is
   the bloom + color grade that completes the look.
10. Open `MainMenu`, press **Play**.

## Controls

| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Look |
| Space | Jump (buffered, with coyote time; costs stamina) |
| Left Shift | Sprint (drains stamina; hitting 0 = exhaustion lockout until 30% refill) |
| Escape | Release cursor (click to recapture) / close Options in menu |

## What's where

```
Assets/
  Scripts/
    Player/FPSController.cs     responsive FPS controller + stamina system
    UI/StaminaBar.cs            HUD bar (fades out when full)
    UI/MainMenuController.cs    Start / Load / Options / Quit
    UI/MenuOrbitCamera.cs       slow cinematic orbit for the menu
    Editor/SAOSceneBuilder.cs   Tools > SAO > … one-click greybox builders
  Shaders/
    SAOToon.shader              cel shader: outline + banded diffuse + sharp
                                specular + rim + HDR emission + lantern pass
    SAOSkyGradient.shader       painted gradient skybox
Docs/
  VisualStyleGuide.md           pipeline choice, shader guide, lighting + PPv2
                                exact settings, inn art direction
  MainMenuScene.md              menu scene setup
```

Generated at runtime-of-the-tools: `Assets/SAO_Generated/Materials/` (toon
materials + skies — safe to tweak, re-running the builder updates them in place).

## Roadmap hooks

- The controller exposes `Stamina01`, `IsSprinting`, `IsExhausted` for future
  systems (sword arts will want the same stamina pool).
- `MainMenuController.SaveExistsKey` is the PlayerPrefs flag a future save
  system should write; Load Game un-greys itself automatically.
- Scene flow is name-based (`TownOfBeginnings`) — add floors as scenes.

## A note on IP

This is a fan-style *technical* recreation: all code and art direction here are
original and the aesthetic (cel shading, warm fantasy interiors) is generic.
"Sword Art Online" names, logos, characters and music are Reki Kawahara /
Kadokawa / A-1 Pictures property — fine to emulate stylistically for a personal
project, but don't ship or sell anything carrying their branding or assets.
