# HANDOFF — SAO Aincrad Unity starter kit

Status snapshot for the next contributor / reviewer. Updated 2026-06-11.

## 1. Branch

`claude/cool-faraday-ebxfng` (tracks `origin/claude/cool-faraday-ebxfng`).
PR #1 ("Rework SAO inn greybox scene builder") merged the inn rework into
`main`; the commits below land after it.

## 2. Latest commit

`eab0da7c6c5245545107e73ea6d4dac76e8abeca` —
"Add interaction probe foundation and menu-safe camera disabling".
(This HANDOFF.md lands in a follow-up docs-only commit on the same branch.)

Recent history:

| Commit | What |
|---|---|
| `eab0da7` | Interaction probe + menu-safe camera disabling + debug sign |
| `56458d1` | `BuildPlayer()` made idempotent (teardown before rebuild) |
| `485091f` | `BuildInn()` rework: idempotent, grouped hierarchy, real window light (merged via PR #1) |
| `023e8a9` | Initial starter kit (controller, shaders, builders, docs) |

## 3. Files changed (in `eab0da7`)

- `sao-aincrad-unity/Assets/Scripts/Player/SAOInteractionProbe.cs` — **new**, runtime-only
- `sao-aincrad-unity/Assets/Scripts/Editor/SAOSceneBuilder.cs` — modified
- `sao-aincrad-unity/README.md` — modified (controls table, file map)

## 4. Summary of what changed

- **`SAOInteractionProbe`** (namespace `SAO.Player`, attached to the player rig
  by the builder): raycasts from the camera center every frame; exposes
  `interactDistance` (3 m), `interactMask` (defaults
  `Physics.DefaultRaycastLayers`), `interactKey` (E), `showDebugRay`,
  `logOnInteract`; publishes read-only `CurrentTarget` / `CurrentHit` for
  future systems. Pressing E only logs the target's name and distance.
  Deliberately a sensing foundation, **not** an interaction system — no
  doors, NPCs, inventory, dialogue, or RPG stats exist yet.
- **`DisableExtraCameras(bool skipMenuCameras)`**: the player builder now
  skips cameras named `MenuCamera` / `MainMenuCamera` / `UICamera` or carrying
  a `MenuOrbitCamera`, logging skips as warnings and disables by name —
  accidentally running "Build FPS Player Rig" in the menu scene no longer
  dismantles it. The menu builder passes `false` (it must replace its own
  previous camera on re-run; behavior unchanged).
- **`Debug_Interactable_Sign`**: small red cube (free BoxCollider) standing on
  the bar counter at ~1.28 m, in the spawn sightline — the probe's test target.
- **Comments** in `BuildPlayer()` documenting that `Player` and `PlayerHUD`
  are builder-owned, found-by-name prototype objects (don't hand-author
  objects with those names; don't rename without updating the builder).

## 5. How to test in Unity

Prereq: Unity 2022.3 LTS, Built-in RP project, `sao-aincrad-unity/Assets/`
copied into the project (see `sao-aincrad-unity/README.md` Quickstart).

1. Empty scene → `Tools → SAO → 2. Build Inn Greybox` → the red sign appears
   on the bar counter.
2. `Tools → SAO → 3. Build FPS Player Rig` → console reports the probe in the
   controls line.
3. Play: walk to the bar, aim at the red sign, press **E** →
   `[SAO] Interact: 'Debug_Interactable_Sign' at N.NN m.` Aim at nothing →
   `nothing in reach`. With Gizmos on, the ray draws green (hit) / gray (miss).
4. Re-run menu items 2 and 3 repeatedly → no duplicate objects.
5. Safety check: open the MainMenu scene, run `Tools → SAO → 3` →
   `MenuCamera` is *skipped* with a warning; Ctrl+Z (or delete
   `Player`+`PlayerHUD`) restores the scene untouched.

## 6. Known limitations

- The probe only logs; there is no `IInteractable` contract yet, no prompt UI
  ("[E] Read"), no crosshair.
- If `BuildPlayer()` runs in the menu scene, the skipped menu camera and the
  new player camera coexist (two active cameras, two AudioListeners — Unity
  warns every frame) until you undo or delete the rig. Intentional trade-off:
  nothing is destroyed.
- `Debug_Interactable_Sign` is a placeholder; delete it once real
  interactables exist.
- Teardown is name-based: `Inn_TownOfBeginnings`, `Sun_LateAfternoon`,
  `Player`, `PlayerHUD` are reserved names the builders will destroy on re-run.
- **`BuildMainMenu()` is NOT idempotent** (unlike 2 and 3): re-running it
  duplicates `Aincrad_Castle` / `MainMenuCanvas` / `Sun_Dusk`. Known gap.
- PPv2 profile (bloom/grading/vignette) is still manual — see
  `Docs/VisualStyleGuide.md` §4 — to avoid a hard compile dependency on the
  Post Processing package.
- `sao-aincrad-unity/` is an asset/source package, not an installed Unity
  project: no `ProjectSettings/`, `Packages/`, or `ProjectVersion.txt`.

## 7. Compile risks

- The editor builder references runtime types (`FPSController`,
  `SAOInteractionProbe`, `MenuOrbitCamera`). Fine in the default assembly; if
  `.asmdef` files are added later, the Editor assembly must reference the
  runtime assembly.
- `SAOInteractionProbe` uses no `UnityEditor` API (`Debug.DrawRay` is
  runtime-safe), so player builds compile.
- `Physics.DefaultRaycastLayers` as a `LayerMask` field initializer: valid
  (const int, implicit conversion). Chosen because a default `LayerMask` is
  *Nothing* and would silently detect nil.
- Legacy `Input.GetKeyDown` requires Active Input Handling = Input Manager (or
  Both) — same constraint `FPSController` already imposes.
- `Shader.Find("SAO/Toon")` returns null until the shaders import; the
  builders guard with a dialog + early-out.
- `Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf")` is the 2022.3
  builtin (Arial was removed in 2022.2+).

## 8. Idempotency of `BuildInn()` / `BuildPlayer()`

**Both still idempotent.**
- `BuildInn()` destroys `Inn_TownOfBeginnings` and stray `Sun_LateAfternoon`
  (active via `GameObject.Find` loop, inactive via `GetRootGameObjects`)
  before rebuilding; the debug sign lives inside the inn root, so it is
  rebuilt, never duplicated.
- `BuildPlayer()` destroys `Player` and `PlayerHUD` the same way before
  rebuilding. Running 2 then 3 any number of times converges to the same scene.

## 9. Grep/search checks run

- `Interact|Raycast|GetKeyDown` across `sao-aincrad-unity/` — confirmed no
  pre-existing interaction/raycast gameplay code before adding the probe, and
  that `FPSController` uses legacy Input (probe matches).
- `DisableExtraCameras` across `sao-aincrad-unity/` — exactly 3 hits after the
  signature change (definition + 2 call sites in `BuildPlayer` /
  `BuildMainMenu`), confirming no stale call site was missed.

## 10. Recommended next step

Define a minimal `IInteractable` interface (`string Prompt { get; }`,
`void Interact(GameObject who)`), have `SAOInteractionProbe` invoke it on the
E press when `CurrentTarget` carries one, and add a small HUD prompt label
driven by `CurrentTarget` (plus a crosshair dot). That converts the probe into
a usable system with one small PR, and doors/signs/NPCs become independent
follow-ups. Secondary cleanup candidate: make `BuildMainMenu()` idempotent
using the same teardown pattern.
