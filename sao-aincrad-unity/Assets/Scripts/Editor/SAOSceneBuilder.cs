using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using UnityEditor;
using UnityEditor.SceneManagement;
using SAO.Interaction;
using SAO.Player;
using SAO.UI;

namespace SAO.EditorTools
{
    /// <summary>
    /// One-click greybox builders so the project runs with zero manual scene
    /// authoring. Everything is primitives + the SAO/Toon shader; swap in real
    /// models later without touching code.
    ///
    ///   Tools > SAO > 1. Create Toon Materials
    ///   Tools > SAO > 2. Build Inn Greybox (First Haven)
    ///   Tools > SAO > 3. Build FPS Player Rig
    ///   Tools > SAO > 4. Build Main Menu Scene Content
    ///
    /// Typical flow: new empty scene -> run 2 then 3 -> save as
    /// "FirstHaven". Another empty scene -> run 4 -> save as "MainMenu".
    /// Add both to Build Settings (MainMenu first).
    /// </summary>
    public static class SAOSceneBuilder
    {
        private const string GenFolder = "Assets/SAO_Generated";
        private const string MatFolder = GenFolder + "/Materials";

        // ================================================================== //
        //  1. MATERIALS
        // ================================================================== //

        [MenuItem("Tools/SAO/1. Create Toon Materials", false, 1)]
        public static void CreateMaterials()
        {
            if (!ShadersOk())
            {
                EditorUtility.DisplayDialog("SAO Builder",
                    "Required shaders not found.\n" +
                    "Built-in RP needs 'SAO/Toon'; URP needs 'SAO/ToonURP' or the\n" +
                    "'Universal Render Pipeline/Lit' fallback.\n" +
                    "'SAO/SkyGradient' is required in both.\n" +
                    "Check that Assets/Shaders imported without compile errors.", "OK");
                return;
            }
            // Under URP, warn once if we're on the flat-color Lit fallback.
            // (ShadersOk above guarantees the picker returned a shader.)
            if (GraphicsSettings.currentRenderPipeline != null)
            {
                var toon = PickToonShader();
                if (toon != null && toon.name != "SAO/ToonURP")
                    Debug.LogWarning("[SAO] 'SAO/ToonURP' is missing or has compile errors — " +
                                     "generated materials fall back to flat-color URP Lit " +
                                     "(correct colors, but no bands/outlines until the shader is fixed).");
            }

            EnsureFolder("Assets", "SAO_Generated");
            EnsureFolder(GenFolder, "Materials");

            // --- Inn / environment ------------------------------------------
            // Architecture gets no outline (inverted-hull lines gap on hard
            // cube corners); structure and furniture get progressively bolder
            // lines the smaller and more "prop-like" they are.
            ToonMat("Stone_Floor",  new Color(0.56f, 0.53f, 0.49f), new Color(0.58f, 0.57f, 0.72f), 0f);
            ToonMat("Plaster",      new Color(0.93f, 0.88f, 0.78f), new Color(0.66f, 0.64f, 0.82f), 0f);
            ToonMat("Wood_Dark",    new Color(0.40f, 0.29f, 0.19f), new Color(0.60f, 0.50f, 0.62f), 1.2f);
            ToonMat("Wood_Mid",     new Color(0.55f, 0.40f, 0.26f), new Color(0.60f, 0.50f, 0.62f), 1.6f,
                    new Color(0.35f, 0.28f, 0.20f), 64f, Color.black);   // faint varnish sheen
            ToonMat("Stone_Dark",   new Color(0.44f, 0.42f, 0.41f), new Color(0.56f, 0.54f, 0.70f), 1.2f);
            ToonMat("Charcoal",     new Color(0.12f, 0.10f, 0.10f), new Color(0.50f, 0.48f, 0.60f), 0f);
            ToonMat("Fabric_Red",   new Color(0.62f, 0.18f, 0.16f), new Color(0.55f, 0.42f, 0.62f), 1.4f);
            ToonMat("Brass",        new Color(0.71f, 0.55f, 0.31f), new Color(0.55f, 0.45f, 0.60f), 1.8f,
                    new Color(1f, 0.9f, 0.65f), 180f, Color.black);      // sharp metal ping
            ToonMat("Lantern_Glass", new Color(1f, 0.85f, 0.60f), new Color(0.8f, 0.7f, 0.6f), 0f,
                    Color.black, 96f, new Color(2.6f, 1.6f, 0.7f));      // HDR -> bloom halo
            ToonMat("Ember",        new Color(0.90f, 0.40f, 0.15f), new Color(0.6f, 0.3f, 0.2f), 0f,
                    Color.black, 96f, new Color(3.0f, 0.9f, 0.25f));
            ToonMat("Window_SunGlow", new Color(1f, 0.92f, 0.72f), new Color(0.8f, 0.75f, 0.65f), 0f,
                    Color.black, 96f, new Color(2.4f, 1.5f, 0.85f));     // fake low sun in the panes

            // --- Menu castle -------------------------------------------------
            ToonMat("Castle_Stone", new Color(0.58f, 0.60f, 0.70f), new Color(0.52f, 0.50f, 0.72f), 1.0f);
            ToonMat("Castle_Roof",  new Color(0.32f, 0.36f, 0.55f), new Color(0.45f, 0.42f, 0.66f), 1.0f);
            ToonMat("Window_Glow",  new Color(1f, 0.85f, 0.55f), new Color(0.8f, 0.7f, 0.6f), 0f,
                    Color.black, 96f, new Color(2.8f, 1.8f, 0.85f));

            // --- Skies -------------------------------------------------------
            SkyMat("Sky_Floor1",
                   new Color(0.22f, 0.26f, 0.55f),   // zenith violet-blue
                   new Color(1.00f, 0.72f, 0.48f),   // peach horizon
                   new Color(0.35f, 0.27f, 0.42f));
            SkyMat("Sky_Menu",
                   new Color(0.16f, 0.16f, 0.42f),   // deeper dusk for the menu
                   new Color(1.00f, 0.62f, 0.42f),
                   new Color(0.28f, 0.20f, 0.38f));

            AssetDatabase.SaveAssets();
            Debug.Log("[SAO] Toon materials ready in " + MatFolder);
        }

        // ================================================================== //
        //  2. INN GREYBOX
        // ================================================================== //

        [MenuItem("Tools/SAO/2. Build Inn Greybox (First Haven)", false, 2)]
        public static void BuildInn()
        {
            CreateMaterials();   // idempotent; dialogs + aborts if the shaders are missing
            if (!ShadersOk()) return;

            // ---- idempotency: tear down previous builds before rebuilding ----
            // The inn root name is unambiguously builder-owned, so it is found
            // anywhere in the hierarchy (the pre-rename name included).
            GameObject stale;
            while ((stale = GameObject.Find("Inn_FirstHaven")) != null)
                Undo.DestroyObjectImmediate(stale);
            while ((stale = GameObject.Find("Inn_TownOfBeginnings")) != null)   // legacy root name
                Undo.DestroyObjectImmediate(stale);
            // Stray suns from pre-hierarchy builds were SCENE-ROOT objects, so
            // only scan the roots for that name — a user-authored child light
            // that happens to be called Sun_LateAfternoon must never be
            // deleted. The scan also catches inactive inn roots, which
            // GameObject.Find skips.
            foreach (var go in SceneManager.GetActiveScene().GetRootGameObjects())
                if (go.name == "Inn_FirstHaven" || go.name == "Inn_TownOfBeginnings" ||
                    go.name == "Sun_LateAfternoon")
                    Undo.DestroyObjectImmediate(go);

            var root = new GameObject("Inn_FirstHaven");
            Undo.RegisterCreatedObjectUndo(root, "Build Inn Greybox");

            Transform architecture = Group(root.transform, "Architecture");
            Transform furniture    = Group(root.transform, "Furniture");
            Transform lighting     = Group(root.transform, "Lighting");
            Transform spawnPoints  = Group(root.transform, "SpawnPoints");
            Transform atmosphere   = Group(root.transform, "Atmosphere");

            BuildShell(architecture);
            BuildTimberFrame(architecture);
            BuildFireplaceMasonry(architecture);
            BuildFurniture(furniture);
            BuildInnLights(lighting);
            BuildAtmosphere(atmosphere);

            // Spawn faces +Z: doorway at your back, bar straight ahead.
            var spawn = new GameObject("PlayerSpawn_Inn");
            spawn.transform.SetParent(spawnPoints, false);
            spawn.transform.localPosition = new Vector3(0f, 0.05f, -3.4f);

            ApplyInnRenderSettings();
            DisableExtraDirectionalLights(root.transform);

            Selection.activeGameObject = root;
            MarkDirty();

            int objectCount = root.GetComponentsInChildren<Transform>(true).Length;
            Debug.Log($"[SAO] Inn greybox built ({objectCount} objects). " +
                      "Next: 'Tools > SAO > 3. Build FPS Player Rig', then save the scene as 'FirstHaven'.");
        }

        // ---- architecture: floor/ceiling/walls with REAL window openings ----
        private static void BuildShell(Transform parent)
        {
            // Interior 12 x 9 m, 3.4 m ceiling; origin = floor center.
            // Primitives keep their default BoxColliders, so the room is
            // walkable as soon as the player rig exists.
            Box("Floor",   new Vector3(0f, -0.10f, 0f), new Vector3(12.6f, 0.2f, 9.6f), "Stone_Floor", parent);
            Box("Ceiling", new Vector3(0f,  3.50f, 0f), new Vector3(12.6f, 0.2f, 9.6f), "Wood_Dark",   parent);

            Box("Wall_N", new Vector3(0f, 1.70f, 4.65f), new Vector3(12.6f, 3.4f, 0.3f), "Plaster", parent);
            Box("Wall_E", new Vector3(6.45f, 1.70f, 0f), new Vector3(0.3f, 3.4f, 9.6f),  "Plaster", parent);

            // West wall is segmented around two REAL openings (z -2.5..-1.5 and
            // 1.5..2.5, sill 1.25 / head 2.55) so the low sun genuinely enters
            // and paints shafts on the floor — the anime money shot.
            Box("Wall_W_South",  new Vector3(-6.45f, 1.700f, -3.65f), new Vector3(0.3f, 3.40f, 2.3f), "Plaster", parent);
            Box("Wall_W_Mid",    new Vector3(-6.45f, 1.700f,  0.00f), new Vector3(0.3f, 3.40f, 3.0f), "Plaster", parent);
            Box("Wall_W_North",  new Vector3(-6.45f, 1.700f,  3.65f), new Vector3(0.3f, 3.40f, 2.3f), "Plaster", parent);
            Box("Wall_W_BelowA", new Vector3(-6.45f, 0.625f, -2.00f), new Vector3(0.3f, 1.25f, 1.0f), "Plaster", parent);
            Box("Wall_W_AboveA", new Vector3(-6.45f, 2.975f, -2.00f), new Vector3(0.3f, 0.85f, 1.0f), "Plaster", parent);
            Box("Wall_W_BelowB", new Vector3(-6.45f, 0.625f,  2.00f), new Vector3(0.3f, 1.25f, 1.0f), "Plaster", parent);
            Box("Wall_W_AboveB", new Vector3(-6.45f, 2.975f,  2.00f), new Vector3(0.3f, 0.85f, 1.0f), "Plaster", parent);

            BuildWindowAssembly(parent, -2.0f);
            BuildWindowAssembly(parent,  2.0f);

            // South wall split around a 1.4 m doorway.
            Box("Wall_S_Left",   new Vector3(-3.5f, 1.70f, -4.65f), new Vector3(5.6f, 3.4f, 0.3f), "Plaster", parent);
            Box("Wall_S_Right",  new Vector3(3.5f, 1.70f, -4.65f),  new Vector3(5.6f, 3.4f, 0.3f), "Plaster", parent);
            Box("Wall_S_Lintel", new Vector3(0f, 2.85f, -4.65f),    new Vector3(1.4f, 1.1f, 0.3f), "Plaster", parent);

            // Door frame + a leaf standing ajar (hinged on the left jamb).
            // At -65 degrees the clear width is ~0.85 m — plenty for the
            // CharacterController's 0.35 m radius.
            Box("DoorJamb_L", new Vector3(-0.78f, 1.15f, -4.65f), new Vector3(0.18f, 2.3f, 0.4f),  "Wood_Dark", parent);
            Box("DoorJamb_R", new Vector3(0.78f, 1.15f, -4.65f),  new Vector3(0.18f, 2.3f, 0.4f),  "Wood_Dark", parent);
            Box("DoorHeader", new Vector3(0f, 2.39f, -4.65f),     new Vector3(1.74f, 0.18f, 0.4f), "Wood_Dark", parent);

            var hinge = new GameObject("Door_Hinge");
            hinge.transform.SetParent(parent, false);
            hinge.transform.localPosition = new Vector3(-0.70f, 1.15f, -4.50f);
            hinge.transform.localRotation = Quaternion.Euler(0f, -65f, 0f);   // swung into the room
            Box("Door_Leaf",    new Vector3(0.65f, 0f, 0f),    new Vector3(1.30f, 2.24f, 0.07f), "Wood_Mid", hinge.transform);
            Ball("Door_Handle", new Vector3(1.18f, 0f, 0.07f), new Vector3(0.07f, 0.07f, 0.07f), "Brass", hinge.transform);

            // Baseboard trim — grounds the walls; cheap, clean-anime detail.
            Box("Trim_Base_N",  new Vector3(0f, 0.06f, 4.47f),     new Vector3(12.0f, 0.12f, 0.06f), "Wood_Dark", parent);
            Box("Trim_Base_E",  new Vector3(6.27f, 0.06f, 0f),     new Vector3(0.06f, 0.12f, 9.0f),  "Wood_Dark", parent);
            Box("Trim_Base_W",  new Vector3(-6.27f, 0.06f, 0f),    new Vector3(0.06f, 0.12f, 9.0f),  "Wood_Dark", parent);
            Box("Trim_Base_SL", new Vector3(-3.5f, 0.06f, -4.47f), new Vector3(5.6f, 0.12f, 0.06f),  "Wood_Dark", parent);
            Box("Trim_Base_SR", new Vector3(3.5f, 0.06f, -4.47f),  new Vector3(5.6f, 0.12f, 0.06f),  "Wood_Dark", parent);
        }

        private static void BuildWindowAssembly(Transform parent, float zCenter)
        {
            var w = new GameObject("Window_" + (zCenter < 0f ? "A" : "B"));
            w.transform.SetParent(parent, false);
            w.transform.localPosition = new Vector3(-6.45f, 1.90f, zCenter);
            Transform t = w.transform;

            // The glowing pane sits IN the opening. Shadow casting is disabled
            // so the directional light passes through it onto the floor while
            // the pane itself still reads as a lit window (and feeds bloom).
            var pane = Box("Pane", Vector3.zero, new Vector3(0.10f, 1.30f, 1.00f), "Window_SunGlow", t);
            pane.GetComponent<MeshRenderer>().shadowCastingMode = ShadowCastingMode.Off;

            Box("Muntin_V", new Vector3(0.08f, 0f, 0f), new Vector3(0.05f, 1.30f, 0.08f), "Wood_Dark", t);
            Box("Muntin_H", new Vector3(0.08f, 0f, 0f), new Vector3(0.05f, 0.08f, 1.00f), "Wood_Dark", t);

            // Frame trim + a protruding sill.
            Box("Frame_L",   new Vector3(0.08f, 0f, -0.53f), new Vector3(0.14f, 1.46f, 0.10f), "Wood_Dark", t);
            Box("Frame_R",   new Vector3(0.08f, 0f, 0.53f),  new Vector3(0.14f, 1.46f, 0.10f), "Wood_Dark", t);
            Box("Frame_Top", new Vector3(0.08f, 0.69f, 0f),  new Vector3(0.14f, 0.10f, 1.16f), "Wood_Dark", t);
            Box("Sill",      new Vector3(0.13f, -0.69f, 0f), new Vector3(0.26f, 0.08f, 1.25f), "Wood_Mid",  t);
        }

        private static void BuildTimberFrame(Transform parent)
        {
            // Chunky storybook proportions: ~30% thicker than realistic timber
            // so the silhouettes survive cel shading.
            foreach (float x in new[] { -3f, 3f })
                foreach (float z in new[] { -1.5f, 1.5f })
                    Box($"Post_{x}_{z}", new Vector3(x, 1.7f, z), new Vector3(0.25f, 3.4f, 0.25f), "Wood_Dark", parent);

            foreach (float x in new[] { -3f, 0f, 3f })
                Box($"Beam_Cross_{x}", new Vector3(x, 3.27f, 0f), new Vector3(0.3f, 0.25f, 9.0f), "Wood_Dark", parent);

            Box("Beam_Ridge", new Vector3(0f, 3.02f, 0f), new Vector3(12.2f, 0.25f, 0.3f), "Wood_Dark", parent);
        }

        private static void BuildFireplaceMasonry(Transform parent)
        {
            Box("Fireplace_Body",    new Vector3(5.80f, 1.10f, 2.6f), new Vector3(1.0f, 2.2f, 1.6f),  "Stone_Dark", parent);
            Box("Fireplace_Opening", new Vector3(5.55f, 0.55f, 2.6f), new Vector3(0.6f, 1.1f, 1.0f),  "Charcoal",   parent);
            Box("Fireplace_Breast",  new Vector3(5.90f, 2.95f, 2.6f), new Vector3(0.8f, 1.0f, 1.3f),  "Stone_Dark", parent);
            Box("Fireplace_Mantel",  new Vector3(5.45f, 2.30f, 2.6f), new Vector3(0.6f, 0.10f, 1.9f), "Wood_Mid",   parent);
            Box("Fireplace_Hearth",  new Vector3(5.15f, 0.03f, 2.6f), new Vector3(1.2f, 0.06f, 1.8f), "Stone_Dark", parent);
        }

        private static readonly Vector3[] InnTablePositions =
        {
            new Vector3(-3.4f, 0f, -2.7f),
            new Vector3(3.4f, 0f, -2.7f),
            new Vector3(-3.6f, 0f, 2.3f),
        };

        private static void BuildFurniture(Transform parent)
        {
            Box("Bar_Body",  new Vector3(0f, 0.50f, 3.6f), new Vector3(4.0f, 1.0f, 0.6f),   "Wood_Dark", parent);
            Box("Bar_Top",   new Vector3(0f, 1.05f, 3.6f), new Vector3(4.4f, 0.1f, 0.8f),   "Wood_Mid",  parent);
            Box("Bar_Shelf", new Vector3(0f, 2.00f, 4.4f), new Vector3(3.6f, 0.08f, 0.35f), "Wood_Mid",  parent);

            Cyl("BarStool_L", new Vector3(-1.2f, 0.325f, 2.9f), new Vector3(0.34f, 0.325f, 0.34f), "Wood_Mid", parent);
            Cyl("BarStool_R", new Vector3(1.2f, 0.325f, 2.9f),  new Vector3(0.34f, 0.325f, 0.34f), "Wood_Mid", parent);

            // First real IInteractable: a small red sign on the counter at
            // readable height. Cube primitive = BoxCollider for the probe to
            // hit; DebugSignInteractable supplies the prompt and the on-use
            // log. Doors / NPCs / notice boards follow this same pattern.
            var sign = Box("Debug_Interactable_Sign", new Vector3(1.4f, 1.275f, 3.45f),
                new Vector3(0.55f, 0.35f, 0.06f), "Fabric_Red", parent);
            sign.AddComponent<DebugSignInteractable>();

            for (int i = 0; i < InnTablePositions.Length; i++)
                BuildTable(parent, InnTablePositions[i], i);

            Box("Rug", new Vector3(0f, 0.012f, -1.2f), new Vector3(2.6f, 0.024f, 1.8f), "Fabric_Red", parent);
        }

        private static void BuildInnLights(Transform parent)
        {
            // Key light: late-afternoon sun raking in through the west windows.
            var sunGo = new GameObject("Sun_LateAfternoon");
            sunGo.transform.SetParent(parent, false);
            sunGo.transform.rotation = Quaternion.Euler(26f, 96f, 0f);
            var sun = sunGo.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.83f, 0.62f);
            sun.intensity = 1.15f;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.85f;
            RenderSettings.sun = sun;

            // Lanterns: two on posts (with bracket arms), one hung over the bar.
            Lantern(parent, new Vector3(3f, 2.35f, 1.2f));
            Box("Lantern_Arm_A", new Vector3(3f, 2.52f, 1.34f), new Vector3(0.06f, 0.06f, 0.40f), "Wood_Dark", parent);
            Lantern(parent, new Vector3(-3f, 2.35f, -1.2f));
            Box("Lantern_Arm_B", new Vector3(-3f, 2.52f, -1.34f), new Vector3(0.06f, 0.06f, 0.40f), "Wood_Dark", parent);
            Lantern(parent, new Vector3(0f, 2.50f, 3.4f));
            Box("Lantern_Rod", new Vector3(0f, 3.04f, 3.4f), new Vector3(0.04f, 0.71f, 0.04f), "Brass", parent);

            PointLight(parent, "FireLight", new Vector3(5.2f, 0.8f, 2.6f), new Color(1f, 0.55f, 0.25f), 1.6f, 7f);
        }

        private static void BuildAtmosphere(Transform parent)
        {
            // Emissive dressing lives here (future home of dust-mote particles).
            Box("Fireplace_Embers", new Vector3(5.45f, 0.16f, 2.6f), new Vector3(0.5f, 0.16f, 0.7f), "Ember", parent);

            // Unlit table candles: no extra point lights (pixel-light budget),
            // just a faint emissive flame that catches the bloom pass.
            foreach (Vector3 p in InnTablePositions)
            {
                Cyl("Candle", p + new Vector3(0f, 0.83f, 0f), new Vector3(0.05f, 0.05f, 0.05f), "Wood_Mid", parent);
                Ball("Candle_Flame", p + new Vector3(0f, 0.91f, 0f), new Vector3(0.05f, 0.07f, 0.05f), "Lantern_Glass", parent);
            }
        }

        private static void ApplyInnRenderSettings()
        {
            RenderSettings.ambientMode = AmbientMode.Flat;
            // Cool violet fill against the warm key = the anime complement.
            RenderSettings.ambientLight = new Color(0.36f, 0.38f, 0.52f);
            // Deliberately NO fog indoors: a 12 m room gains no readable depth
            // from it, and dense fog reads "smoky" — fights the clean look.
            RenderSettings.fog = false;

            var sky = FindMat("Sky_Floor1");
            if (sky != null) RenderSettings.skybox = sky;
        }

        private static void BuildTable(Transform parent, Vector3 pos, int variant)
        {
            var g = new GameObject("Table_" + variant);
            g.transform.SetParent(parent, false);
            g.transform.localPosition = pos;
            Transform t = g.transform;

            // Cylinder primitives are 2 m tall at scale 1, so scaleY = height/2.
            Cyl("Top",  new Vector3(0f, 0.74f, 0f), new Vector3(1.20f, 0.04f, 1.20f), "Wood_Mid",  t);
            Cyl("Leg",  new Vector3(0f, 0.35f, 0f), new Vector3(0.14f, 0.35f, 0.14f), "Wood_Dark", t);
            Cyl("Base", new Vector3(0f, 0.03f, 0f), new Vector3(0.55f, 0.03f, 0.55f), "Wood_Dark", t);

            for (int k = 0; k < 3; k++)
            {
                float ang = (variant * 30f + 20f + k * 120f) * Mathf.Deg2Rad;
                var stoolPos = new Vector3(Mathf.Cos(ang) * 0.95f, 0.23f, Mathf.Sin(ang) * 0.95f);
                Cyl("Stool_" + k, stoolPos, new Vector3(0.34f, 0.23f, 0.34f), "Wood_Mid", t);
            }
        }

        private static void Lantern(Transform parent, Vector3 pos)
        {
            var g = new GameObject("Lantern");
            g.transform.SetParent(parent, false);
            g.transform.localPosition = pos;
            Transform t = g.transform;

            Box("Frame", new Vector3(0f, 0.06f, 0f), new Vector3(0.16f, 0.26f, 0.16f), "Brass", t);
            Ball("Glass", new Vector3(0f, -0.02f, 0f), new Vector3(0.20f, 0.20f, 0.20f), "Lantern_Glass", t);
            // No shadows on lantern lights: cheap, and the toon ForwardAdd pass
            // posterizes the falloff into a flat painted pool anyway.
            PointLight(t, "LanternLight", new Vector3(0f, -0.05f, 0f), new Color(1f, 0.72f, 0.42f), 1.25f, 5.5f);
        }

        // ================================================================== //
        //  3. PLAYER RIG + HUD
        // ================================================================== //

        [MenuItem("Tools/SAO/3. Build FPS Player Rig", false, 3)]
        public static void BuildPlayer()
        {
            // 'Player' and 'PlayerHUD' are generated prototype objects owned
            // by this builder: they are found BY NAME and torn down on every
            // run so the menu item stays repeatable (same pattern as
            // BuildInn). Don't hand-author scene objects with these names.
            // Find catches active objects anywhere; GetRootGameObjects
            // catches inactive leftovers at the scene root.
            GameObject stale;
            while ((stale = GameObject.Find("Player")) != null)
                Undo.DestroyObjectImmediate(stale);
            foreach (var go in SceneManager.GetActiveScene().GetRootGameObjects())
                if (go.name == "Player" || go.name == "PlayerHUD")
                    Undo.DestroyObjectImmediate(go);

            DisableExtraCameras(skipMenuCameras: true);

            Vector3 spawnPos = new Vector3(0f, 0.05f, -3.4f);
            var marker = GameObject.Find("PlayerSpawn_Inn");
            if (marker == null) marker = GameObject.Find("PlayerSpawn");   // pre-hierarchy builds
            if (marker != null) spawnPos = marker.transform.position;

            var player = new GameObject("Player");
            Undo.RegisterCreatedObjectUndo(player, "Build Player Rig");
            player.transform.position = spawnPos;

            var cc = player.AddComponent<CharacterController>();
            cc.height = 1.8f;
            cc.radius = 0.35f;
            cc.center = new Vector3(0f, 0.9f, 0f);
            cc.slopeLimit = 45f;
            cc.stepOffset = 0.3f;

            var camGo = new GameObject("PlayerCamera");
            camGo.transform.SetParent(player.transform, false);
            camGo.transform.localPosition = new Vector3(0f, 1.62f, 0f);   // eye height
            camGo.tag = "MainCamera";

            var cam = camGo.AddComponent<Camera>();
            cam.fieldOfView = 62f;
            cam.nearClipPlane = 0.08f;
            cam.allowHDR = true;          // required for bloom thresholds > 1
            camGo.AddComponent<AudioListener>();

            player.AddComponent<FPSController>();        // finds the child camera on Awake
            player.AddComponent<SAOInteractionProbe>();  // crosshair sensor: drives IInteractable + the HUD prompt

            BuildHud(player);

            Selection.activeGameObject = player;
            MarkDirty();
            Debug.Log("[SAO] Player rig + HUD built. Press Play. (WASD / mouse / Space / Shift, E = interact)");
        }

        private static void BuildHud(GameObject player)
        {
            var canvasGo = new GameObject("PlayerHUD", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            Undo.RegisterCreatedObjectUndo(canvasGo, "Build HUD");
            ConfigureCanvas(canvasGo);

            var barRoot = new GameObject("StaminaBar", typeof(RectTransform), typeof(CanvasGroup), typeof(Image));
            barRoot.transform.SetParent(canvasGo.transform, false);
            var rt = (RectTransform)barRoot.transform;
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.zero;
            rt.pivot = Vector2.zero;
            rt.anchoredPosition = new Vector2(46f, 42f);
            rt.sizeDelta = new Vector2(300f, 14f);
            barRoot.GetComponent<Image>().color = new Color(0.04f, 0.05f, 0.09f, 0.55f);

            var fillGo = new GameObject("Fill", typeof(RectTransform), typeof(Image));
            fillGo.transform.SetParent(barRoot.transform, false);
            var frt = (RectTransform)fillGo.transform;
            frt.pivot = new Vector2(0f, 0.5f);     // scale from the left edge
            frt.anchorMin = Vector2.zero;
            frt.anchorMax = Vector2.one;
            frt.offsetMin = new Vector2(2f, 2f);
            frt.offsetMax = new Vector2(-2f, -2f);
            var fillImg = fillGo.GetComponent<Image>();
            fillImg.color = new Color(1f, 0.83f, 0.48f);

            var bar = barRoot.AddComponent<StaminaBar>();
            var so = new SerializedObject(bar);
            so.FindProperty("controller").objectReferenceValue = player.GetComponent<FPSController>();
            so.FindProperty("fillRect").objectReferenceValue = frt;
            so.FindProperty("fillImage").objectReferenceValue = fillImg;
            so.FindProperty("canvasGroup").objectReferenceValue = barRoot.GetComponent<CanvasGroup>();
            so.ApplyModifiedPropertiesWithoutUndo();

            // ---- interaction prompt, center-bottom -------------------------
            // Hidden by default (InteractionPromptUI zeroes the CanvasGroup
            // alpha on Awake); appears while an IInteractable is targeted.
            var promptRoot = new GameObject("InteractionPrompt",
                                            typeof(RectTransform), typeof(CanvasGroup), typeof(Image));
            promptRoot.transform.SetParent(canvasGo.transform, false);
            var prt = (RectTransform)promptRoot.transform;
            prt.anchorMin = prt.anchorMax = new Vector2(0.5f, 0f);
            prt.pivot = new Vector2(0.5f, 0f);
            prt.anchoredPosition = new Vector2(0f, 110f);
            prt.sizeDelta = new Vector2(460f, 44f);
            promptRoot.GetComponent<Image>().color = new Color(0.04f, 0.05f, 0.09f, 0.62f);

            var promptLabel = MakeText(promptRoot.transform, "Press E - Interact", 24,
                                       new Color(0.96f, 0.93f, 0.85f));
            var plrt = (RectTransform)promptLabel.transform;
            plrt.anchorMin = Vector2.zero;
            plrt.anchorMax = Vector2.one;
            plrt.offsetMin = Vector2.zero;
            plrt.offsetMax = Vector2.zero;

            var promptUi = promptRoot.AddComponent<InteractionPromptUI>();
            var pso = new SerializedObject(promptUi);
            pso.FindProperty("probe").objectReferenceValue = player.GetComponent<SAOInteractionProbe>();
            pso.FindProperty("label").objectReferenceValue = promptLabel;
            pso.FindProperty("canvasGroup").objectReferenceValue = promptRoot.GetComponent<CanvasGroup>();
            pso.ApplyModifiedPropertiesWithoutUndo();
        }

        // ================================================================== //
        //  4. MAIN MENU SCENE
        // ================================================================== //

        [MenuItem("Tools/SAO/4. Build Main Menu Scene Content", false, 4)]
        public static void BuildMainMenu()
        {
            CreateMaterials();
            if (!ShadersOk()) return;
            DisableExtraCameras(skipMenuCameras: false);   // must replace our own MenuCamera on re-run

            // ---- the floating castle, as a stack of shrinking tiers --------
            var castle = new GameObject("Skybound_Citadel");
            Undo.RegisterCreatedObjectUndo(castle, "Build Castle");
            Transform ct = castle.transform;

            const int tiers = 12;
            const float tierH = 5.5f;
            for (int i = 0; i < tiers; i++)
            {
                float r = Mathf.Lerp(34f, 7f, i / (float)(tiers - 1));
                float y = i * tierH + tierH * 0.5f;
                Cyl($"Tier_{i:00}", new Vector3(0f, y, 0f),
                    new Vector3(r * 2f, tierH * 0.5f, r * 2f), "Castle_Stone", ct);
                // overhanging floor plate gives the silhouette its layer-cake read
                Cyl($"Plate_{i:00}", new Vector3(0f, i * tierH + tierH - 0.12f, 0f),
                    new Vector3(r * 2f + 2.6f, 0.12f, r * 2f + 2.6f), "Castle_Roof", ct);
            }

            // glowing window dots on a few tiers — city lights at dusk + bloom
            foreach (int ti in new[] { 2, 4, 6, 8, 10 })
            {
                float r = Mathf.Lerp(34f, 7f, ti / (float)(tiers - 1));
                float y = ti * tierH + tierH * 0.5f;
                for (int k = 0; k < 10; k++)
                {
                    float angDeg = k * 36f + ti * 7f;
                    float ang = angDeg * Mathf.Deg2Rad;
                    var pos = new Vector3(Mathf.Cos(ang) * (r + 0.18f),
                                          y + ((k % 3) - 1) * 0.7f,
                                          Mathf.Sin(ang) * (r + 0.18f));
                    var win = Box($"Win_{ti}_{k}", pos, new Vector3(0.7f, 1.0f, 0.7f), "Window_Glow", ct);
                    win.transform.localRotation = Quaternion.Euler(0f, -angDeg, 0f);
                }
            }

            // rounded rock hull underneath + spires on top
            Ball("BaseHull", new Vector3(0f, -4f, 0f), new Vector3(70f, 16f, 70f), "Castle_Stone", ct);
            Caps("Spire_Center", new Vector3(0f, tiers * tierH + 7f, 0f), new Vector3(2.6f, 7f, 2.6f), "Castle_Roof", ct);
            Caps("Spire_L", new Vector3(-4.5f, tiers * tierH + 3.5f, 0f), new Vector3(1.2f, 3.5f, 1.2f), "Castle_Roof", ct);
            Caps("Spire_R", new Vector3(4.5f, tiers * tierH + 3.5f, 0f), new Vector3(1.2f, 3.5f, 1.2f), "Castle_Roof", ct);

            var focus = new GameObject("CastleFocus");
            focus.transform.SetParent(ct, false);
            focus.transform.localPosition = new Vector3(0f, 30f, 0f);

            // ---- orbiting camera --------------------------------------------
            var camGo = new GameObject("MenuCamera");
            Undo.RegisterCreatedObjectUndo(camGo, "Menu Camera");
            camGo.tag = "MainCamera";
            camGo.transform.position = new Vector3(0f, 72f, -115f);

            var cam = camGo.AddComponent<Camera>();
            cam.fieldOfView = 50f;
            cam.farClipPlane = 800f;
            cam.allowHDR = true;
            camGo.AddComponent<AudioListener>();

            var orbit = camGo.AddComponent<MenuOrbitCamera>();
            orbit.target = focus.transform;
            orbit.distance = 115f;
            orbit.height = 42f;
            orbit.degreesPerSecond = 3.5f;

            // ---- dusk lighting ----------------------------------------------
            var sunGo = new GameObject("Sun_Dusk");
            Undo.RegisterCreatedObjectUndo(sunGo, "Menu Sun");
            var sun = sunGo.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.62f, 0.45f);
            sun.intensity = 0.95f;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.7f;
            sunGo.transform.rotation = Quaternion.Euler(9f, -35f, 0f);

            RenderSettings.sun = sun;
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.30f, 0.28f, 0.45f);
            RenderSettings.skybox = FindMat("Sky_Menu");
            RenderSettings.fog = true;                       // depth haze on the far side
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = new Color(0.79f, 0.52f, 0.47f);
            RenderSettings.fogStartDistance = 150f;
            RenderSettings.fogEndDistance = 500f;

            BuildMenuUi();

            Selection.activeGameObject = castle;
            MarkDirty();
            Debug.Log("[SAO] Main menu content built. Save this scene as 'MainMenu' and put it first in Build Settings.");
        }

        private static void BuildMenuUi()
        {
            var canvasGo = new GameObject("MainMenuCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            Undo.RegisterCreatedObjectUndo(canvasGo, "Menu UI");
            ConfigureCanvas(canvasGo);

            var ctrl = canvasGo.AddComponent<MainMenuController>();
            ctrl.gameSceneName = "FirstHaven";

            // ---- title (original placeholder logo — swap for real art later)
            var title = MakeText(canvasGo.transform, "S K Y B O U N D   R E A L M", 110, new Color(0.97f, 0.95f, 0.90f));
            var trt = (RectTransform)title.transform;
            trt.anchorMin = trt.anchorMax = new Vector2(0.5f, 1f);
            trt.pivot = new Vector2(0.5f, 1f);
            trt.anchoredPosition = new Vector2(0f, -110f);
            trt.sizeDelta = new Vector2(1400f, 140f);
            var shadow = title.gameObject.AddComponent<Shadow>();
            shadow.effectColor = new Color(0.12f, 0.07f, 0.20f, 0.85f);
            shadow.effectDistance = new Vector2(4f, -4f);

            var subtitle = MakeText(canvasGo.transform, "— Floor 1 · First Haven —", 30,
                                    new Color(0.95f, 0.82f, 0.62f));
            var srt = (RectTransform)subtitle.transform;
            srt.anchorMin = srt.anchorMax = new Vector2(0.5f, 1f);
            srt.pivot = new Vector2(0.5f, 1f);
            srt.anchoredPosition = new Vector2(0f, -252f);
            srt.sizeDelta = new Vector2(1200f, 44f);

            // ---- button column, lower left ----------------------------------
            ctrl.startButton   = MakeButton(canvasGo.transform, "Start Game", new Vector2(140f, 470f));
            ctrl.loadButton    = MakeButton(canvasGo.transform, "Load Game",  new Vector2(140f, 390f));
            ctrl.optionsButton = MakeButton(canvasGo.transform, "Options",    new Vector2(140f, 310f));
            ctrl.quitButton    = MakeButton(canvasGo.transform, "Quit",       new Vector2(140f, 230f));

            // ---- options panel (placeholder) --------------------------------
            var panel = new GameObject("OptionsPanel", typeof(RectTransform), typeof(Image));
            panel.transform.SetParent(canvasGo.transform, false);
            var prt = (RectTransform)panel.transform;
            prt.anchorMin = prt.anchorMax = new Vector2(0.5f, 0.5f);
            prt.pivot = new Vector2(0.5f, 0.5f);
            prt.anchoredPosition = Vector2.zero;
            prt.sizeDelta = new Vector2(640f, 420f);
            panel.GetComponent<Image>().color = new Color(0.05f, 0.06f, 0.11f, 0.92f);

            var heading = MakeText(panel.transform, "OPTIONS", 44, new Color(0.96f, 0.94f, 0.88f));
            var hrt = (RectTransform)heading.transform;
            hrt.anchorMin = hrt.anchorMax = new Vector2(0.5f, 1f);
            hrt.pivot = new Vector2(0.5f, 1f);
            hrt.anchoredPosition = new Vector2(0f, -28f);
            hrt.sizeDelta = new Vector2(500f, 60f);

            var body = MakeText(panel.transform,
                                "Audio, video and mouse-sensitivity settings\nwill live here in a later milestone.",
                                24, new Color(0.78f, 0.78f, 0.85f));
            var brt = (RectTransform)body.transform;
            brt.anchorMin = brt.anchorMax = new Vector2(0.5f, 0.5f);
            brt.pivot = new Vector2(0.5f, 0.5f);
            brt.anchoredPosition = new Vector2(0f, 20f);
            brt.sizeDelta = new Vector2(560f, 120f);

            ctrl.optionsBackButton = MakeButton(panel.transform, "Back", new Vector2(155f, 60f));
            ctrl.optionsPanel = panel;
            panel.SetActive(false);

            EnsureEventSystem();
            EditorUtility.SetDirty(ctrl);
        }

        // ================================================================== //
        //  Shared helpers
        // ================================================================== //

        private static void ConfigureCanvas(GameObject canvasGo)
        {
            canvasGo.GetComponent<Canvas>().renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.matchWidthOrHeight = 0.5f;
        }

        private static Text MakeText(Transform parent, string content, int size, Color color)
        {
            var go = new GameObject("Text", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var txt = go.AddComponent<Text>();
            txt.text = content;
            // Arial.ttf was removed as a builtin in 2022.2+; this is the one that ships.
            txt.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            txt.fontSize = size;
            txt.alignment = TextAnchor.MiddleCenter;
            txt.color = color;
            txt.horizontalOverflow = HorizontalWrapMode.Overflow;
            txt.verticalOverflow = VerticalWrapMode.Overflow;
            return txt;
        }

        private static Button MakeButton(Transform parent, string label, Vector2 anchoredPos)
        {
            var go = new GameObject("Button_" + label.Replace(" ", ""),
                                    typeof(RectTransform), typeof(Image), typeof(Button));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.zero;
            rt.pivot = new Vector2(0f, 0.5f);
            rt.anchoredPosition = anchoredPos;
            rt.sizeDelta = new Vector2(330f, 64f);

            var img = go.GetComponent<Image>();
            img.color = new Color(0.06f, 0.07f, 0.13f, 0.82f);

            var btn = go.GetComponent<Button>();
            btn.targetGraphic = img;
            var colors = btn.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(0.55f, 0.48f, 0.85f, 1f);
            colors.pressedColor = new Color(0.85f, 0.68f, 0.38f, 1f);
            colors.fadeDuration = 0.08f;
            btn.colors = colors;

            var txt = MakeText(go.transform, label.ToUpperInvariant(), 30, new Color(0.96f, 0.94f, 0.88f));
            var trt = (RectTransform)txt.transform;
            trt.anchorMin = Vector2.zero;
            trt.anchorMax = Vector2.one;
            trt.offsetMin = Vector2.zero;
            trt.offsetMax = Vector2.zero;
            return btn;
        }

        private static void EnsureEventSystem()
        {
            if (Object.FindObjectOfType<EventSystem>() != null) return;
            var es = new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            Undo.RegisterCreatedObjectUndo(es, "EventSystem");
        }

        /// <summary>
        /// Deactivates cameras that would fight the one a builder is about to
        /// create. With <paramref name="skipMenuCameras"/> true (the player
        /// builder), anything that is recognizably a menu/UI camera — by name
        /// or by carrying a MenuOrbitCamera — is left untouched, so running
        /// "Build FPS Player Rig" in the menu scene by accident never
        /// dismantles that scene. The menu builder passes false because it
        /// must replace its own previous MenuCamera on a re-run.
        /// </summary>
        private static void DisableExtraCameras(bool skipMenuCameras)
        {
            foreach (var cam in Object.FindObjectsOfType<Camera>())
            {
                bool isMenuCam = cam.name == "MenuCamera"
                              || cam.name == "MainMenuCamera"
                              || cam.name == "UICamera"
                              || cam.GetComponent<MenuOrbitCamera>() != null;
                if (skipMenuCameras && isMenuCam)
                {
                    Debug.LogWarning($"[SAO] Skipped menu/UI camera '{cam.name}' (left active). " +
                                     "If this is the main menu scene, you probably didn't mean to build the player here — " +
                                     "undo, or delete Player/PlayerHUD. Until then two cameras + two AudioListeners coexist.");
                    continue;
                }
                cam.gameObject.SetActive(false);
                Debug.Log($"[SAO] Disabled pre-existing camera '{cam.name}' (it would fight the new one).");
            }
        }

        /// <summary>Creates an empty organizational child under a root.</summary>
        private static Transform Group(Transform root, string name)
        {
            var g = new GameObject(name);
            g.transform.SetParent(root, false);
            return g.transform;
        }

        /// <summary>
        /// Keeps exactly one key light: disables any active directional light
        /// that is not under the given root (e.g. the default scene's
        /// "Directional Light", or the menu scene's dusk sun).
        /// </summary>
        private static void DisableExtraDirectionalLights(Transform keepUnder)
        {
            foreach (var l in Object.FindObjectsOfType<Light>())
            {
                if (l.type != LightType.Directional) continue;
                if (keepUnder != null && l.transform.IsChildOf(keepUnder)) continue;
                l.gameObject.SetActive(false);
                Debug.Log($"[SAO] Disabled extra directional light '{l.name}' so the inn keeps a single key light.");
            }
        }

        private static GameObject Prim(PrimitiveType type, string name, Vector3 localPos,
                                       Vector3 scale, string matName, Transform parent)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = scale;
            var mat = FindMat(matName);
            if (mat != null) go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return go;
        }

        private static GameObject Box(string n, Vector3 p, Vector3 s, string m, Transform t)
            => Prim(PrimitiveType.Cube, n, p, s, m, t);
        private static GameObject Cyl(string n, Vector3 p, Vector3 s, string m, Transform t)
            => Prim(PrimitiveType.Cylinder, n, p, s, m, t);
        private static GameObject Ball(string n, Vector3 p, Vector3 s, string m, Transform t)
            => Prim(PrimitiveType.Sphere, n, p, s, m, t);
        private static GameObject Caps(string n, Vector3 p, Vector3 s, string m, Transform t)
            => Prim(PrimitiveType.Capsule, n, p, s, m, t);

        private static Light PointLight(Transform parent, string name, Vector3 localPos,
                                        Color color, float intensity, float range)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            var l = go.AddComponent<Light>();
            l.type = LightType.Point;
            l.color = color;
            l.intensity = intensity;
            l.range = range;
            l.shadows = LightShadows.None;
            return l;
        }

        /// <summary>
        /// Looks up a generated material in Assets/SAO_Generated/Materials,
        /// creating the whole set on demand if it doesn't exist yet.
        /// </summary>
        private static Material FindMat(string name)
        {
            string path = MatFolder + "/" + name + ".mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (m == null)
            {
                CreateMaterials();
                m = AssetDatabase.LoadAssetAtPath<Material>(path);
            }
            if (m == null) Debug.LogError("[SAO] Missing material: " + name);
            return m;
        }

        /// <summary>True when every shader the active pipeline needs exists:
        /// the sky shader plus whatever PickToonShader resolves to — SAO/Toon
        /// on Built-in, SAO/ToonURP or the URP Lit fallback on URP. A null
        /// from the picker (e.g. broken URP install) fails the check, so the
        /// builders abort cleanly instead of spawning material errors.</summary>
        private static bool ShadersOk()
        {
            if (Shader.Find("SAO/SkyGradient") == null) return false;
            return PickToonShader() != null;
        }

        /// <summary>
        /// Toon shader for the active render pipeline: SAO/Toon on Built-in,
        /// SAO/ToonURP on URP. If the URP port is missing or failed to compile
        /// (ShaderHasError), falls back to flat-color URP Lit so the greybox
        /// renders with correct colors instead of magenta.
        /// </summary>
        private static Shader PickToonShader()
        {
            if (GraphicsSettings.currentRenderPipeline == null)
                return Shader.Find("SAO/Toon");

            var urpToon = Shader.Find("SAO/ToonURP");
            if (urpToon != null && !ShaderUtil.ShaderHasError(urpToon))
                return urpToon;
            return Shader.Find("Universal Render Pipeline/Lit");
        }

        private static Material ToonMat(string name, Color baseCol, Color shadowTint, float outlineWidth)
            => ToonMat(name, baseCol, shadowTint, outlineWidth, Color.black, 96f, Color.black);

        private static Material ToonMat(string name, Color baseCol, Color shadowTint, float outlineWidth,
                                        Color specTint, float gloss, Color emission)
        {
            string path = MatFolder + "/" + name + ".mat";
            Shader shader = PickToonShader();
            if (shader == null)
            {
                Debug.LogError("[SAO] No usable toon shader for material '" + name + "'.");
                return null;
            }

            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            bool isNew = m == null;
            if (isNew) m = new Material(shader);
            // Existing assets keep whatever shader they were created with —
            // re-running the builder after a pipeline switch retargets them
            // (this is what un-magentas materials generated under another RP).
            else if (m.shader != shader) m.shader = shader;

            if (shader.name.StartsWith("SAO/Toon"))
            {
                m.SetColor("_Color", baseCol);
                m.SetColor("_ShadowTint", shadowTint);
                m.SetFloat("_Bands", 2f);
                m.SetFloat("_OutlineWidth", outlineWidth);
                m.SetFloat("_OutlineOn", outlineWidth > 0f ? 1f : 0f);
                if (outlineWidth > 0f) m.EnableKeyword("OUTLINE_ON");
                else m.DisableKeyword("OUTLINE_ON");
                m.SetColor("_SpecularTint", specTint);
                m.SetFloat("_Glossiness", gloss);
                m.SetColor("_EmissionColor", emission);
            }
            else
            {
                // URP Lit fallback: flat colors + emission, no bands/outline.
                m.SetColor("_BaseColor", baseCol);
                m.SetFloat("_Metallic", 0f);
                m.SetFloat("_Smoothness", 0.15f);
                if (emission.maxColorComponent > 0.001f)
                {
                    m.EnableKeyword("_EMISSION");
                    m.SetColor("_EmissionColor", emission);
                }
                else
                {
                    m.DisableKeyword("_EMISSION");
                    m.SetColor("_EmissionColor", Color.black);
                }
            }

            if (isNew) AssetDatabase.CreateAsset(m, path);
            else EditorUtility.SetDirty(m);
            return m;
        }

        private static Material SkyMat(string name, Color top, Color horizon, Color bottom)
        {
            string path = MatFolder + "/" + name + ".mat";
            var shader = Shader.Find("SAO/SkyGradient");   // unlit: works in both pipelines
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            bool isNew = m == null;
            if (isNew) m = new Material(shader);
            else if (m.shader != shader) m.shader = shader;

            m.SetColor("_TopColor", top);
            m.SetColor("_HorizonColor", horizon);
            m.SetColor("_BottomColor", bottom);

            if (isNew) AssetDatabase.CreateAsset(m, path);
            else EditorUtility.SetDirty(m);
            return m;
        }

        private static void EnsureFolder(string parent, string child)
        {
            if (!AssetDatabase.IsValidFolder(parent + "/" + child))
                AssetDatabase.CreateFolder(parent, child);
        }

        private static void MarkDirty()
        {
            if (!Application.isPlaying)
                EditorSceneManager.MarkSceneDirty(SceneManager.GetActiveScene());
        }
    }
}
