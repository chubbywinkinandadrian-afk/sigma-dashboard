# Skybound Realm — Unity Starter Kit

A first-person RPG foundation with a classic anime floating-castle MMO look:
cel-shaded, clean, warm. **Unity 2022.3 LTS · Built-in Render Pipeline · no
paid assets.** Everything visual is primitives + one toon shader, so each
greybox piece can be swapped for a real model later without touching code.

> This is an **original, anime-inspired prototype**: "Skybound Realm",
> "First Haven" and the citadel silhouette are placeholder names and content
> invented for this kit — no existing franchise's names or assets are used.

> Why Built-in RP (not URP): the requested Post-Processing Stack v2 is a
> Built-in package, and the single-file toon shader (outline pass + banded
> ForwardAdd lantern pass) needs no Renderer Features there. Full rationale in
> `Docs/VisualStyleGuide.md`.

> **On URP / Unity 6 instead?** That works too: the builders detect the active
> pipeline and use `SAO/ToonURP` (same cel look, single-pass URP port) — and if
> that shader is missing or broken they fall back to flat-color **URP Lit**
> rather than rendering magenta. After switching pipelines, re-run
> `Tools → SAO → 1. Create Toon Materials` once to retarget already-generated
> materials. For post FX under URP, skip the PPv2 steps and use a global
> Volume instead (Bloom intensity ~2.6 / threshold 1.05, Color Adjustments,
> Vignette — values from `Docs/VisualStyleGuide.md` §4 map across).

## Quickstart (~10 minutes)

1. Create a new **3D (Built-in)** project in **Unity 2022.3 LTS**.
2. Copy this folder's `Assets/` contents into your project's `Assets/`.
3. **Project Settings → Player → Color Space = Linear.**
4. **Package Manager → Unity Registry → Post Processing → Install.**
5. Quality settings: Pixel Light Count **6**, Soft Shadows, MSAA **off**.
6. Build the game scene — new empty scene, then:
   - `Tools → SAO → 2. Build Inn Greybox (First Haven)`
   - `Tools → SAO → 3. Build FPS Player Rig`
   - Save as `Assets/Scenes/FirstHaven.unity`
7. Build the menu — new empty scene, then:
   - `Tools → SAO → 4. Build Main Menu Scene Content`
   - Save as `Assets/Scenes/MainMenu.unity`
8. **File → Build Settings → Add Open Scenes** (`MainMenu` at index 0, then
   `FirstHaven`).
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
| E | Interact probe (debug: logs what's under the crosshair, ≤3 m) |
| Escape | Release cursor (click to recapture) / close Options in menu |

## What's where

```
Assets/
  Scripts/
    Player/FPSController.cs     responsive FPS controller + stamina system
    Player/SAOInteractionProbe.cs  crosshair raycast foundation (E logs target)
    UI/StaminaBar.cs            HUD bar (fades out when full)
    UI/MainMenuController.cs    Start / Load / Options / Quit
    UI/MenuOrbitCamera.cs       slow cinematic orbit for the menu
    Editor/SAOSceneBuilder.cs   Tools > SAO > … one-click greybox builders
  Shaders/
    SAOToon.shader              cel shader (Built-in RP): outline + banded
                                diffuse + sharp specular + rim + HDR emission
                                + lantern pass
    SAOToonURP.shader           the same cel look for URP / Unity 6
                                (auto-selected by the builders)
    SAOSkyGradient.shader       painted gradient skybox (works in both RPs)
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
- Scene flow is name-based (`FirstHaven`) — add floors as scenes.

## A note on IP

This is an original, anime-*inspired* prototype using placeholder content:
every public-facing name ("Skybound Realm", "First Haven", `Skybound_Citadel`)
was invented for this kit, and the aesthetic — cel shading, floating castles,
warm fantasy interiors — is a generic genre look, not any one franchise's.
No third-party names, logos, characters, music or assets are included; if you
build on this, keep it that way in anything you ship or sell.
