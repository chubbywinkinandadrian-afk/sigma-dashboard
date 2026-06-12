# ASHEN VOW

Original dark fantasy Soulslike action RPG — 10-minute vertical slice prototype.
Unreal Engine 5, C++ gameplay systems with Blueprint-exposed tuning.

**Milestone 1 (this commit): playable foundation** — movement, camera, sprint,
stamina-gated dodge with i-frames, light combo + heavy attack with timed hit
windows, lock-on, Ashbound Soldier AI, Ashen Flask, HUD hooks, death/respawn,
and one Ashen Altar checkpoint.

---

## C++ class map

| Class | File | Role |
|---|---|---|
| `AAV_GameMode` | `Core/AV_GameMode` | Death→respawn loop, active altar, world enemy resets |
| `AAV_PlayerController` | `Core/AV_PlayerController` | Creates HUD + death screen widgets |
| `FAV_AttackData` / `FAV_DamageInfo` | `Core/AV_Types` | Data-driven attack & damage structs |
| `AAV_CharacterBase` | `Characters/AV_CharacterBase` | Shared health/stamina/combat wiring, stagger, death |
| `AAV_PlayerCharacter` | `Characters/AV_PlayerCharacter` | The Vowless: input, dodge, combos, flask, Ash |
| `AAV_EnemyBase` | `Characters/AV_EnemyBase` | AI state machine: patrol→chase→combat→leash, respawn |
| `AAV_AshboundSoldier` | `Characters/AV_AshboundSoldier` | First enemy: slow telegraphed 2-hit combo |
| `UAV_HealthComponent` | `Components/` | HP + poise, i-frame flag, death event, heal multiplier (Vow hook) |
| `UAV_StaminaComponent` | `Components/` | Delayed regen, souls-style affordability, regen multiplier (Vow hook) |
| `UAV_MeleeCombatComponent` | `Components/` | Startup/Active/Recovery phases, swept-sphere hits, combo-cancel |
| `UAV_LockOnComponent` | `Components/` | Target scoring, camera tracking, switch left/right |
| `UAV_InteractionComponent` | `Components/` | Focus scan + prompt text for the HUD |
| `IAV_Targetable` / `IAV_Interactable` | `Interfaces/` | Lock-on targets / F-key interactables |
| `AAV_AshenAltar` | `World/AV_AshenAltar` | Rest: restore, set respawn, respawn normal enemies |
| `UAV_HUDWidget` | `UI/AV_HUDWidget` | Bindable getters for WBP_HUD |

Default controls (created at runtime if no input assets are assigned):
WASD move · mouse look · Shift sprint · Space dodge · LMB light · RMB heavy ·
F interact · R flask · Q lock-on.

---

## One-time editor setup (~30 minutes)

The C++ classes are playable as-is; Blueprints only add visuals and UI.

### 1. Generate and build
1. Install UE 5.x (the `.uproject` says `5.6` — edit `EngineAssociation` to match your version).
2. Right-click `AshenVow.uproject` → **Generate Visual Studio project files**.
3. Open the `.sln`, build the **Development Editor** target, then open the `.uproject`.

### 2. Create the map `Content/AshenVow/Maps/L_CrownlessGate`
1. **File → New Level → Basic**, save as `L_CrownlessGate` in `Content/AshenVow/Maps/`.
   (Config already points the editor/game default map here.)
2. Block out a small ash field with a path using BSP/simple meshes — broken white
   stone, long sightlines, pale fog (ExponentialHeightFog, low density, desaturated).
3. Place a **PlayerStart** in the ash field.
4. Drag a **NavMeshBoundsVolume** over the whole playable space (enemies path-find
   with it; they fall back to straight-line movement without it, so this is
   recommended, not required). Press `P` to verify green coverage.
5. World Settings → confirm GameMode Override is empty (config supplies `AV_GameMode`),
   or set your `BP_AVGameMode` once you create it below.

### 3. Blueprint children (visuals + tuning)
Create a folder `Content/AshenVow/Blueprints/` and make child Blueprints:

- **BP_Vowless** (parent `AAV_PlayerCharacter`)
  - Mesh: set Skeletal Mesh to `SKM_Quinn`/`SKM_Manny` (add the Third Person
    template content via **Add → Feature Pack → Third Person** if missing),
    relative location Z = -89, rotation Z (yaw) = -90.
  - Anim Class: the template's `ABP_Quinn`/`ABP_Manny` gives idle/run blending for free.
  - All combat numbers (attack data array, dodge timings, flask, speeds) are
    editable under the `AshenVow|…` categories.
- **BP_AshboundSoldier** (parent `AAV_AshboundSoldier`)
  - Same mesh/anim setup; tint the material dark, sell "broken armor" later.
  - Place 1 in the level; add 2-3 `PatrolPoints` (world-space, edit widgets show in viewport).
- **BP_AshenAltar** (parent `AAV_AshenAltar`)
  - Set `AltarMesh` to any broken-stone static mesh; add a small fire/ash
    Niagara placeholder. Place one near the start. The `RespawnPoint` child
    component is where the player respawns — drag it to open ground.
- **BP_AVGameMode** (parent `AAV_GameMode`): set Default Pawn = `BP_Vowless`,
  Player Controller = `BP_AVPlayerController`. Set it in World Settings.
- **BP_AVPlayerController** (parent `AAV_PlayerController`): assign the two
  widgets from step 4.

### 4. UI widgets in `Content/AshenVow/UI/`
- **WBP_HUD** (parent class `AV_HUDWidget` — pick it under "All Classes" when creating):
  - Two ProgressBars top-left: bind Percent → `GetHealthPercent` (dark red) and
    `GetStaminaPercent` (dark green/grey).
  - Text bottom-left: bind → `GetFlaskCharges` / `GetMaxFlaskCharges` ("Flask 3/3").
  - Text bottom-right: bind → `GetAshCount` ("Ash 0").
  - Center-bottom Text: bind → `GetInteractionPrompt`; collapse when empty.
  - Lock-on reticle: small image, on Tick call `GetLockOnScreenPosition` and
    `SetPositionInViewport`; visible only while `IsLockedOn`.
- **WBP_DeathScreen** (parent `UserWidget`): black overlay, centered serif text
  **"YOU ARE FORGOTTEN"** (faded bone-white). The game mode auto-respawns after
  `RespawnDelay` (default 4 s).

### 5. Optional input assets
Runtime defaults cover all keys. To customize bindings, create `IMC_Default` +
`IA_Move` (Axis2D), `IA_Look` (Axis2D), and Boolean actions for the rest, then
assign them on `BP_Vowless` under `AshenVow|Input`. Assigned assets take priority.

### 6. Placeholder animation hooks
Timed gameplay works without montages. For feel, assign montages per attack in
the `LightAttackCombo` / `HeavyAttack` / enemy `AttackCombo` structs (any slash
montage retargeted to the UE5 skeleton), and implement the BP events
(`On Dodge (BP)`, `On Staggered (BP)`, `On Death (BP)`, `On Attack Started (BP)`)
with montages/sounds. Keep gameplay timing in the structs; swap to anim notifies
during the polish milestone.

---

## Milestone 1 sanity checklist
1. PIE: WASD/mouse move + camera, Shift sprint drains stamina, stamina regens after delay.
2. Space dodges in input direction, costs 25 stamina; spam is stopped by stamina.
3. Q locks onto the soldier: camera tracks, movement strafes, reticle follows.
4. LMB/LMB chains a 2-hit combo; RMB heavy staggers the soldier (45 poise dmg vs 30 poise).
5. Soldier patrols, detects, chases, telegraphs (0.65 s windup), and can be dodged through (i-frames).
6. Killing the soldier grants 35 Ash; body fades out after 4 s.
7. R drinks a flask (max HP minus damage first); F at the altar restores everything and respawns the soldier.
8. Dying shows the death screen, then respawns you at the altar (or PlayerStart) with enemies reset.

**Next milestones:** 2 — Vow system, Vow Energy, pickups, Memory Threads, Elya +
dialogue. 3 — Crownless Gate level, Gatebound Knight boss. 4 — polish.
