# ASHEN VOW

Original dark fantasy Soulslike action RPG — 10-minute vertical slice prototype.
Unreal Engine 5, C++ gameplay systems with Blueprint-exposed tuning.

**Milestone 1: playable foundation** — movement, camera, sprint, stamina-gated
dodge with i-frames, light combo + heavy attack with timed hit windows, lock-on,
Ashbound Soldier AI, Ashen Flask, HUD hooks, death/respawn, one Ashen Altar.

**Milestone 2: identity systems** — the Vow system (Ash / Iron / Silence,
data-driven, real-time stat application), Vow Energy + Ash Burst ability (E),
item pickups (Ash / Vow Fragment / Lore / Flask Upgrade), Memory Threads journal
(Tab), Elya and the dialogue system, and the altar Rest / Change Vow / Leave menu.

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
| `AAV_AshenAltar` | `World/AV_AshenAltar` | Rest + altar menu: restore, set respawn, respawn normal enemies |
| `UAV_HUDWidget` | `UI/AV_HUDWidget` | Bindable getters for WBP_HUD (incl. Vow Energy, notifications) |
| `UAV_VowComponent` | `Components/` | Vow catalog, unlock/equip, live stat application, Vow Energy, ability |
| `FAV_VowDefinition` / `UAV_VowDataAsset` | `Vow/` | Data-driven Vow definitions (3 built-in + asset-authored) |
| `UAV_MemoryThreadSubsystem` | `Systems/` | Lore journal entries, survives death/reload |
| `UAV_WorldStateSubsystem` | `Systems/` | Collected uniques, boss defeats, named flags |
| `AAV_ItemPickup` | `World/` | Configurable pickup: Ash / Vow Fragment / Lore / Flask Upgrade |
| `AAV_NPCBase` / `AAV_ElyaNPC` | `Characters/` | Interactable NPCs; Elya grants the first Vow |
| `FAV_DialogueLine` | `Dialogue/` | Lines with optional attached Memory Threads |
| `UAV_DialogueWidget` | `UI/` | Base for WBP_DialogueBox (speaker, line, Advance) |
| `UAV_MemoryThreadJournalWidget` | `UI/` | Base for WBP_MemoryThreadJournal |
| `UAV_AltarMenuWidget` | `UI/` | Base for WBP_AshenAltarMenu (Rest / Change Vow / Leave) |

Default controls (created at runtime if no input assets are assigned):
WASD move · mouse look · tap Shift dodge roll / hold Shift sprint · Space jump ·
LMB light · RMB heavy · F interact · R flask · Q lock-on · E Vow ability ·
Tab Memory Thread journal.

### The three Vows (equip at altars; first fragment auto-equips)
| Vow | Power | Cost |
|---|---|---|
| **Vow of Ash** | +25% damage below 35% HP; Ash Burst ability (E, 40 energy, 8 s cd) | Healing reduced 25% |
| **Vow of Iron** | 20% less damage taken, +30 poise | Stamina regen 30% slower |
| **Vow of Silence** | Dodges cost 35% less stamina; +50% crit (future backstabs) | Vow Energy regen 40% slower |

Vow Energy regenerates slowly and builds on landed hits; altars refill it.

---

## One-time editor setup (~30 minutes)

The C++ classes are playable as-is; Blueprints only add visuals and UI.
A canvas-drawn placeholder HUD (`AAV_GameHUD`) ships in C++, so **no UMG widgets
are required** — steps 4 (UI) below are optional polish.

### Mac quick path (automated)
1. Install **Xcode** from the App Store (full Xcode — Command Line Tools are not enough), then:
   `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer && sudo xcodebuild -license accept`
2. Install the **Epic Games Launcher** (epicgames.com), sign in, and install **Unreal Engine 5.x**.
3. Run `./Tools/setup_mac.sh` — it points the `.uproject` at your engine version,
   copies the mannequin from the Third Person template, builds the editor target,
   and runs `Tools/setup_editor.py` to create the map, lighting, and all Blueprints.
4. `open AshenVow.uproject` and press Play.

The manual steps below are the Windows path / reference for what the script does.

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

## Milestone 2 editor setup (~20 minutes on top of Milestone 1)

1. **BP_Elya** (parent `AAV_ElyaNPC`): set a skeletal mesh (hooded/cloaked
   placeholder — even a tinted mannequin reads fine in fog), place her near a
   ruined statue. Her five first-meeting lines, the White Sun Memory Thread,
   and the Vow of Ash grant are already in C++ — editable per-instance under
   `AshenVow|Dialogue`.
2. **WBP_DialogueBox** (parent class `AV_DialogueWidget`): bottom-third panel,
   two TextBlocks bound to `GetSpeakerName` / `GetLineText`, a Continue button
   calling `Advance`. Assign on BP_AVPlayerController → Dialogue Widget Class.
3. **WBP_MemoryThreadJournal** (parent `AV_MemoryThreadJournalWidget`): on
   Construct call `GetMemoryThreadEntries` and add a TextBlock per entry to a
   ScrollBox; a Close button calls `CloseJournal` (Tab also closes). Assign on
   the controller.
4. **WBP_AshenAltarMenu** (parent `AV_AltarMenuWidget`): three buttons — Rest →
   `SelectRest`, Leave → `LeaveMenu`, and one button per Vow from
   `GetUnlockedVows` (ForEach: make a button per entry, pass its `VowId` to
   `SelectVow`; mark the one matching `GetEquippedVowId`). Assign on the
   controller. If unassigned, altars simply rest immediately (Milestone 1
   behavior) — the game never blocks on missing UI.
5. **WBP_HUD additions**: a thin third bar bound to `GetVowEnergyPercent`
   (pale gold), a TextBlock bound to `GetEquippedVowName`, and implement the
   `ShowNotification` event (single centered TextBlock, fade in/out ~3 s).
6. **Pickups**: place 2-3 **BP children of `AAV_ItemPickup`** (set a small mesh):
   an Ash pickup on the main path, a `VowFragment` (default grants Vow of Iron)
   on the side path, and a `Lore` pickup in a hidden corner — e.g. id
   `MT_AshGathers`, text "Ash gathers where names are forgotten." Give each a
   unique `UniquePickupId`.
7. Optional: create extra Vows as **DA_Vow_*** DataAssets (`AV_VowDataAsset`)
   and add them to the player's VowComponent → Extra Vow Assets.

### Milestone 2 sanity checklist
1. Talk to Elya (F): dialogue box advances through five lines; the White Sun
   Memory Thread toast appears; after the last line you receive and auto-equip
   the Vow of Ash ("Vow sworn" toast).
2. Tab opens the journal listing every discovered Memory Thread; Tab/Close exits.
3. With Vow of Ash below 35% HP, soldier kills get noticeably faster (+25%);
   flask heals visibly less (45 → ~34).
4. E with ≥40 Vow Energy fires Ash Burst: nearby soldiers take 30 damage and
   stagger; energy bar drops; 8 s cooldown.
5. Landing hits visibly builds the Vow Energy bar.
6. Altar now opens Rest / Change Vow / Leave; switching to Vow of Iron slows
   stamina regen and lets you tank a soldier hit with ~20% less damage.
7. Pickups grant Ash / the Iron fragment / a Memory Thread, show a toast, and
   never reappear after altar rest or death.
8. Talking to Elya again plays her repeat line and adds the gate-knight thread.

## Milestone 1 sanity checklist
1. PIE: WASD/mouse move + camera, Shift sprint drains stamina, stamina regens after delay.
2. Space dodges in input direction, costs 25 stamina; spam is stopped by stamina.
3. Q locks onto the soldier: camera tracks, movement strafes, reticle follows.
4. LMB/LMB chains a 2-hit combo; RMB heavy staggers the soldier (45 poise dmg vs 30 poise).
5. Soldier patrols, detects, chases, telegraphs (0.65 s windup), and can be dodged through (i-frames).
6. Killing the soldier grants 35 Ash; body fades out after 4 s.
7. R drinks a flask (max HP minus damage first); F at the altar restores everything and respawns the soldier.
8. Dying shows the death screen, then respawns you at the altar (or PlayerStart) with enemies reset.

**Next milestones:** 3 — Crownless Gate level layout, boss arena, the Gatebound
Knight (two phases), gate unlock, save/load. 4 — polish (timing, camera,
readability, audio hooks, animation blending).
