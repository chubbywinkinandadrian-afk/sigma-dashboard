// Re:Impact Unity — character visual registry.
// Assign VRoid/VRM (or any humanoid) prefabs per character id; anything without
// a prefab gets a color-coded placeholder rig so the game always runs.
using System.Collections.Generic;
using UnityEngine;

namespace ReImpact
{
    [System.Serializable]
    public class VisualEntry
    {
        public string CharacterId;
        public GameObject Prefab; // e.g. an imported VRM prefab (see Docs/VRoidPipeline.md)
    }

    public class CharacterVisuals : MonoBehaviour
    {
        public static CharacterVisuals Instance;
        public List<VisualEntry> Entries = new List<VisualEntry>();

        void Awake() { Instance = this; }

        public static GameObject Spawn(string characterId, Transform parent)
        {
            GameObject prefab = null;
            if (Instance != null)
            {
                foreach (var e in Instance.Entries)
                {
                    if (e.CharacterId == characterId && e.Prefab != null) { prefab = e.Prefab; break; }
                }
            }
            GameObject go;
            if (prefab != null)
            {
                go = Instantiate(prefab, parent);
                go.transform.localPosition = Vector3.zero;
                go.transform.localRotation = Quaternion.identity;
            }
            else
            {
                go = BuildFallback(characterId);
                go.transform.SetParent(parent, false);
            }
            go.name = "Visual_" + characterId;
            return go;
        }

        static Material Toon(Color c)
        {
            Shader sh = Shader.Find("ReImpact/Toon");
            if (sh == null) sh = Shader.Find("Diffuse");
            var m = new Material(sh);
            m.color = c;
            return m;
        }

        static GameObject Part(PrimitiveType type, Transform parent, Vector3 pos, Vector3 scale, Color color)
        {
            var p = GameObject.CreatePrimitive(type);
            Destroy(p.GetComponent<Collider>());
            p.transform.SetParent(parent, false);
            p.transform.localPosition = pos;
            p.transform.localScale = scale;
            p.GetComponent<Renderer>().material = Toon(color);
            return p;
        }

        // Placeholder rig: readable color identity until a real model is assigned.
        static GameObject BuildFallback(string id)
        {
            var def = GameData.Character(id);
            Color body = GameData.ParseColor(def != null ? def.BodyColor : "#888888", Color.gray);
            Color hair = GameData.ParseColor(def != null ? def.HairColor : "#aaaaaa", Color.gray);
            Color eyes = GameData.ParseColor(def != null ? def.EyeColor : "#333333", Color.black);
            Color skin = new Color(0.94f, 0.85f, 0.75f);

            var root = new GameObject("FallbackRig");
            Part(PrimitiveType.Capsule, root.transform, new Vector3(0f, 1.0f, 0f), new Vector3(0.8f, 0.78f, 0.8f), body);
            Part(PrimitiveType.Sphere, root.transform, new Vector3(0f, 2.05f, 0f), Vector3.one * 0.78f, skin);
            // hair cap
            Part(PrimitiveType.Sphere, root.transform, new Vector3(0f, 2.22f, -0.05f), new Vector3(0.86f, 0.7f, 0.86f), hair);
            // bangs hint so the face side is obvious
            Part(PrimitiveType.Sphere, root.transform, new Vector3(0f, 2.34f, 0.28f), new Vector3(0.5f, 0.18f, 0.22f), hair);
            // eyes
            Part(PrimitiveType.Sphere, root.transform, new Vector3(-0.14f, 2.05f, 0.33f), Vector3.one * 0.12f, eyes);
            Part(PrimitiveType.Sphere, root.transform, new Vector3(0.14f, 2.05f, 0.33f), Vector3.one * 0.12f, eyes);
            // weapon hint
            if (def != null && !def.Ranged)
            {
                Part(PrimitiveType.Cube, root.transform, new Vector3(0.5f, 1.25f, 0.25f),
                    new Vector3(0.08f, 0.9f, 0.12f), new Color(0.85f, 0.87f, 0.92f));
            }
            else
            {
                Part(PrimitiveType.Sphere, root.transform, new Vector3(0.5f, 1.5f, 0.2f),
                    Vector3.one * 0.2f, hair * 1.1f);
            }
            // festive touch
            if (SaveSystem.Data.WinterOutfits)
            {
                var hat = Part(PrimitiveType.Cylinder, root.transform, new Vector3(0f, 2.62f, -0.02f),
                    new Vector3(0.42f, 0.22f, 0.42f), new Color(0.72f, 0.2f, 0.22f));
                hat.transform.localRotation = Quaternion.Euler(0f, 0f, 12f);
                Part(PrimitiveType.Sphere, root.transform, new Vector3(-0.18f, 2.84f, -0.02f),
                    Vector3.one * 0.14f, Color.white);
            }
            return root;
        }
    }
}
