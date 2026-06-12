# HANDOFF — Skybound Realm Unity starter kit

Status snapshot for the next contributor / reviewer. Updated 2026-06-11.
This is an **original anime-inspired prototype using placeholder content** —
all public-facing names (Skybound Realm, First Haven, Skybound_Citadel) were
invented for this kit; no franchise names or assets are used.

## 1. Branch

`claude/cool-faraday-ebxfng` (tracks `origin/claude/cool-faraday-ebxfng`).
PR #1 ("Rework SAO inn greybox scene builder") merged the inn rework into
`main`; the commits below land after it.

## 2. Latest commit

`4d24321` — "Scrub franchise names from generated content; root-only sun
teardown" (Codex review follow-ups).
(This HANDOFF.md update lands in a follow-up docs-only commit.)

Recent history:

| Commit | What |
|---|---|
| `4d24321` | Franchise-name scrub + sun teardown restricted to scene roots |
| `57af768` | HANDOFF.md added |
| `eab0da7` | Interaction probe + menu-safe camera disabling + debug sign |
| `56458d1` | `BuildPlayer()` made idempotent (teardown before rebuild) |
| `485091f` | `BuildInn()` rework: idempotent, grouped hierarchy, real window light (merged via PR #1) |
| `023e8a9` | Initial starter kit (controller, shaders, builders, docs) |

## 3. Files changed (in `4d24321`)

- `sao-aincrad-unity/Assets/Scripts/Editor/SAOSceneBuilder.cs` — teardown fix + renames
- `sao-aincrad-unity/Assets/Scripts/UI/MainMenuController.cs` — default scene name
- `sao-aincrad-unity/Assets/Scripts/UI/MenuOrbitCamera.cs` — comment only
- `sao-aincrad-unity/Assets/Scripts/Player/FPSController.cs` — comment only
- `sao-aincrad-unity/README.md`, `Docs/VisualStyleGuide.md`, `Docs/MainMenuScene.md`

## 4. Summary of what changed

- **Sun teardown restricted (Codex finding 1):** `BuildInn()` no longer runs a
  `GameObject.Find("Sun_LateAfternoon")` delete loop that could destroy a
  user-authored child light sharing the name. Stray suns from pre-hierarchy
  builds were scene-root objects, so only the `GetRootGameObjects()` scan
  handles that name now. The inn root (unambiguously builder-owned) is still
  found anywhere, with the legacy name kept for migration.
- **Franchise-name scrub (Codex finding 2):** generated/public-facing names
  are now original placeholders — menu title `S K Y B O U N D   R E A L M`,
  subtitle "— Floor 1 · First Haven —", castle `Skybound_Citadel`, game scene
  `FirstHaven`, inn root `Inn_FirstHaven`, menu item "2. Build Inn Greybox
  (First Haven)". `MainMenuController.gameSceneName` defaults to `FirstHaven`.
  README/docs titles and scene names updated; README IP note rewritten as an
  original-prototype statement.
- **Camera disabling (Codex finding 3):** verified, no change needed — the fix
  already shipped in `eab0da7` (Codex reviewed the earlier merged PR).
  `BuildPlayer()` calls `DisableExtraCameras(skipMenuCameras: true)`, which
  skips `MenuCamera`/`MainMenuCamera`/`UICamera` or any camera carrying
  `MenuOrbitCamera`, logging skips; the menu builder passes `false` so its own
  re-run still replaces its previous camera.
- Earlier work on this branch: `SAOInteractionProbe` (E-key crosshair raycast
  foundation, no gameplay systems), `Debug_Interactable_Sign` on the bar,
  idempotent `BuildPlayer()`.

## 5. How to test in Unity

Prereq: Unity 2022.3 LTS, Built-in RP project, `sao-aincrad-unity/Assets/`
copied into the project (see `sao-aincrad-unity/README.md` Quickstart).

1. Empty scene → `Tools → SAO → 2. Build Inn Greybox (First Haven)` → root
   object is `Inn_FirstHaven`; red sign on the bar counter.
2. `Tools → SAO → 3. Build FPS Player Rig` → Play → walk to the bar, press
   **E** on the sign → `[SAO] Interact: 'Debug_Interactable_Sign' …`.
3. Save as `Assets/Scenes/FirstHaven.unity`; menu scene via
   `Tools → SAO → 4` saved as `MainMenu` (index 0 in Build Settings) — title
   reads SKYBOUND REALM, Start Game loads `FirstHaven`.
4. Teardown-safety check: parent a light named `Sun_LateAfternoon` under any
   user object, re-run menu item 2 → the light survives (it is deactivated by
   `DisableExtraDirectionalLights` if directional, but never deleted).
5. Re-run items 2 and 3 repeatedly → no duplicates. A scene built before the
   rename (root `Inn_TownOfBeginnings`) is also torn down correctly.

## 6. Known limitations

- **Migration:** scenes saved before `4d24321` are named `TownOfBeginnings`
  and their serialized `gameSceneName` still points there — they keep working
  as-is, but rebuilt menu scenes load `FirstHaven`, so re-save the game scene
  under the new name and update Build Settings.
- **Internal identifiers still say SAO** (future cleanup, deliberately kept to
  avoid wide churn): `SAO.*` namespaces, `Tools/SAO` menu path, `SAO/Toon` +
  `SAO/SkyGradient` shader paths, `[SAO]` log prefix, `sao.save.exists`
  PlayerPrefs key, `Assets/SAO_Generated/`, and the `sao-aincrad-unity/` repo
  folder. None are player-facing; renaming touches shaders, materials, every
  script and all docs at once, so do it as a dedicated PR if at all.
- The probe only logs; no `IInteractable` contract, prompt UI, or crosshair yet.
- Accidental `BuildPlayer()` in the menu scene leaves two active cameras +
  AudioListeners (warned, nothing destroyed) until undone.
- Reserved teardown names: `Inn_FirstHaven`, `Inn_TownOfBeginnings` (legacy),
  root-level `Sun_LateAfternoon`, `Player`, `PlayerHUD`.
- **`BuildMainMenu()` is NOT idempotent** — re-running duplicates
  `Skybound_Citadel` / `MainMenuCanvas` / `Sun_Dusk`. Known gap.
- PPv2 profile (bloom/grading/vignette) is manual — `Docs/VisualStyleGuide.md` §4.
- `sao-aincrad-unity/` is an asset/source package, not an installed Unity
  project: no `ProjectSettings/`, `Packages/`, or `ProjectVersion.txt`.

## 7. Compile risks

- Editor builder references runtime types (`FPSController`,
  `SAOInteractionProbe`, `MenuOrbitCamera`); fine in the default assembly, but
  `.asmdef` adoption later needs an Editor→runtime assembly reference.
- `SAOInteractionProbe` has no obvious player-build editor-API risk from
  static inspection (only `using UnityEngine`). Unity compilation was not run
  in this source-package repo.
- `Physics.DefaultRaycastLayers` as `LayerMask` initializer: valid const-int
  implicit conversion (a bare LayerMask defaults to *Nothing*).
- Legacy `Input.GetKeyDown` requires Active Input Handling = Input Manager (or Both).
- `Shader.Find("SAO/Toon")` is null until shaders import; builders guard with
  a dialog + early-out.
- `Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf")` is the 2022.3 builtin.
- `SAOToonURP.shader` targets Unity 6.1+ (`_CLUSTER_LIGHT_LOOP` keyword). On
  older URP versions the plain Forward path still works, but Forward+ lantern
  lighting would need the pre-rename `_FORWARD_PLUS` keyword re-added.
- The renames are string-only (object names, UI text, scene-name default, menu
  label) — no type, namespace, or API changes, so no new compile surface.

## 8. Idempotency of `BuildInn()` / `BuildPlayer()`

**Both still idempotent.**
- `BuildInn()` destroys `Inn_FirstHaven` (and legacy `Inn_TownOfBeginnings`)
  found anywhere, plus root-level-only stray `Sun_LateAfternoon`, before
  rebuilding. The current build's sun lives inside the inn root, so it is
  removed with it.
- `BuildPlayer()` destroys `Player` and `PlayerHUD` the same way before
  rebuilding. Running 2 then 3 any number of times converges to the same scene.

## 9. Grep/search checks run

- `Aincrad|AINCRAD|TownOfBeginnings|Town of Beginnings|Sword Art` across the
  repo — after the scrub, remaining hits are only the two intentional legacy
  teardown strings in `SAOSceneBuilder.cs` and this HANDOFF's history notes.
- `DisableExtraCameras` — definition + 2 call sites confirmed
  (`skipMenuCameras: true` in BuildPlayer, `false` in BuildMainMenu); verifies
  Codex finding 3 was already addressed in `eab0da7`.
- Earlier session: `Interact|Raycast|GetKeyDown` (no pre-existing interaction
  code; FPSController uses legacy Input).

## 10. Recommended next step

Unchanged: a minimal `IInteractable` interface (`string Prompt { get; }`,
`void Interact(GameObject who)`) invoked by `SAOInteractionProbe` on E, plus a
HUD prompt label driven by `CurrentTarget`. Secondary cleanup candidates: make
`BuildMainMenu()` idempotent; the internal `SAO` identifier rename (see §6) as
its own dedicated PR.
