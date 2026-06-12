# VRoid Pipeline — real anime characters, legally

This is the answer to "make the characters look like the anime." Hand-coded
primitives will never get there; **anime-style 3D models** will. The cleanest
way to have Re:Zero-accurate characters in a personal fan project is to make
them yourself in a character creator — you own what you make, and the style
is exactly the cel-shaded anime look (it's the same pipeline VTubers and many
anime games use).

## 1. Create the character — VRoid Studio (free)

1. Download **VRoid Studio** (free, by Pixiv) for Windows/macOS.
2. Create a new character and shape it using official art you own as a visual
   reference: face shape, eye color, hair (the hair tool does bobs, drills,
   long silver hair, ahoge — everything the cast needs), outfit colors.
   Budget roughly an evening per character for a good likeness.
3. Export: **Export as VRM** (VRM 0.x is the most compatible). One `.vrm`
   file per character.

Alternatives: commission a modeler, or buy models whose license allows game
use. **Do not** use ripped game/anime models — besides the legal problem,
they rarely come rigged in a compatible way.

## 2. Import into Unity — UniVRM

1. In Unity: `Window → Package Manager → + → Add package from git URL…` and add
   `https://github.com/vrm-c/UniVRM.git?path=/Assets/VRM10#v0.128.0`
   (or install the UniVRM `.unitypackage` release for VRM 0.x — see the UniVRM
   README for the version matching your Unity).
2. Drag the `.vrm` file into your project. UniVRM generates a ready **prefab**
   with the MToon toon shader already applied — it will look cel-shaded
   immediately.

## 3. Wire it into the game

1. Open the scene; select the **CharacterVisuals** object (created by
   `Tools → Re:Impact → 2`).
2. In the inspector, add an entry to **Entries**:
   - `CharacterId`: the game id (`emilia`, `rem`, `subaru`, `reinhard`, …
     full list in `Scripts/Data/GameData.cs`).
   - `Prefab`: your imported VRM prefab.
3. Press Play. The model now appears in the field for that character —
   party switching, summons and quests all use it automatically. Any
   character without a prefab keeps its placeholder rig.

Scale note: VRoid exports at real-world height; the controller expects a
roughly 1.6–1.9 m character, so defaults just work. If a model floats or
sinks, adjust the prefab root Y once.

## 4. Animation (next step)

The kit moves rigs as a whole (no walk cycles yet). Because VRM prefabs are
**Humanoid**, any humanoid animation retargets onto every character at once:

1. Import a CC0/free humanoid locomotion pack (idle/walk/run/attack).
2. Create one Animator Controller; assign it to the VRM prefab's Animator.
3. Drive parameters from `ThirdPersonController` (speed, grounded) — the
   clean hook points are noted in `Docs/Roadmap.md`.

## 5. The Winter Festival outfits

VRoid outfits are editable per character — make a festive variant export
(`emilia_winter.vrm`) and swap the prefab in `CharacterVisuals`, or keep two
entries and flip between them from a menu later (roadmap item).
