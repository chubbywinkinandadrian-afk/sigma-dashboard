# HANDOFF — Skybound Realm Unity starter kit

Status snapshot for the next contributor / reviewer. Updated 2026-06-12.
This is an **original anime-inspired prototype using placeholder content** —
all public-facing names (Skybound Realm, First Haven, Skybound_Citadel) were
invented for this kit; no franchise names or assets are used.

## 1. Branch

`feature/interaction-foundation-v1` (branched from `main` at `116b937`,
after PR #3). Earlier work lived on `claude/cool-faraday-ebxfng`, fully
merged into `main` via PRs #1–#3.

## 2. Latest commit

`afb0b4f` — "Interaction Foundation v1: IInteractable, prompt UI, self-hit
fix". (This HANDOFF update lands in a follow-up docs-only commit; the PR into
`main` contains both and awaits Codex review — do not merge without it.)

Recent history:

| Commit | What |
|---|---|
| `afb0b4f` | **Interaction Foundation v1** (this milestone) |
| `116b937` | Merge PR #3: cluster-loop keyword only, stricter ShadersOk |
| `2c0e6ec` | Codex fixes on the URP shader work |
| `21f5f12` | Merge PR #2: URP support + cleanups |
| `8cd5d11` | URP magenta fix: SAO/ToonURP + pipeline-aware builder |

## 3. Files changed (in `afb0b4f`)

- `sao-aincrad-unity/Assets/Scripts/Interaction/IInteractable.cs` — **new**
- `sao-aincrad-unity/Assets/Scripts/Interaction/DebugSignInteractable.cs` — **new**
- `sao-aincrad-unity/Assets/Scripts/UI/InteractionPromptUI.cs` — **new**
- `sao-aincrad-unity/Assets/Scripts/Player/SAOInteractionProbe.cs` — reworked
- `sao-aincrad-unity/Assets/Scripts/Editor/SAOSceneBuilder.cs` — wiring only
- `sao-aincrad-unity/README.md` — controls/file map/roadmap

## 4. Summary of what changed

The loop is now: **look at interactable → prompt appears → press E →
`Interact(player)` runs.**

- `IInteractable` (`SAO.Interaction`): `string PromptText { get; }` +
  `void Interact(GameObject interactor)`. Runtime-only, minimal. Implement on
  or above an object's collider; the probe resolves it via
  `GetComponentInParent`.
- `SAOInteractionProbe` is now a sensor + dispatcher. **Self-hit fix:** PhysX
  reports the player's own CharacterController at 0.00 m when the ray starts
  inside it (the reported `Player at 0.00 m` logs). The probe now uses
  `RaycastNonAlloc` and picks the nearest hit whose collider is *not* a child
  of the player rig. Read-only state for UI: `CurrentInteractable`,
  `CurrentTarget`, `CurrentHit`, `HasInteractable`, `CurrentPrompt`.
- `InteractionPromptUI`: center-bottom prompt (legacy `UnityEngine.UI.Text`,
  matching the rest of the kit), toggled via CanvasGroup alpha, hidden when
  nothing is targeted, never blocks raycasts.
- `DebugSignInteractable` on the inn's `Debug_Interactable_Sign`: prompt
  "Press E - Read Sign", logs `[Interaction] Debug sign interacted by Player`.
- Builder wiring: sign gets the component in `BuildInn()`; `BuildHud()` adds
  the `InteractionPrompt` object and wires `probe`/`label`/`canvasGroup` via
  `SerializedObject` (same pattern as the stamina bar).

## 5. How to test in Unity (the milestone's test condition)

Unity 6.3 LTS URP project with the kit's `Assets/` imported:

1. `Tools → SAO → 2. Build Inn Greybox (First Haven)`
2. `Tools → SAO → 3. Build FPS Player Rig`
3. Play:
   - Walk (WASD/mouse) to the bar counter and look at the red sign →
     a center-bottom prompt "Press E - Read Sign" appears.
   - Press E → console logs `[Interaction] Debug sign interacted by Player`.
   - Look away → prompt hides. Look at a wall and press E →
     `'Wall_…' is not interactable.` (debug log, can be muted via
     `logOnInteract`).
   - **No more `Player at 0.00 m` self-hit logs.**
   - Scene view with Gizmos: ray is green on interactables, yellow on plain
     geometry, gray on miss.

## 6. Known limitations

- One interactable type exists (the debug sign); doors/NPCs/notice boards are
  intentionally absent — each is "one component" away via `IInteractable`.
- The prompt is instant show/hide (no fade) and there is no crosshair dot yet.
- Prompt text is the interactable's full line ("Press E - …"); if the
  interact key is rebound in the probe, prompt strings don't auto-update —
  fine for prototype, revisit when key rebinding becomes real.
- `RaycastNonAlloc` buffer is 8; more than 8 overlapping colliders along the
  3 m ray could hide the nearest target (not reachable in the greybox).
- Pre-existing gaps unchanged: `BuildMainMenu()` not idempotent; PPv2/Volume
  post FX manual; internal `SAO` identifiers kept (see older notes below).
- Reserved teardown names: `Inn_FirstHaven`, `Inn_TownOfBeginnings` (legacy),
  root-level `Sun_LateAfternoon`, `Player`, `PlayerHUD`.

## 7. Compile risks

- All three new runtime files use only `UnityEngine`/`UnityEngine.UI` — no
  `UnityEditor`. The builder (editor assembly) references the new runtime
  types; fine in the default assembly, `.asmdef` adoption later needs an
  Editor→runtime reference (pre-existing constraint).
- `GetComponentInParent<IInteractable>()` with an interface type parameter is
  supported in all target Unity versions.
- `FindObjectOfType` in `InteractionPromptUI`'s fallback is obsolete-flagged
  in Unity 6 (warning only) — kept for consistency with `StaminaBar` and
  2022.3 compatibility; builder wiring means the fallback rarely runs.
- Legacy `Input.GetKeyDown` requires Input Manager or Both (already the
  project's setting).
- `SAOToonURP.shader` targets Unity 6.1+ (`_CLUSTER_LIGHT_LOOP`); on older
  URP versions the plain Forward path works, Forward+ lanterns would need the
  pre-rename `_FORWARD_PLUS` keyword re-added.
- Unity compilation was not run in this source-package repo — findings are
  from static inspection.

## 8. Idempotency of `BuildInn()` / `BuildPlayer()`

**Both still idempotent — unchanged teardown.** The sign (and its
`DebugSignInteractable`) lives inside `Inn_FirstHaven`; the prompt UI lives
inside `PlayerHUD`. Both roots are destroyed by name before each rebuild, so
re-running 2 and 3 converges to the same scene with no duplicates.

## 9. Grep/search checks run

- `FindProperty("probe"/"label"/"canvasGroup")` vs `[SerializeField]` field
  names in `InteractionPromptUI` — exact match (builder wiring can't silently
  miss).
- `AddComponent<DebugSignInteractable|SAOInteractionProbe|InteractionPromptUI>`
  + `GetComponentInParent<IInteractable>` — each present exactly where
  intended; no `UnityEditor` usage in the new runtime files.

## 10. Recommended next step

After this PR passes review: a crosshair dot + prompt fade polish, then the
first real interactables — a door (`IInteractable` that swings the existing
`Door_Hinge`) and a readable sign panel. Pre-existing cleanup candidates
remain: idempotent `BuildMainMenu()`, internal `SAO` identifier rename as a
dedicated PR.
