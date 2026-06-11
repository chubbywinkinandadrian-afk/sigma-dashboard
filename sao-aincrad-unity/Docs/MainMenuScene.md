# Main Menu Scene Setup

Goal: a slow orbit around a cel-shaded Aincrad silhouette at dusk, gradient
skybox, big clean title text, four buttons. All primitives, all replaceable.

## Fast path (recommended)

1. **File → New Scene** (Basic/empty).
2. **Tools → SAO → 4. Build Main Menu Scene Content.**
3. **File → Save As… → `Assets/Scenes/MainMenu.unity`**.
4. **File → Build Settings → Add Open Scenes** — `MainMenu` must be **index 0**,
   `TownOfBeginnings` below it (Start Game loads it by name).
5. Optional but recommended: add the same **Post-process Layer / Volume** combo
   from the style guide to `MenuCamera` — bloom is what makes the castle's
   window dots glow.

Press Play: the camera orbits, Start Game loads the inn, Load Game is greyed out
until a save exists (`MainMenuController.SaveExistsKey` in PlayerPrefs), Options
opens the placeholder panel (Escape or Back closes it), Quit exits (stops Play
mode in-editor).

## What the builder creates

| Object | Purpose |
|---|---|
| `Aincrad_Castle` | 12 shrinking cylinder tiers + overhanging floor plates (the layer-cake silhouette), rounded rock hull underneath, capsule spires, and HDR-emissive window dots on five tiers for dusk city lights |
| `CastleFocus` | empty at mid-height (y=30); the camera's orbit target |
| `MenuCamera` | `MenuOrbitCamera` — 115 m distance, 42 m height, 3.5°/s, slow vertical drift; HDR on, far plane 800 |
| `Sun_Dusk` | low warm directional (9°, −35°), `#FF9E73`, soft shadows |
| Render settings | flat violet ambient, `Sky_Menu` gradient skybox, linear fog 150→500 in dusty rose for depth haze |
| `MainMenuCanvas` | Screen Space Overlay, scales from 1920×1080; `MainMenuController` with all references pre-wired |
| Title | UI Text "A I N C R A D" (placeholder logo) + violet drop shadow; subtitle underneath |
| Buttons | Start Game / Load Game / Options / Quit, lower-left column |
| `OptionsPanel` | hidden placeholder panel with a Back button |
| `EventSystem` | created if the scene lacks one |

## Manual setup notes (if you rebuild it yourself)

- **Background:** either the `Sky_Menu` gradient skybox (builder default) or
  Camera **Clear Flags = Solid Color** with a deep dusk `#1A1838` — both read
  as "anime night sky"; the gradient is warmer near the horizon.
- **Text:** Unity 2022.3 no longer ships `Arial.ttf` as a builtin — legacy UI
  Text needs `Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf")` (the
  builder handles this). Letter-spacing on the title is faked with spaces until
  you swap in real logo art or TMP.
- **Wiring:** `MainMenuController` adds its own button listeners in `Awake` from
  the serialized references, so no OnClick lists to maintain — assign the four
  buttons, the panel, and the back button, and you're done. The public `On*`
  methods also work via inspector OnClick if you prefer that flow.
- The title is intentionally **not** trademarked text. If you ever distribute
  this project, keep your own branding here.
