// Re:Impact Unity — editor scene builders (idempotent greybox, no asset files needed).
#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.EventSystems;

namespace ReImpact.EditorTools
{
    public static class ReZeroSceneBuilder
    {
        const string DistrictRoot = "ReImpact_District";
        const string PlayerRoot = "ReImpact_Player";

        // ------------------------------------------------------ helpers
        static Material Toon(Color c)
        {
            Shader sh = Shader.Find("ReImpact/Toon");
            if (sh == null) sh = Shader.Find("Diffuse");
            var m = new Material(sh);
            m.color = c;
            return m;
        }

        static GameObject Prim(PrimitiveType t, Transform parent, string name,
            Vector3 pos, Vector3 scale, Color color, bool keepCollider)
        {
            var go = GameObject.CreatePrimitive(t);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            go.GetComponent<Renderer>().sharedMaterial = Toon(color);
            if (!keepCollider)
            {
                var col = go.GetComponent<Collider>();
                if (col != null) Object.DestroyImmediate(col);
            }
            return go;
        }

        static void Teardown(string rootName)
        {
            for (var existing = GameObject.Find(rootName); existing != null; existing = GameObject.Find(rootName))
                Object.DestroyImmediate(existing);
        }

        // ------------------------------------------------------ 1. district
        [MenuItem("Tools/Re:Impact/1. Build Capital District")]
        public static void BuildDistrict()
        {
            Teardown(DistrictRoot);
            var root = new GameObject(DistrictRoot);

            // ground + plaza
            var ground = Prim(PrimitiveType.Plane, root.transform, "Ground",
                Vector3.zero, new Vector3(40f, 1f, 40f), new Color(0.55f, 0.62f, 0.42f), true);
            Prim(PrimitiveType.Cylinder, root.transform, "PlazaDisc",
                new Vector3(0f, 0.03f, 0f), new Vector3(60f, 0.03f, 60f), new Color(0.66f, 0.62f, 0.56f), false);

            // fountain (solid)
            var fountain = new GameObject("Fountain");
            fountain.transform.SetParent(root.transform, false);
            Prim(PrimitiveType.Cylinder, fountain.transform, "Base",
                new Vector3(0f, 0.55f, 0f), new Vector3(14f, 0.55f, 14f), new Color(0.78f, 0.8f, 0.77f), true);
            Prim(PrimitiveType.Cylinder, fountain.transform, "Pool",
                new Vector3(0f, 1.08f, 0f), new Vector3(13f, 0.1f, 13f), new Color(0.5f, 0.78f, 0.91f), false);
            Prim(PrimitiveType.Cylinder, fountain.transform, "Column",
                new Vector3(0f, 2.4f, 0f), new Vector3(2.2f, 1.4f, 2.2f), new Color(0.78f, 0.8f, 0.77f), true);
            Prim(PrimitiveType.Cylinder, fountain.transform, "MidBasin",
                new Vector3(0f, 3.6f, 0f), new Vector3(6.8f, 0.25f, 6.8f), new Color(0.78f, 0.8f, 0.77f), false);
            Prim(PrimitiveType.Cylinder, fountain.transform, "MidWater",
                new Vector3(0f, 3.85f, 0f), new Vector3(6.2f, 0.08f, 6.2f), new Color(0.5f, 0.78f, 0.91f), false);
            Prim(PrimitiveType.Cylinder, fountain.transform, "TopBasin",
                new Vector3(0f, 5.4f, 0f), new Vector3(3.4f, 0.2f, 3.4f), new Color(0.78f, 0.8f, 0.77f), false);

            // ring of timber houses (solid walls)
            Color[] plasters = { new Color(0.91f, 0.86f, 0.75f), new Color(0.85f, 0.78f, 0.66f), new Color(0.78f, 0.72f, 0.62f) };
            Color[] roofs = { new Color(0.66f, 0.29f, 0.2f), new Color(0.72f, 0.35f, 0.23f), new Color(0.54f, 0.29f, 0.23f) };
            for (int i = 0; i < 12; i++)
            {
                float ang = (i / 12f) * Mathf.PI * 2f + 0.2f;
                float radius = 42f + (i % 3) * 7f;
                var house = new GameObject("House_" + i);
                house.transform.SetParent(root.transform, false);
                house.transform.localPosition = new Vector3(Mathf.Cos(ang) * radius, 0f, Mathf.Sin(ang) * radius);
                house.transform.localRotation = Quaternion.Euler(0f, -ang * Mathf.Rad2Deg + 90f, 0f);
                float s = 1f + (i % 3) * 0.25f;
                Prim(PrimitiveType.Cube, house.transform, "Walls",
                    new Vector3(0f, 2.8f * s, 0f), new Vector3(7f * s, 5.6f * s, 6.5f * s), plasters[i % 3], true);
                var roof = Prim(PrimitiveType.Cube, house.transform, "Roof",
                    new Vector3(0f, 6.6f * s, 0f), new Vector3(5.6f * s, 5.6f * s, 7.4f * s), roofs[i % 3], false);
                roof.transform.localRotation = Quaternion.Euler(0f, 0f, 45f);
                // timber beams + door + warm windows
                Prim(PrimitiveType.Cube, house.transform, "Beam",
                    new Vector3(0f, 2.9f * s, 3.28f * s), new Vector3(7.1f * s, 0.25f, 0.1f), new Color(0.29f, 0.21f, 0.15f), false);
                Prim(PrimitiveType.Cube, house.transform, "Door",
                    new Vector3(0f, 1.1f, 3.3f * s), new Vector3(1.3f, 2.2f, 0.1f), new Color(0.35f, 0.23f, 0.15f), false);
                for (int w = -1; w <= 1; w += 2)
                    Prim(PrimitiveType.Cube, house.transform, "Window",
                        new Vector3(w * 1.9f * s, 3.4f * s, 3.3f * s), new Vector3(0.9f, 1.1f, 0.08f), new Color(1f, 0.89f, 0.66f), false);
            }

            // market stalls
            for (int i = 0; i < 5; i++)
            {
                float ang = (i / 5f) * Mathf.PI * 2f + 0.55f;
                var stall = new GameObject("Stall_" + i);
                stall.transform.SetParent(root.transform, false);
                stall.transform.localPosition = new Vector3(Mathf.Cos(ang) * 22f, 0f, Mathf.Sin(ang) * 22f);
                stall.transform.localRotation = Quaternion.Euler(0f, -ang * Mathf.Rad2Deg + 90f, 0f);
                Prim(PrimitiveType.Cube, stall.transform, "Counter",
                    new Vector3(0f, 0.55f, 0f), new Vector3(3.6f, 1.1f, 1.6f), new Color(0.48f, 0.35f, 0.24f), true);
                var awn = Prim(PrimitiveType.Cube, stall.transform, "Awning",
                    new Vector3(0f, 2.6f, 0.3f), new Vector3(4.2f, 0.12f, 2.4f),
                    i % 2 == 0 ? new Color(0.75f, 0.22f, 0.22f) : new Color(0.18f, 0.42f, 0.27f), false);
                awn.transform.localRotation = Quaternion.Euler(-10f, 0f, 0f);
                for (int p = -1; p <= 1; p += 2)
                    Prim(PrimitiveType.Cylinder, stall.transform, "Post",
                        new Vector3(p * 1.8f, 1.3f, 0.6f), new Vector3(0.12f, 1.3f, 0.12f), new Color(0.35f, 0.27f, 0.19f), false);
            }

            // lamp posts with warm light
            for (int i = 0; i < 6; i++)
            {
                float ang = (i / 6f) * Mathf.PI * 2f;
                var lamp = new GameObject("Lamp_" + i);
                lamp.transform.SetParent(root.transform, false);
                lamp.transform.localPosition = new Vector3(Mathf.Cos(ang) * 16f, 0f, Mathf.Sin(ang) * 16f);
                Prim(PrimitiveType.Cylinder, lamp.transform, "Post",
                    new Vector3(0f, 1.7f, 0f), new Vector3(0.15f, 1.7f, 0.15f), new Color(0.2f, 0.19f, 0.17f), false);
                Prim(PrimitiveType.Sphere, lamp.transform, "Head",
                    new Vector3(0f, 3.5f, 0f), Vector3.one * 0.55f, new Color(1f, 0.88f, 0.62f), false);
                var lightGo = new GameObject("Light");
                lightGo.transform.SetParent(lamp.transform, false);
                lightGo.transform.localPosition = new Vector3(0f, 3.5f, 0f);
                var l = lightGo.AddComponent<Light>();
                l.type = LightType.Point;
                l.color = new Color(1f, 0.78f, 0.5f);
                l.range = 9f;
                l.intensity = 1.1f;
            }

            // festival tree (greybox: stacked greens + star + bulbs)
            var tree = new GameObject("FestivalTree");
            tree.transform.SetParent(root.transform, false);
            tree.transform.localPosition = new Vector3(20f, 0f, -14f);
            Prim(PrimitiveType.Cylinder, tree.transform, "Trunk",
                new Vector3(0f, 0.8f, 0f), new Vector3(1.2f, 0.8f, 1.2f), new Color(0.35f, 0.27f, 0.19f), true);
            for (int i = 0; i < 3; i++)
                Prim(PrimitiveType.Sphere, tree.transform, "Canopy" + i,
                    new Vector3(0f, 3f + i * 2.4f, 0f), new Vector3(6.5f - i * 1.7f, 3.4f - i * 0.6f, 6.5f - i * 1.7f),
                    new Color(0.12f, 0.36f + i * 0.04f, 0.21f), false);
            Prim(PrimitiveType.Sphere, tree.transform, "Star",
                new Vector3(0f, 10.4f, 0f), Vector3.one * 0.9f, new Color(1f, 0.88f, 0.5f), false);
            for (int i = 0; i < 14; i++)
            {
                float t = i / 14f;
                float a = t * Mathf.PI * 6f;
                float r = 3f - t * 2.2f;
                Color[] bulbs = { new Color(1f, 0.35f, 0.3f), new Color(1f, 0.82f, 0.3f), new Color(0.35f, 0.72f, 1f) };
                Prim(PrimitiveType.Sphere, tree.transform, "Bulb" + i,
                    new Vector3(Mathf.Cos(a) * r, 1.8f + t * 7.4f, Mathf.Sin(a) * r),
                    Vector3.one * 0.28f, bulbs[i % 3], false);
            }

            // waypoint crystal
            var wp = new GameObject("Waypoint");
            wp.transform.SetParent(root.transform, false);
            wp.transform.localPosition = new Vector3(-14f, 0f, 12f);
            Prim(PrimitiveType.Cube, wp.transform, "Pedestal",
                new Vector3(0f, 0.4f, 0f), new Vector3(2.4f, 0.8f, 2.4f), new Color(0.6f, 0.64f, 0.72f), true);
            var crystal = Prim(PrimitiveType.Cube, wp.transform, "Crystal",
                new Vector3(0f, 2.2f, 0f), new Vector3(0.9f, 1.4f, 0.9f), new Color(0.43f, 0.91f, 0.91f), false);
            crystal.transform.localRotation = Quaternion.Euler(45f, 45f, 0f);

            // stage spots (Chapter 1) with little flags
            foreach (var s in GameData.Stages)
            {
                if (s.Spot == Vector3.zero) continue;
                var spot = new GameObject("StageSpot_" + s.Id);
                spot.transform.SetParent(root.transform, false);
                spot.transform.localPosition = s.Spot;
                Prim(PrimitiveType.Cylinder, spot.transform, "Pole",
                    new Vector3(0f, 1.5f, 0f), new Vector3(0.08f, 1.5f, 0.08f), new Color(0.4f, 0.32f, 0.22f), false);
                Prim(PrimitiveType.Cube, spot.transform, "Flag",
                    new Vector3(0.45f, 2.6f, 0f), new Vector3(0.9f, 0.55f, 0.05f), new Color(1f, 0.78f, 0.36f), false);
            }

            // mob camp
            var camp = new GameObject("CampSpawner_thug");
            camp.transform.SetParent(root.transform, false);
            camp.transform.localPosition = new Vector3(-45f, 0f, 30f);
            var spawner = camp.AddComponent<CampSpawner>();
            spawner.EnemyId = "thug";
            spawner.Count = 3;
            spawner.Mult = 1f;

            // NPC crowd (original ambient lines)
            string[] lines =
            {
                "Appas! Fresh appas! Sweetest in the capital!",
                "Snow before the festival — the spirits are in a good mood.",
                "They say the royal selection has five candidates now. Five!",
                "Wreaths! Winter wreaths! One for luck, two for love!",
                "The knight Reinhard passed by this morning. The whole street fainted.",
                "Hot milk and honey! Warm your hands, warm your heart!",
                "Mind the fountain — it is for wishes, not for swimming.",
                "A boy in a strange tracksuit shouted at a noble today. Bold or stupid?",
            };
            Color[] npcBodies = { new Color(0.63f, 0.52f, 0.35f), new Color(0.48f, 0.54f, 0.6f), new Color(0.54f, 0.42f, 0.48f) };
            for (int i = 0; i < lines.Length; i++)
            {
                float ang = (i / (float)lines.Length) * Mathf.PI * 2f + 0.4f;
                var npc = new GameObject("NPC_" + i);
                npc.transform.SetParent(root.transform, false);
                npc.transform.localPosition = new Vector3(Mathf.Cos(ang) * 12f, 0f, Mathf.Sin(ang) * 12f);
                Prim(PrimitiveType.Capsule, npc.transform, "Body",
                    new Vector3(0f, 1f, 0f), new Vector3(0.75f, 0.75f, 0.75f), npcBodies[i % 3], false);
                Prim(PrimitiveType.Sphere, npc.transform, "Head",
                    new Vector3(0f, 1.95f, 0f), Vector3.one * 0.62f, new Color(0.94f, 0.85f, 0.75f), false);
                var wander = npc.AddComponent<NPCWander>();
                wander.WanderRadius = 7f;
                wander.Line = lines[i];
            }

            // snow
            var snowGo = new GameObject("Snow");
            snowGo.transform.SetParent(root.transform, false);
            snowGo.transform.localPosition = new Vector3(0f, 24f, 0f);
            var ps = snowGo.AddComponent<ParticleSystem>();
            var main = ps.main;
            main.loop = true;
            main.startLifetime = 14f;
            main.startSpeed = 0.4f;
            main.startSize = 0.14f;
            main.maxParticles = 2500;
            main.gravityModifier = 0.06f;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            var emission = ps.emission;
            emission.rateOverTime = 140f;
            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(160f, 1f, 160f);

            // lighting: golden hour
            var sunGo = new GameObject("Sun");
            sunGo.transform.SetParent(root.transform, false);
            sunGo.transform.rotation = Quaternion.Euler(38f, -36f, 0f);
            var sun = sunGo.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.91f, 0.78f);
            sun.intensity = 1.15f;
            sun.shadows = LightShadows.Soft;

            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.62f, 0.72f, 0.92f);
            RenderSettings.ambientEquatorColor = new Color(0.78f, 0.7f, 0.66f);
            RenderSettings.ambientGroundColor = new Color(0.4f, 0.38f, 0.34f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogStartDistance = 70f;
            RenderSettings.fogEndDistance = 320f;
            RenderSettings.fogColor = new Color(0.78f, 0.8f, 0.9f);
            Shader skySh = Shader.Find("Skybox/Procedural");
            if (skySh != null)
            {
                var sky = new Material(skySh);
                sky.SetFloat("_Exposure", 1.25f);
                sky.SetColor("_SkyTint", new Color(0.55f, 0.65f, 0.95f));
                sky.SetColor("_GroundColor", new Color(0.55f, 0.5f, 0.46f));
                RenderSettings.skybox = sky;
                RenderSettings.sun = sun;
            }

            EditorUtility.DisplayDialog("Re:Impact",
                "Capital district built.\nNow run: Tools → Re:Impact → 2. Build Player & Game Systems.", "OK");
        }

        // ------------------------------------------------------ 2. player & systems
        [MenuItem("Tools/Re:Impact/2. Build Player + Game Systems")]
        public static void BuildPlayer()
        {
            Teardown(PlayerRoot);
            var root = new GameObject(PlayerRoot);

            // player
            var player = new GameObject("Player");
            player.transform.SetParent(root.transform, false);
            player.transform.position = new Vector3(8f, 0.2f, 18f);
            var cc = player.AddComponent<CharacterController>();
            cc.height = 1.9f;
            cc.center = new Vector3(0f, 0.95f, 0f);
            cc.radius = 0.45f;
            player.AddComponent<ThirdPersonController>();
            player.AddComponent<PlayerCombat>();

            // visuals registry (assign VRM prefabs here later)
            var visuals = new GameObject("CharacterVisuals");
            visuals.transform.SetParent(root.transform, false);
            visuals.AddComponent<CharacterVisuals>();

            // camera
            var camGo = new GameObject("GameCamera");
            camGo.transform.SetParent(root.transform, false);
            camGo.tag = "MainCamera";
            camGo.AddComponent<Camera>();
            camGo.AddComponent<AudioListener>();
            var orbit = camGo.AddComponent<OrbitCamera>();
            orbit.Target = player.transform;
            camGo.transform.position = player.transform.position + new Vector3(0f, 4f, -8f);

            // systems + UI
            var quest = new GameObject("QuestManager");
            quest.transform.SetParent(root.transform, false);
            quest.AddComponent<QuestManager>();
            var hud = new GameObject("GameHUD");
            hud.transform.SetParent(root.transform, false);
            hud.AddComponent<GameHUD>();
            var summon = new GameObject("SummonPanel");
            summon.transform.SetParent(root.transform, false);
            summon.AddComponent<SummonPanel>();

            if (Object.FindObjectOfType<EventSystem>() == null)
            {
                var ev = new GameObject("EventSystem");
                ev.transform.SetParent(root.transform, false);
                ev.AddComponent<EventSystem>();
                ev.AddComponent<StandaloneInputModule>();
            }

            EditorUtility.DisplayDialog("Re:Impact",
                "Player & systems built. Press Play!\n\nWalk to the golden beacon for Chapter 1.\n" +
                "Assign VRoid prefabs on the CharacterVisuals object to replace placeholder rigs " +
                "(see Docs/VRoidPipeline.md).", "OK");
        }
    }
}
#endif
