// Re:Impact Unity — summoning with soft/hard pity and 50/50 guarantee.
using System.Collections.Generic;
using UnityEngine;

namespace ReImpact
{
    public class GachaResult
    {
        public string CharacterId; // null → 3★ filler (converted to crystals in this port)
        public int Rarity;
        public bool IsNew;
    }

    public static class GachaSystem
    {
        public static bool CanAfford(int count)
        {
            return SaveSystem.Data.Crystals >= GameData.CostSingle * count;
        }

        public static List<GachaResult> Summon(BannerDef banner, int count)
        {
            var d = SaveSystem.Data;
            int cost = GameData.CostSingle * count;
            if (d.Crystals < cost) return null;
            d.Crystals -= cost;

            var results = new List<GachaResult>();
            for (int i = 0; i < count; i++) results.Add(RollOne(banner));
            d.Pulls += count;
            SaveSystem.Save();
            return results;
        }

        static GachaResult RollOne(BannerDef banner)
        {
            var d = SaveSystem.Data;
            bool limited = banner.Limited;
            int pity5 = limited ? ++d.PityLimited5 : ++d.PityStandard5;
            int pity4 = limited ? ++d.PityLimited4 : ++d.PityStandard4;

            float p5 = GameData.Rate5;
            if (pity5 >= GameData.SoftPityStart)
                p5 += (pity5 - GameData.SoftPityStart + 1) * GameData.SoftPityStep;
            if (pity5 >= GameData.HardPity5) p5 = 1f;

            if (Random.value < p5)
            {
                if (limited) d.PityLimited5 = 0; else d.PityStandard5 = 0;
                d.FiveStars++;
                string id = PickFive(banner);
                return Result(id, 5);
            }

            float p4 = GameData.Rate4;
            if (pity4 >= GameData.Pity4) p4 = 1f;
            if (Random.value < p4)
            {
                if (limited) d.PityLimited4 = 0; else d.PityStandard4 = 0;
                return Result(PickFour(banner), 4);
            }

            // 3★ filler: small crystal shard refund keeps pulls feeling rewarding
            d.Crystals += 15;
            return new GachaResult { CharacterId = null, Rarity = 3, IsNew = false };
        }

        static string PickFive(BannerDef banner)
        {
            var d = SaveSystem.Data;
            var standard = GameData.StandardFiveStars();
            if (banner.Limited)
            {
                bool win = d.GuaranteeFeatured || Random.value < GameData.Featured5Chance;
                if (win) { d.GuaranteeFeatured = false; return banner.Featured5; }
                d.GuaranteeFeatured = true;
                return standard[Random.Range(0, standard.Count)];
            }
            return standard[Random.Range(0, standard.Count)];
        }

        static string PickFour(BannerDef banner)
        {
            if (banner.Limited && banner.Featured4 != null && Random.value < 0.5f)
                return banner.Featured4[Random.Range(0, banner.Featured4.Length)];
            var pool = GameData.FourStarPool();
            return pool[Random.Range(0, pool.Count)];
        }

        static GachaResult Result(string id, int rarity)
        {
            bool isNew = SaveSystem.Grant(id);
            return new GachaResult { CharacterId = id, Rarity = rarity, IsNew = isNew };
        }
    }
}
