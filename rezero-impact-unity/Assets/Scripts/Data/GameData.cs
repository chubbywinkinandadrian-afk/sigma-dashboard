// Re:Impact Unity — static game data (characters, enemies, stages, banners).
// Port of the web prototype's data.js / wdata.js, simplified for the slice.
using System.Collections.Generic;
using UnityEngine;

namespace ReImpact
{
    public enum Element { Fire, Water, Wind, Earth, Yin, Yang }
    public enum WeaponKind { Sword, Knife, Flail, Claw, Fist, Fan, Staff, Lute }
    public enum SkillKind { Damage, AOE, Heal, BuffAtk, Shield }
    public enum MoveType { Melee, Combo, Slam, Charge, Volley, Zones }

    [System.Serializable]
    public class SkillDef
    {
        public string Name;
        public SkillKind Kind;
        public float Mult;
        public float Cooldown; // seconds (burst uses energy instead)
        public SkillDef(string name, SkillKind kind, float mult, float cd)
        { Name = name; Kind = kind; Mult = mult; Cooldown = cd; }
    }

    [System.Serializable]
    public class CharacterDef
    {
        public string Id, Name, Title;
        public int Rarity;
        public Element Element;
        public WeaponKind Weapon;
        public bool Ranged;
        public bool Limited;
        public int Hp, Atk, Def, Spd, Crit;
        public string BodyColor, HairColor, EyeColor;
        public SkillDef Skill, Burst;
    }

    [System.Serializable]
    public class EnemyMove
    {
        public MoveType Type;
        public float Cd = 1.7f;
        public int Count = 1;     // combo hits / volley bolts / zone count
        public float Mult = 0.95f;
        public float Radius = 0f; // slam/zone radius (0 = default)
        public EnemyMove(MoveType t, float cd = 1.7f, int count = 1, float mult = 0.95f, float radius = 0f)
        { Type = t; Cd = cd; Count = count; Mult = mult; Radius = radius; }
    }

    [System.Serializable]
    public class EnemyDef
    {
        public string Id, Name;
        public int Hp, Atk, Def, Spd;
        public bool Boss;
        public float Size = 1f;
        public string Color = "#777777";
        public Element? Element;
        public EnemyMove[] Moves;
    }

    [System.Serializable]
    public class StageDef
    {
        public string Id, Name;
        public int Chapter;
        public float Mult;
        public string[][] Waves;
        public int Crystals, Xp;
        public string JoinCharacter; // granted on first clear (or null)
        public Vector3 Spot;         // world position; Vector3.zero = not placed in this district
    }

    [System.Serializable]
    public class BannerDef
    {
        public string Id, Name;
        public bool Limited;
        public string Featured5;
        public string[] Featured4;
    }

    [System.Serializable]
    public class LightStep
    {
        public float Mult, Range, ArcDot, Rate, Lunge;
        public LightStep(float mult, float range, float arcDot, float rate, float lunge)
        { Mult = mult; Range = range; ArcDot = arcDot; Rate = rate; Lunge = lunge; }
    }

    [System.Serializable]
    public class WeaponMoveset
    {
        public LightStep[] Combo;
        public LightStep Heavy;
        public int CasterBolts; // >0 → light attacks fire bolts instead of melee
    }

    public static class GameData
    {
        // ---------------------------------------------------------- gacha tuning
        public const int CostSingle = 160;
        public const float Rate5 = 0.006f, Rate4 = 0.051f;
        public const int SoftPityStart = 74, HardPity5 = 90, Pity4 = 10;
        public const float SoftPityStep = 0.06f, Featured5Chance = 0.5f;
        public const int MaxResonance = 6, DupCrystals = 160;
        public const int StartCrystals = 3200;

        public static float LevelMult(int level) { return 1f + 0.045f * (level - 1); }
        public static int XpForLevel(int level) { return Mathf.FloorToInt(60f * Mathf.Pow(level, 1.5f)); }
        public static int LevelFromXp(int xp)
        {
            int lvl = 1, acc = 0;
            while (lvl < 80)
            {
                int need = XpForLevel(lvl);
                if (xp < acc + need) break;
                acc += need; lvl++;
            }
            return lvl;
        }

        static SkillDef S(string n, SkillKind k, float m, float cd) { return new SkillDef(n, k, m, cd); }

        static CharacterDef C(string id, string name, string title, int rarity, Element el, WeaponKind w,
            bool ranged, bool limited, int hp, int atk, int def, int spd, int crit,
            string body, string hair, string eyes, SkillDef skill, SkillDef burst)
        {
            return new CharacterDef
            {
                Id = id, Name = name, Title = title, Rarity = rarity, Element = el, Weapon = w,
                Ranged = ranged, Limited = limited, Hp = hp, Atk = atk, Def = def, Spd = spd, Crit = crit,
                BodyColor = body, HairColor = hair, EyeColor = eyes, Skill = skill, Burst = burst,
            };
        }

        // ---------------------------------------------------------- characters
        public static readonly CharacterDef[] Characters = new CharacterDef[]
        {
            C("subaru", "Natsuki Subaru", "The Boy from Another World", 4, Element.Yin, WeaponKind.Sword,
              false, false, 820, 68, 42, 95, 8, "#26262c", "#2a2426", "#7a5638",
              S("Shamak", SkillKind.AOE, 1.0f, 6.6f), S("Tactician's Call", SkillKind.BuffAtk, 0.3f, 0)),
            C("emilia", "Emilia", "The Frozen Bond", 5, Element.Water, WeaponKind.Staff,
              true, false, 1060, 104, 68, 100, 10, "#ece9f6", "#e3e0ee", "#9b7bd8",
              S("El Huma", SkillKind.Damage, 1.8f, 6.6f), S("Frozen Kingdom", SkillKind.AOE, 2.0f, 0)),
            C("rem", "Rem", "Demon of the Mansion", 5, Element.Water, WeaponKind.Flail,
              false, false, 1020, 112, 64, 105, 12, "#2e3344", "#6fa8dc", "#5b8fd4",
              S("Morning Star", SkillKind.Damage, 1.9f, 6.6f), S("Oni Blood", SkillKind.Damage, 2.4f, 0)),
            C("ram", "Ram", "Pride of the Oni", 5, Element.Wind, WeaponKind.Staff,
              true, false, 940, 108, 58, 108, 12, "#2e3344", "#e8a8c0", "#d86880",
              S("El Fura", SkillKind.AOE, 1.3f, 6.6f), S("Wind Scythes", SkillKind.AOE, 2.2f, 0)),
            C("puck", "Puck", "Great Spirit", 5, Element.Water, WeaponKind.Staff,
              true, false, 900, 110, 55, 102, 12, "#cfd8e8", "#cfd8e8", "#3a3640",
              S("Icicle Volley", SkillKind.Damage, 1.6f, 6.6f), S("Beast of the End", SkillKind.AOE, 2.4f, 0)),
            C("beatrice", "Beatrice", "Keeper of the Forbidden Library", 5, Element.Yin, WeaponKind.Staff,
              true, false, 960, 96, 70, 92, 8, "#d8536a", "#e8c878", "#5a8ad8",
              S("El Minya", SkillKind.Damage, 1.6f, 6.6f), S("Door Crossing", SkillKind.Shield, 2.0f, 0)),
            C("roswaal", "Roswaal L. Mathers", "Margrave of the Border", 5, Element.Fire, WeaponKind.Staff,
              true, false, 950, 115, 60, 99, 10, "#2a2a48", "#3d3db8", "#e8c840",
              S("Al Goa", SkillKind.Damage, 2.0f, 6.6f), S("Sixfold Chant", SkillKind.AOE, 2.3f, 0)),
            C("wilhelm", "Wilhelm van Astrea", "The Sword Demon", 5, Element.Wind, WeaponKind.Sword,
              false, false, 980, 118, 62, 112, 15, "#26262a", "#c8ccd4", "#7a9ac8",
              S("Sword Demon's Dance", SkillKind.Damage, 2.2f, 6.6f), S("Dance of Steel", SkillKind.Damage, 3.2f, 0)),
            C("crusch", "Crusch Karsten", "Duchess of the Hundred Blades", 5, Element.Wind, WeaponKind.Sword,
              false, false, 1000, 106, 66, 107, 10, "#3c5444", "#4a6a50", "#d8a850",
              S("Invisible Blade", SkillKind.Damage, 1.9f, 6.6f), S("One Hundred Blades", SkillKind.AOE, 2.1f, 0)),
            C("julius", "Julius Juukulius", "The Finest of Knights", 5, Element.Yang, WeaponKind.Sword,
              false, false, 990, 107, 68, 106, 12, "#3c3050", "#9a86d0", "#d8c860",
              S("Spirit Arts", SkillKind.AOE, 1.4f, 6.6f), S("Six Hues", SkillKind.AOE, 2.2f, 0)),
            C("priscilla", "Priscilla Barielle", "The Bloodstained Bride", 5, Element.Yang, WeaponKind.Fan,
              false, false, 970, 113, 60, 101, 12, "#b03848", "#e8b060", "#d05858",
              S("Yang Sword", SkillKind.Damage, 1.9f, 6.6f), S("The World Bends", SkillKind.Damage, 2.4f, 0)),
            C("ferris", "Ferris", "Blue of the Royal Guard", 5, Element.Water, WeaponKind.Staff,
              true, false, 920, 88, 62, 96, 6, "#4a6ad0", "#b08858", "#d8c850",
              S("Healing Waters", SkillKind.Heal, 1.6f, 4.4f), S("Blessing of Water", SkillKind.Heal, 1.8f, 0)),
            C("reinhard", "Reinhard van Astrea", "The Sword Saint", 5, Element.Yang, WeaponKind.Sword,
              false, true, 1350, 142, 85, 125, 18, "#e8e8f0", "#d04848", "#5a9ad8",
              S("Divine Protection", SkillKind.Damage, 2.4f, 4.4f), S("Sword Saint", SkillKind.AOE, 3.0f, 0)),
            C("echidna", "Echidna", "Witch of Greed", 5, Element.Yin, WeaponKind.Staff,
              true, true, 1000, 110, 64, 97, 10, "#26242c", "#f0f0f4", "#2a2a30",
              S("Greed's Inquiry", SkillKind.Damage, 1.7f, 6.6f), S("Tea Party of the Dead", SkillKind.AOE, 2.0f, 0)),
            C("petelgeuse", "Petelgeuse Romanee-Conti", "Sin Archbishop of Sloth", 5, Element.Yin, WeaponKind.Fist,
              true, true, 1010, 116, 58, 103, 12, "#2c3030", "#3a5848", "#88b890",
              S("Unseen Hand", SkillKind.AOE, 1.5f, 6.6f), S("Diligence!!", SkillKind.AOE, 2.3f, 0)),
            C("felt", "Felt", "Wind of the Slums", 4, Element.Wind, WeaponKind.Knife,
              false, false, 760, 82, 44, 115, 14, "#3a3434", "#e8d060", "#d05858",
              S("Swift Steal", SkillKind.Damage, 1.5f, 6.6f), S("Slum Rat Royale", SkillKind.AOE, 1.7f, 0)),
            C("otto", "Otto Suwen", "The Unluckiest Merchant", 4, Element.Earth, WeaponKind.Staff,
              true, false, 780, 74, 50, 98, 8, "#586048", "#a8a890", "#7a9ac8",
              S("Soul Greeting", SkillKind.Damage, 1.2f, 6.6f), S("Caravan Rush", SkillKind.AOE, 1.6f, 0)),
            C("rom", "Old Man Rom", "Giant of the Loot House", 4, Element.Earth, WeaponKind.Fist,
              false, false, 950, 80, 62, 85, 6, "#5a4a3c", "#c8c4bc", "#3a3630",
              S("Club Smash", SkillKind.Damage, 1.7f, 6.6f), S("Giant's Rage", SkillKind.Damage, 2.4f, 0)),
            C("petra", "Petra Leyte", "Apprentice of the Mansion", 4, Element.Yang, WeaponKind.Staff,
              true, false, 720, 70, 46, 97, 6, "#a05858", "#c87850", "#8a5a40",
              S("Handkerchief Charm", SkillKind.Heal, 1.3f, 4.4f), S("Village Heart", SkillKind.Heal, 1.4f, 0)),
            C("frederica", "Frederica Baumann", "Fanged Maid", 4, Element.Earth, WeaponKind.Claw,
              false, false, 840, 84, 54, 100, 10, "#2e3344", "#d8c878", "#5ab878",
              S("Beast Claws", SkillKind.Damage, 1.6f, 6.6f), S("Garden Guardian", SkillKind.Shield, 1.5f, 0)),
            C("garfiel", "Garfiel Tinzel", "Shield of the Sanctuary", 4, Element.Earth, WeaponKind.Claw,
              false, false, 1000, 86, 70, 94, 10, "#4a6848", "#e8d060", "#5ab878",
              S("Sanctuary Shield", SkillKind.Shield, 2.0f, 6.6f), S("Fangs of Earth", SkillKind.Damage, 2.5f, 0)),
            C("ricardo", "Ricardo Welkin", "Captain of the Fang", 4, Element.Fire, WeaponKind.Sword,
              false, false, 880, 88, 52, 103, 12, "#684830", "#a87848", "#d8a840",
              S("Mercenary Cleave", SkillKind.AOE, 1.2f, 6.6f), S("Iron Fang", SkillKind.Damage, 2.3f, 0)),
            C("mimi", "Mimi Pearlbaton", "The Loudest", 4, Element.Yang, WeaponKind.Staff,
              true, false, 740, 86, 44, 105, 10, "#d88848", "#e8a058", "#5a9ad8",
              S("Mimi Shout", SkillKind.AOE, 1.3f, 6.6f), S("Maximum Shout", SkillKind.AOE, 1.9f, 0)),
            C("anastasia", "Anastasia Hoshin", "Merchant Princess", 4, Element.Yin, WeaponKind.Staff,
              true, false, 760, 72, 48, 99, 8, "#d8d8e8", "#c0aede", "#5ab8a8",
              S("Shrewd Bargain", SkillKind.Damage, 1.1f, 6.6f), S("Hoshin's Cunning", SkillKind.BuffAtk, 0.2f, 0)),
            C("al", "Al", "Helmeted Swordsman", 4, Element.Yin, WeaponKind.Sword,
              false, false, 820, 80, 50, 96, 10, "#383838", "#383838", "#000000",
              S("Helmeted Gamble", SkillKind.Damage, 1.5f, 6.6f), S("Lucky Break", SkillKind.Damage, 2.0f, 0)),
            C("meili", "Meili Portroute", "Mabeast Whisperer", 4, Element.Wind, WeaponKind.Staff,
              true, false, 740, 78, 46, 101, 8, "#486078", "#88a8d0", "#b05858",
              S("Mabeast Whistle", SkillKind.Damage, 1.7f, 6.6f), S("Stampede", SkillKind.AOE, 1.8f, 0)),
            C("elsa", "Elsa Granhiert", "The Bowel Hunter", 4, Element.Yin, WeaponKind.Knife,
              false, false, 860, 92, 48, 110, 16, "#221e28", "#1e1c24", "#9048a0",
              S("Carving Pleasure", SkillKind.Damage, 1.6f, 6.6f), S("Bowel Hunter", SkillKind.Damage, 2.6f, 0)),
            C("liliana", "Liliana Masquerade", "Songstress of Priestella", 4, Element.Yang, WeaponKind.Lute,
              true, false, 700, 68, 42, 98, 6, "#a87858", "#6a4838", "#d8a850",
              S("Ballad of Heroes", SkillKind.BuffAtk, 0.2f, 6.6f), S("Encore!", SkillKind.Heal, 1.2f, 0)),
            C("kadomon", "Kadomon Risch", "Appa Vendor, Scary Face", 4, Element.Fire, WeaponKind.Fist,
              false, false, 800, 76, 52, 90, 8, "#804838", "#b05838", "#3a3630",
              S("Appa Toss", SkillKind.Damage, 1.4f, 4.4f), S("Family Business", SkillKind.Damage, 1.8f, 0)),
        };

        // ---------------------------------------------------------- enemies
        static EnemyDef E(string id, string name, int hp, int atk, int def, int spd,
            bool boss, float size, string color, EnemyMove[] moves)
        {
            return new EnemyDef { Id = id, Name = name, Hp = hp, Atk = atk, Def = def, Spd = spd,
                Boss = boss, Size = size, Color = color, Moves = moves };
        }
        static EnemyMove M(MoveType t, float cd = 1.7f, int count = 1, float mult = 0.95f, float r = 0f)
        { return new EnemyMove(t, cd, count, mult, r); }

        public static readonly EnemyDef[] Enemies = new EnemyDef[]
        {
            E("thug", "Capital Thug", 55, 11, 8, 85, false, 1f, "#7a5a48",
              new[] { M(MoveType.Melee) }),
            E("tough", "Street Tough", 80, 14, 10, 88, false, 1f, "#6a6a52",
              new[] { M(MoveType.Melee) }),
            E("assassin", "Hired Knife", 110, 20, 10, 108, false, 1f, "#3a3548",
              new[] { M(MoveType.Combo, 3f, 2), M(MoveType.Melee) }),
            E("pup", "Mabeast Pup", 70, 13, 8, 95, false, 0.8f, "#5a4a3a",
              new[] { M(MoveType.Melee) }),
            E("ulgarm", "Ulgarm", 130, 19, 12, 100, false, 1.1f, "#3a3a44",
              new[] { M(MoveType.Charge, 6f, 1, 1.3f), M(MoveType.Melee) }),
            E("cultist", "Witch Cultist", 150, 22, 12, 95, false, 1f, "#3c3050",
              new[] { M(MoveType.Volley, 2.4f, 1, 0.8f), M(MoveType.Melee) }),
            E("fanatic", "Cult Fanatic", 280, 31, 16, 99, false, 1f, "#503060",
              new[] { M(MoveType.Volley, 4f, 3, 0.8f), M(MoveType.Melee) }),
            E("elsa_boss", "Elsa, the Bowel Hunter", 620, 26, 14, 110, true, 1.4f, "#282030",
              new[] { M(MoveType.Combo, 6f, 3, 1.0f), M(MoveType.Melee) }),
            E("giant_ulgarm", "Alpha Ulgarm", 850, 30, 16, 102, true, 2f, "#23232c",
              new[] { M(MoveType.Charge, 7f, 1, 1.3f), M(MoveType.Slam, 9f, 1, 1.4f, 7f), M(MoveType.Melee) }),
        };

        // ---------------------------------------------------------- stages (Chapter 1 placed in this district)
        public static readonly StageDef[] Stages = new StageDef[]
        {
            new StageDef { Id = "c1s1", Name = "Alleyway Welcome", Chapter = 1, Mult = 1.0f,
                Waves = new[] { new[] { "thug", "thug", "thug" } },
                Crystals = 80, Xp = 160, Spot = new Vector3(38, 0, -30) },
            new StageDef { Id = "c1s2", Name = "Chasing the Thief", Chapter = 1, Mult = 1.0f,
                Waves = new[] { new[] { "tough", "thug", "tough" } },
                Crystals = 80, Xp = 160, JoinCharacter = "felt", Spot = new Vector3(64, 0, -54) },
            new StageDef { Id = "c1s3", Name = "The Loot House", Chapter = 1, Mult = 1.0f,
                Waves = new[] { new[] { "assassin", "assassin" } },
                Crystals = 80, Xp = 160, Spot = new Vector3(86, 0, -72) },
            new StageDef { Id = "c1s4", Name = "The Bowel Hunter", Chapter = 1, Mult = 1.0f,
                Waves = new[] { new[] { "elsa_boss" } },
                Crystals = 160, Xp = 400, JoinCharacter = "emilia", Spot = new Vector3(98, 0, -92) },
            // Chapter 2 preview camp ends the slice (full chapters arrive with the next district)
            new StageDef { Id = "c2s1", Name = "Pups in the Woods", Chapter = 2, Mult = 1.5f,
                Waves = new[] { new[] { "pup", "pup", "pup", "pup" } },
                Crystals = 80, Xp = 200, Spot = Vector3.zero },
        };

        // ---------------------------------------------------------- banners
        public static readonly BannerDef[] Banners = new BannerDef[]
        {
            new BannerDef { Id = "sword-saint", Name = "Oath of the Sword Saint", Limited = true,
                Featured5 = "reinhard", Featured4 = new[] { "felt", "otto", "petra" } },
            new BannerDef { Id = "greed", Name = "Tea Party of Greed", Limited = true,
                Featured5 = "echidna", Featured4 = new[] { "anastasia", "al", "meili" } },
            new BannerDef { Id = "sloth", Name = "Trembling Devotion", Limited = true,
                Featured5 = "petelgeuse", Featured4 = new[] { "elsa", "garfiel", "mimi" } },
            new BannerDef { Id = "fate", Name = "Crossroads of Fate", Limited = false },
        };

        // ---------------------------------------------------------- weapon movesets
        static LightStep L(float mult, float range, float arc, float rate, float lunge)
        { return new LightStep(mult, range, arc, rate, lunge); }

        public static readonly Dictionary<WeaponKind, WeaponMoveset> Movesets =
            new Dictionary<WeaponKind, WeaponMoveset>
        {
            { WeaponKind.Sword, new WeaponMoveset {
                Combo = new[] { L(0.85f, 2.9f, 0.2f, 0.5f, 1.1f), L(0.9f, 2.9f, 0.2f, 0.5f, 1.1f),
                                L(1.05f, 3.6f, 0.55f, 0.55f, 2.2f), L(1.4f, 3.0f, 0.25f, 0.75f, 0.8f) },
                Heavy = L(2.2f, 3.5f, -1f, 1.1f, 0.5f) } },
            { WeaponKind.Knife, new WeaponMoveset {
                Combo = new[] { L(0.55f, 2.5f, 0.15f, 0.32f, 0.8f), L(0.55f, 2.5f, 0.15f, 0.32f, 0.8f),
                                L(0.62f, 2.8f, 0.5f, 0.34f, 1.4f), L(1.1f, 2.8f, -1f, 0.55f, 0f) },
                Heavy = L(1.8f, 3.2f, 0.4f, 0.9f, 3.6f) } },
            { WeaponKind.Flail, new WeaponMoveset {
                Combo = new[] { L(1.1f, 3.3f, 0.0f, 0.72f, 0.8f), L(1.15f, 3.3f, 0.0f, 0.72f, 0.8f),
                                L(1.6f, 3.2f, 0.25f, 0.95f, 0f) },
                Heavy = L(2.7f, 3.8f, -1f, 1.3f, 0f) } },
            { WeaponKind.Claw, new WeaponMoveset {
                Combo = new[] { L(0.6f, 2.6f, 0.15f, 0.36f, 1.0f), L(0.6f, 2.6f, 0.15f, 0.36f, 1.0f),
                                L(0.66f, 2.6f, 0.15f, 0.36f, 1.0f), L(1.25f, 3.0f, -1f, 0.6f, 0f) },
                Heavy = L(1.9f, 3.0f, 0.25f, 0.95f, 2.2f) } },
            { WeaponKind.Fist, new WeaponMoveset {
                Combo = new[] { L(0.8f, 2.5f, 0.35f, 0.42f, 1.2f), L(0.85f, 2.5f, 0.3f, 0.42f, 1.2f),
                                L(1.3f, 2.6f, 0.35f, 0.65f, 0f) },
                Heavy = L(2.1f, 2.8f, 0.3f, 1.0f, 1.6f) } },
            { WeaponKind.Fan, new WeaponMoveset {
                Combo = new[] { L(0.78f, 3.0f, 0.0f, 0.5f, 0.9f), L(0.82f, 3.0f, 0.0f, 0.5f, 0.9f),
                                L(1.3f, 3.3f, -1f, 0.7f, 0f) },
                Heavy = L(2.0f, 3.6f, -1f, 1.0f, 0f) } },
            { WeaponKind.Staff, new WeaponMoveset {
                Combo = new[] { L(0.8f, 0f, 0f, 0.5f, 0f), L(0.8f, 0f, 0f, 0.5f, 0f), L(0.62f, 0f, 0f, 0.7f, 0f) },
                Heavy = L(2.0f, 0f, 0f, 1.15f, 0f), CasterBolts = 1 } },
            { WeaponKind.Lute, new WeaponMoveset {
                Combo = new[] { L(0.8f, 0f, 0f, 0.5f, 0f), L(0.8f, 0f, 0f, 0.5f, 0f), L(0.62f, 0f, 0f, 0.7f, 0f) },
                Heavy = L(2.0f, 0f, 0f, 1.15f, 0f), CasterBolts = 1 } },
        };

        // ---------------------------------------------------------- lookups
        static Dictionary<string, CharacterDef> _charById;
        static Dictionary<string, EnemyDef> _enemyById;

        public static CharacterDef Character(string id)
        {
            if (_charById == null)
            {
                _charById = new Dictionary<string, CharacterDef>();
                foreach (var c in Characters) _charById[c.Id] = c;
            }
            CharacterDef def;
            return _charById.TryGetValue(id, out def) ? def : null;
        }

        public static EnemyDef Enemy(string id)
        {
            if (_enemyById == null)
            {
                _enemyById = new Dictionary<string, EnemyDef>();
                foreach (var e in Enemies) _enemyById[e.Id] = e;
            }
            EnemyDef def;
            return _enemyById.TryGetValue(id, out def) ? def : null;
        }

        public static List<string> StandardFiveStars()
        {
            var list = new List<string>();
            foreach (var c in Characters) if (c.Rarity == 5 && !c.Limited) list.Add(c.Id);
            return list;
        }

        public static List<string> FourStarPool()
        {
            var list = new List<string>();
            foreach (var c in Characters) if (c.Rarity == 4 && c.Id != "subaru") list.Add(c.Id);
            return list;
        }

        public static Color ParseColor(string hex, Color fallback)
        {
            Color c;
            return ColorUtility.TryParseHtmlString(hex, out c) ? c : fallback;
        }
    }
}
