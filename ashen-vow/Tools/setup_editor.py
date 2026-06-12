"""
ASHEN VOW — one-time editor setup automation (Milestone 1).

Run via Tools/setup_mac.sh, or manually:
  UnrealEditor-Cmd AshenVow.uproject -run=pythonscript -script=Tools/setup_editor.py

Creates, idempotently (safe to re-run):
  /Game/AshenVow/Maps/L_CrownlessGate  — ash-field blockout: floor, lighting,
      fog, PlayerStart, one Ashbound Soldier, one Ashen Altar
  /Game/AshenVow/Blueprints/BP_Vowless, BP_AshboundSoldier — mannequin mesh +
      anim BP assigned if the Third Person template content was copied in
  /Game/AshenVow/Blueprints/BP_AshenAltar, BP_AVGameMode

Every step is wrapped so a single API difference between engine versions
degrades to a logged warning instead of aborting the whole setup.
"""

import unreal

ROOT = "/Game/AshenVow"
BP_DIR = ROOT + "/Blueprints"
MAP_DIR = ROOT + "/Maps"
MAP_PATH = MAP_DIR + "/L_CrownlessGate"

eal = unreal.EditorAssetLibrary
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()

OK = []
WARN = []


def log(msg):
    unreal.log("[AshenVow] " + msg)


def warn(msg):
    WARN.append(msg)
    unreal.log_warning("[AshenVow] " + msg)


def step(label):
    def deco(fn):
        def wrapped(*args, **kwargs):
            try:
                result = fn(*args, **kwargs)
                OK.append(label)
                log("OK: " + label)
                return result
            except Exception as e:  # noqa: BLE001 — degrade, don't abort
                warn("FAILED: %s (%s)" % (label, e))
                return None
        return wrapped
    return deco


def find_asset_by_name(name, hint=""):
    """Search /Game for an asset by exact object name, else by prefix
    (5.6+ renamed SKM_Quinn -> SKM_Quinn_Simple etc.)."""
    prefix_hit = None
    for path in eal.list_assets("/Game", recursive=True, include_folder=False):
        clean = str(path).split(".")[0]
        base = clean.rsplit("/", 1)[-1]
        if base == name:
            return clean
        if prefix_hit is None and base.startswith(name):
            prefix_hit = clean
    if prefix_hit:
        return prefix_hit
    if hint:
        warn("Asset '%s' not found (%s)" % (name, hint))
    return None


def set_prop(obj, names, value):
    """Try several property names (engine versions rename things)."""
    for n in names:
        try:
            obj.set_editor_property(n, value)
            return True
        except Exception:
            continue
    return False


# ---------------------------------------------------------------- Blueprints

def create_blueprint(name, parent_class_path):
    asset_path = BP_DIR + "/" + name
    if eal.does_asset_exist(asset_path):
        log("Exists, reusing: " + asset_path)
        return unreal.load_asset(asset_path)
    parent = unreal.load_class(None, parent_class_path)
    if parent is None:
        raise RuntimeError("parent class not found: " + parent_class_path)
    factory = unreal.BlueprintFactory()
    factory.set_editor_property("parent_class", parent)
    bp = asset_tools.create_asset(name, BP_DIR, None, factory)
    if bp is None:
        raise RuntimeError("create_asset returned None for " + name)
    return bp


def bp_cdo(name):
    gen = unreal.load_object(None, "%s/%s.%s_C" % (BP_DIR, name, name))
    if gen is None:
        raise RuntimeError("generated class missing for " + name)
    return unreal.get_default_object(gen), gen


def compile_and_save(bp, asset_path):
    try:
        unreal.BlueprintEditorLibrary.compile_blueprint(bp)
    except Exception:
        pass
    eal.save_asset(asset_path, only_if_is_dirty=False)


def assign_mannequin(cdo, mesh_path, abp_path):
    mesh_comp = cdo.get_editor_property("mesh")
    if mesh_path:
        mesh = unreal.load_asset(mesh_path)
        if not set_prop(mesh_comp, ["skeletal_mesh_asset", "skeletal_mesh"], mesh):
            warn("could not set skeletal mesh on " + str(cdo))
    set_prop(mesh_comp, ["relative_location"], unreal.Vector(0, 0, -89))
    set_prop(mesh_comp, ["relative_rotation"], unreal.Rotator(0, 0, -90))
    if abp_path:
        abp_name = abp_path.rsplit("/", 1)[-1]
        abp_class = unreal.load_object(None, "%s.%s_C" % (abp_path, abp_name))
        if abp_class:
            set_prop(mesh_comp, ["anim_class"], abp_class)
            set_prop(mesh_comp, ["animation_mode"], unreal.AnimationMode.ANIMATION_BLUEPRINT)


@step("character Blueprints (BP_Vowless, BP_AshboundSoldier)")
def make_character_bps():
    mesh_path = find_asset_by_name("SKM_Quinn", "copy Third Person template Content/Characters first") \
        or find_asset_by_name("SKM_Manny")
    # 5.6+ ships ABP_Unarmed (locomotion + jump) inside the Mannequins folder.
    abp_path = find_asset_by_name("ABP_Unarmed") \
        or find_asset_by_name("ABP_Quinn") or find_asset_by_name("ABP_Manny")

    for name, parent in (
        ("BP_Vowless", "/Script/AshenVow.AV_PlayerCharacter"),
        ("BP_AshboundSoldier", "/Script/AshenVow.AV_AshboundSoldier"),
    ):
        bp = create_blueprint(name, parent)
        cdo, _ = bp_cdo(name)
        assign_mannequin(cdo, mesh_path, abp_path)
        compile_and_save(bp, BP_DIR + "/" + name)


@step("BP_AshenAltar")
def make_altar_bp():
    bp = create_blueprint("BP_AshenAltar", "/Script/AshenVow.AV_AshenAltar")
    cdo, _ = bp_cdo("BP_AshenAltar")
    mesh_comp = cdo.get_editor_property("altar_mesh")
    cube = unreal.load_asset("/Engine/BasicShapes/Cube")
    set_prop(mesh_comp, ["static_mesh"], cube)
    set_prop(mesh_comp, ["relative_scale3d"], unreal.Vector(0.9, 0.9, 1.2))
    compile_and_save(bp, BP_DIR + "/BP_AshenAltar")


@step("BP_AVGameMode (pawn -> BP_Vowless)")
def make_gamemode_bp():
    bp = create_blueprint("BP_AVGameMode", "/Script/AshenVow.AV_GameMode")
    cdo, _ = bp_cdo("BP_AVGameMode")
    vowless = unreal.load_object(None, BP_DIR + "/BP_Vowless.BP_Vowless_C")
    if vowless:
        set_prop(cdo, ["default_pawn_class"], vowless)
    compile_and_save(bp, BP_DIR + "/BP_AVGameMode")


ANIM_DIR = ROOT + "/Anims"


def make_montage(seq_name, montage_name):
    """Create (or reuse) a montage in /Game/AshenVow/Anims from a template sequence."""
    if not eal.does_directory_exist(ANIM_DIR):
        eal.make_directory(ANIM_DIR)
    asset_path = ANIM_DIR + "/" + montage_name
    if eal.does_asset_exist(asset_path):
        return unreal.load_asset(asset_path)
    seq_path = find_asset_by_name(seq_name)
    if not seq_path:
        warn("animation '%s' not found, montage skipped" % seq_name)
        return None
    seq = unreal.load_asset(seq_path)
    factory = unreal.AnimMontageFactory()
    set_prop(factory, ["target_skeleton"], seq.get_editor_property("skeleton"))
    if not set_prop(factory, ["source_animation"], seq):
        warn("AnimMontageFactory lacks source_animation; montage may be empty")
    montage = asset_tools.create_asset(montage_name, ANIM_DIR, None, factory)
    if montage:
        eal.save_asset(asset_path, only_if_is_dirty=False)
    return montage


def set_cdo_montage(cdo, prop_name, montage):
    if montage and not set_prop(cdo, [prop_name], montage):
        warn("could not set %s" % prop_name)


@step("attack montages (template MM_Attack anims -> player + soldier)")
def make_attack_montages():
    light1 = make_montage("MM_Attack_01", "M_Attack_Light1")
    light2 = make_montage("MM_Attack_02", "M_Attack_Light2")
    heavy = make_montage("MM_ChargedAttack", "M_Attack_Heavy")
    lights = [m for m in (light1, light2) if m]

    def assign(bp_name, combo_prop, montages, heavy_montage=None):
        cdo, _ = bp_cdo(bp_name)
        combo = cdo.get_editor_property(combo_prop)
        new_combo = unreal.Array(unreal.AV_AttackData)
        for i, attack in enumerate(combo):
            if montages:
                attack.set_editor_property("montage", montages[i % len(montages)])
            new_combo.append(attack)
        cdo.set_editor_property(combo_prop, new_combo)
        if heavy_montage:
            heavy_attack = cdo.get_editor_property("heavy_attack")
            heavy_attack.set_editor_property("montage", heavy_montage)
            cdo.set_editor_property("heavy_attack", heavy_attack)
        compile_and_save(unreal.load_asset(BP_DIR + "/" + bp_name), BP_DIR + "/" + bp_name)

    if lights:
        assign("BP_Vowless", "light_attack_combo", lights, heavy)
        assign("BP_AshboundSoldier", "attack_combo", lights)


@step("reaction montages (hit react / stagger / death / dodge / rest)")
def make_reaction_montages():
    hit_light = make_montage("MM_HitReact_Front_Lgt_01", "M_HitReact_Light")
    hit_med = make_montage("MM_HitReact_Front_Med_01", "M_HitReact_Medium")
    death = make_montage("MM_Death_Front_01", "M_Death")
    rest = make_montage("MM_Land", "M_Rest")  # slow-played kneel placeholder for sitting

    for bp_name in ("BP_Vowless", "BP_AshboundSoldier"):
        cdo, _ = bp_cdo(bp_name)
        set_cdo_montage(cdo, "hit_react_montage", hit_light)
        set_cdo_montage(cdo, "stagger_montage", hit_med)
        set_cdo_montage(cdo, "death_montage", death)
        if bp_name == "BP_Vowless":
            # No roll anim ships with the template: leave DodgeMontage empty so the
            # C++ procedural roll (mesh tumble) is used instead of the leap-like dash.
            set_prop(cdo, ["dodge_montage"], None)
            set_cdo_montage(cdo, "rest_montage", rest)
        compile_and_save(unreal.load_asset(BP_DIR + "/" + bp_name), BP_DIR + "/" + bp_name)


@step("hit flash material (red overlay when damaged)")
def make_hitflash_material():
    fx_dir = ROOT + "/FX"
    if not eal.does_directory_exist(fx_dir):
        eal.make_directory(fx_dir)
    mat_path = fx_dir + "/M_HitFlash"

    if eal.does_asset_exist(mat_path):
        mat = unreal.load_asset(mat_path)
    else:
        mat = asset_tools.create_asset("M_HitFlash", fx_dir, None, unreal.MaterialFactoryNew())
        mel = unreal.MaterialEditingLibrary
        mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
        mat.set_editor_property("two_sided", True)
        set_prop(mat, ["used_with_skeletal_mesh"], True)
        color = mel.create_material_expression(mat, unreal.MaterialExpressionConstant3Vector, -350, 0)
        color.set_editor_property("constant", unreal.LinearColor(2.0, 0.04, 0.02, 1.0))
        mel.connect_material_property(color, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
        opacity = mel.create_material_expression(mat, unreal.MaterialExpressionConstant, -350, 220)
        opacity.set_editor_property("r", 0.45)
        mel.connect_material_property(opacity, "", unreal.MaterialProperty.MP_OPACITY)
        mel.recompile_material(mat)
        eal.save_asset(mat_path, only_if_is_dirty=False)

    for bp_name in ("BP_Vowless", "BP_AshboundSoldier"):
        cdo, _ = bp_cdo(bp_name)
        set_cdo_montage(cdo, "hit_flash_material", mat)
        compile_and_save(unreal.load_asset(BP_DIR + "/" + bp_name), BP_DIR + "/" + bp_name)


# ---------------------------------------------------------------------- Map

def spawn(actor_subsys, cls, loc, rot=unreal.Rotator(0, 0, 0)):
    return actor_subsys.spawn_actor_from_class(cls, unreal.Vector(*loc), rot)


@step("L_CrownlessGate map")
def make_map():
    level_subsys = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actor_subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

    if eal.does_asset_exist(MAP_PATH):
        log("Map exists; loading instead of recreating")
        level_subsys.load_level(MAP_PATH)
    else:
        level_subsys.new_level(MAP_PATH)

        cube = unreal.load_asset("/Engine/BasicShapes/Cube")

        # Ash-field floor: 80m x 80m slab.
        floor = spawn(actor_subsys, unreal.StaticMeshActor, (0, 0, -50))
        floor.set_actor_label("Floor_AshField")
        floor.static_mesh_component.set_static_mesh(cube)
        floor.set_actor_scale3d(unreal.Vector(80, 80, 1))

        # Pale, low "White Sun" light.
        sun = spawn(actor_subsys, unreal.DirectionalLight, (0, 0, 1000), unreal.Rotator(-32, 0, 38))
        sun.set_actor_label("WhiteSun")
        set_prop(sun.light_component, ["intensity"], 4.0)
        set_prop(sun.light_component, ["light_color"], unreal.Color(250, 245, 232, 255))

        sky = spawn(actor_subsys, unreal.SkyAtmosphere, (0, 0, 0))
        sky.set_actor_label("SkyAtmosphere")
        skylight = spawn(actor_subsys, unreal.SkyLight, (0, 0, 400))
        skylight.set_actor_label("SkyLight")
        set_prop(skylight.light_component, ["real_time_capture"], True)

        fog = spawn(actor_subsys, unreal.ExponentialHeightFog, (0, 0, 0))
        fog.set_actor_label("PaleFog")
        fog_comp = fog.get_editor_property("component")
        set_prop(fog_comp, ["fog_density"], 0.04)
        set_prop(fog_comp, ["fog_inscattering_luminance", "fog_inscattering_color"],
                 unreal.LinearColor(0.62, 0.60, 0.55, 1.0))

        spawn(actor_subsys, unreal.PlayerStart, (0, 0, 100))

        # Gameplay actors: altar near the start, soldier down the field.
        altar_cls = unreal.load_object(None, BP_DIR + "/BP_AshenAltar.BP_AshenAltar_C")
        if altar_cls:
            altar = spawn(actor_subsys, altar_cls, (450, 350, 60))
            altar.set_actor_label("AshenAltar_First")

        soldier_cls = unreal.load_object(None, BP_DIR + "/BP_AshboundSoldier.BP_AshboundSoldier_C")
        if soldier_cls:
            soldier = spawn(actor_subsys, soldier_cls, (1800, 0, 100))
            soldier.set_actor_label("AshboundSoldier_01")

        # Navmesh over the whole field (enemies fall back to direct movement without it).
        try:
            nav = spawn(actor_subsys, unreal.NavMeshBoundsVolume, (0, 0, 0))
            nav.set_actor_scale3d(unreal.Vector(45, 45, 10))
        except Exception as e:
            warn("NavMeshBoundsVolume could not be placed (%s) — drag one in manually, or rely on direct movement" % e)

    # Point the level at the BP game mode so BP_Vowless (with mesh) is the pawn.
    try:
        gm_cls = unreal.load_object(None, BP_DIR + "/BP_AVGameMode.BP_AVGameMode_C")
        world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
        for actor in unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors():
            if isinstance(actor, unreal.WorldSettings) and gm_cls:
                set_prop(actor, ["default_game_mode"], gm_cls)
    except Exception as e:
        warn("could not set per-map game mode override (%s) — config default still applies" % e)

    level_subsys.save_current_level()


@step("Milestone 2 actors (Elya + pickups) in L_CrownlessGate")
def populate_milestone2():
    mesh_path = find_asset_by_name("SKM_Quinn") or find_asset_by_name("SKM_Manny")
    abp_path = find_asset_by_name("ABP_Unarmed")
    bp = create_blueprint("BP_Elya", "/Script/AshenVow.AV_ElyaNPC")
    cdo, _ = bp_cdo("BP_Elya")
    assign_mannequin(cdo, mesh_path, abp_path)
    compile_and_save(bp, BP_DIR + "/BP_Elya")

    level_subsys = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actor_subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    level_subsys.load_level(MAP_PATH)

    existing = {a.get_actor_label() for a in actor_subsys.get_all_level_actors()}
    sphere = unreal.load_asset("/Engine/BasicShapes/Sphere")

    # Sun pitch was passed in the wrong Rotator slot originally (roll, pitch, yaw).
    for actor in actor_subsys.get_all_level_actors():
        if actor.get_actor_label() == "WhiteSun":
            actor.set_actor_rotation(unreal.Rotator(0.0, -35.0, 40.0), False)

    if "Elya_Guide" not in existing:
        elya_cls = unreal.load_object(None, BP_DIR + "/BP_Elya.BP_Elya_C")
        if elya_cls:
            elya = spawn(actor_subsys, elya_cls, (1100, -500, 100), unreal.Rotator(0.0, 0.0, 35.0))
            elya.set_actor_label("Elya_Guide")

    pickup_cls = unreal.load_class(None, "/Script/AshenVow.AV_ItemPickup")

    def spawn_pickup(label, loc, config):
        if label in existing or not pickup_cls:
            return
        pickup = spawn(actor_subsys, pickup_cls, loc)
        pickup.set_actor_label(label)
        mesh_comp = pickup.get_editor_property("pickup_mesh")
        if sphere and mesh_comp:
            mesh_comp.set_static_mesh(sphere)
        pickup.set_actor_scale3d(unreal.Vector(0.35, 0.35, 0.35))
        for key, value in config.items():
            set_prop(pickup, [key], value)

    spawn_pickup("Pickup_AshCache_SidePath", (650, 950, 40), {
        "pickup_type": unreal.AV_PickupType.ASH,
        "ash_amount": 60,
        "unique_pickup_id": "AshField_AshCache_01",
        "display_name": "Handful of Ash",
    })
    spawn_pickup("Pickup_Lore_KneelingStone", (1550, 650, 40), {
        "pickup_type": unreal.AV_PickupType.LORE,
        "unique_pickup_id": "AshField_Lore_01",
        "display_name": "Cracked Oath-Tablet",
        "memory_thread_id": "Thread_AshGathers",
        "memory_thread_text": "Ash gathers where names are forgotten.",
    })

    level_subsys.save_current_level()


def main():
    for d in (ROOT, BP_DIR, MAP_DIR):
        if not eal.does_directory_exist(d):
            eal.make_directory(d)

    make_character_bps()
    make_altar_bp()
    make_gamemode_bp()
    make_attack_montages()
    make_reaction_montages()
    make_hitflash_material()
    make_map()
    populate_milestone2()
    eal.save_directory(ROOT, only_if_is_dirty=False, recursive=True)

    log("================ SETUP SUMMARY ================")
    for s in OK:
        log("  done: " + s)
    for w in WARN:
        unreal.log_warning("  check: " + w)
    log("===============================================")


main()
