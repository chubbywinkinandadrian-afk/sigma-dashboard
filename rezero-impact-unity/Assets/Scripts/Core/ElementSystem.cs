// Re:Impact Unity — elemental auras & reactions (port of the web table).
using UnityEngine;

namespace ReImpact
{
    public struct ReactionResult
    {
        public string Name;
        public float Mult;
        public float StunChance;
    }

    public static class ElementSystem
    {
        /// Applies an elemental hit to a target aura. Returns reaction multiplier info,
        /// and updates the aura by ref (null aura is encoded as -1).
        public static ReactionResult ApplyHit(ref int aura, Element hitElement)
        {
            int hit = (int)hitElement;
            if (aura < 0) { aura = hit; return None(); }
            if (aura == hit) return None();

            Element a = (Element)aura;
            aura = -1;
            return React(a, hitElement);
        }

        static ReactionResult None() { return new ReactionResult { Name = null, Mult = 1f, StunChance = 0f }; }
        static ReactionResult R(string name, float mult, float stun = 0f)
        { return new ReactionResult { Name = name, Mult = mult, StunChance = stun }; }

        static ReactionResult React(Element a, Element b)
        {
            // order-independent pair check
            bool Pair(Element x, Element y) { return (a == x && b == y) || (a == y && b == x); }

            if (Pair(Element.Fire, Element.Water)) return R("Steam Burst", 1.75f);
            if (Pair(Element.Fire, Element.Wind)) return R("Firestorm", 1.4f);
            if (Pair(Element.Fire, Element.Earth)) return R("Magma", 1.2f);
            if (Pair(Element.Water, Element.Wind)) return R("Tempest", 1.25f);
            if (Pair(Element.Water, Element.Earth)) return R("Quagmire", 1.2f);
            if (Pair(Element.Wind, Element.Earth)) return R("Sandstorm", 1.2f, 0.25f);
            if (Pair(Element.Yin, Element.Yang)) return R("Eclipse", 2.0f);
            if (a == Element.Yin || b == Element.Yin) return R("Curse", 1.1f);
            if (a == Element.Yang || b == Element.Yang) return R("Purge", 1.6f);
            return None();
        }

        public static Color ElementColor(Element e)
        {
            switch (e)
            {
                case Element.Fire: return new Color(0.89f, 0.36f, 0.29f);
                case Element.Water: return new Color(0.36f, 0.71f, 0.91f);
                case Element.Wind: return new Color(0.24f, 0.81f, 0.6f);
                case Element.Earth: return new Color(0.79f, 0.57f, 0.24f);
                case Element.Yin: return new Color(0.61f, 0.42f, 0.83f);
                default: return new Color(0.94f, 0.76f, 0.24f);
            }
        }
    }
}
