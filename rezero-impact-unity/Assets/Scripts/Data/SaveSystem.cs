// Re:Impact Unity — JSON save (PlayerPrefs). JsonUtility-friendly: no dictionaries.
using System.Collections.Generic;
using UnityEngine;

namespace ReImpact
{
    [System.Serializable]
    public class OwnedCharacter
    {
        public string Id;
        public int Xp;
        public int Resonance;
    }

    [System.Serializable]
    public class SaveData
    {
        public int Crystals = GameData.StartCrystals;
        public List<OwnedCharacter> Roster = new List<OwnedCharacter>();
        public List<string> Party = new List<string>();
        public List<string> ClearedStages = new List<string>();
        public int PityStandard5, PityStandard4, PityLimited5, PityLimited4;
        public bool GuaranteeFeatured;
        public int Pulls, FiveStars;
        public bool WinterOutfits = true;
    }

    public static class SaveSystem
    {
        const string Key = "reimpact-save-v1";
        static SaveData _data;

        public static SaveData Data
        {
            get { if (_data == null) Load(); return _data; }
        }

        public static void Load()
        {
            string raw = PlayerPrefs.GetString(Key, "");
            if (!string.IsNullOrEmpty(raw))
            {
                try { _data = JsonUtility.FromJson<SaveData>(raw); }
                catch { _data = null; }
            }
            if (_data == null || _data.Roster == null) _data = NewGame();
        }

        public static void Save()
        {
            if (_data == null) return;
            PlayerPrefs.SetString(Key, JsonUtility.ToJson(_data));
            PlayerPrefs.Save();
        }

        public static SaveData NewGame()
        {
            _data = new SaveData();
            _data.Roster.Add(new OwnedCharacter { Id = "subaru" });
            _data.Party.Add("subaru");
            Save();
            return _data;
        }

        public static void ResetAll()
        {
            PlayerPrefs.DeleteKey(Key);
            _data = NewGame();
        }

        // ------------------------------------------------------ roster helpers
        public static OwnedCharacter Owned(string id)
        {
            foreach (var o in Data.Roster) if (o.Id == id) return o;
            return null;
        }

        /// Grants a character; returns true if NEW (false = converted to resonance/refund).
        public static bool Grant(string id)
        {
            var own = Owned(id);
            if (own == null)
            {
                Data.Roster.Add(new OwnedCharacter { Id = id });
                return true;
            }
            if (own.Resonance < GameData.MaxResonance) own.Resonance++;
            else Data.Crystals += GameData.DupCrystals;
            return false;
        }

        public static bool IsCleared(string stageId) { return Data.ClearedStages.Contains(stageId); }
        public static void MarkCleared(string stageId)
        {
            if (!Data.ClearedStages.Contains(stageId)) Data.ClearedStages.Add(stageId);
        }

        public static void AddPartyXp(int amount)
        {
            foreach (var id in Data.Party)
            {
                var own = Owned(id);
                if (own != null) own.Xp += amount;
            }
        }

        // Effective combat stats for an owned character at its current level.
        public static void Stats(string id, out int hp, out int atk, out int def)
        {
            var c = GameData.Character(id);
            var own = Owned(id);
            int xp = own != null ? own.Xp : 0;
            int res = own != null ? own.Resonance : 0;
            float mult = GameData.LevelMult(GameData.LevelFromXp(xp)) * (1f + 0.04f * res);
            hp = Mathf.RoundToInt(c.Hp * mult * 3f); // real-time HP buffer, same as web build
            atk = Mathf.RoundToInt(c.Atk * mult);
            def = Mathf.RoundToInt(c.Def * GameData.LevelMult(GameData.LevelFromXp(xp)));
        }
    }
}
