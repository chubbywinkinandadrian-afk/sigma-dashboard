// Re:Impact Unity — code-built summon panel (banners, pity, x1/x10, results).
using UnityEngine;
using UnityEngine.UI;

namespace ReImpact
{
    public class SummonPanel : MonoBehaviour
    {
        public static SummonPanel Instance;
        public static bool IsOpen { get { return Instance != null && Instance._root != null && Instance._root.activeSelf; } }

        GameObject _root;
        Text _bannerText, _pityText, _resultsText, _crystalsText;
        int _bannerIdx;
        Font _font;

        void Awake()
        {
            Instance = this;
            _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            BuildUI();
            _root.SetActive(false);
        }

        public void Toggle()
        {
            bool open = !_root.activeSelf;
            _root.SetActive(open);
            if (open)
            {
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
                Refresh("");
            }
        }

        // ------------------------------------------------------ build
        Text MakeText(string name, Transform parent, int size, TextAnchor anchor, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var t = go.AddComponent<Text>();
            t.font = _font; t.fontSize = size; t.alignment = anchor; t.color = color;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            return t;
        }

        Button MakeButton(string label, Transform parent, Vector2 offMin, Vector2 offMax, System.Action onClick)
        {
            var go = new GameObject("Btn_" + label, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var img = go.AddComponent<Image>();
            img.color = new Color(0.83f, 0.66f, 0.33f, 0.95f);
            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = new Vector2(0.5f, 0f); rt.anchorMax = new Vector2(0.5f, 0f);
            rt.offsetMin = offMin; rt.offsetMax = offMax;
            var t = MakeText("Label", go.transform, 18, TextAnchor.MiddleCenter, new Color(0.16f, 0.12f, 0.03f));
            t.text = label;
            var lrt = t.GetComponent<RectTransform>();
            lrt.anchorMin = Vector2.zero; lrt.anchorMax = Vector2.one;
            lrt.offsetMin = Vector2.zero; lrt.offsetMax = Vector2.zero;
            var b = go.AddComponent<Button>();
            b.onClick.AddListener(delegate { onClick(); });
            return b;
        }

        void BuildUI()
        {
            var canvasGo = new GameObject("SummonCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;
            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1600, 900);

            _root = new GameObject("Panel", typeof(RectTransform));
            _root.transform.SetParent(canvasGo.transform, false);
            var dim = _root.AddComponent<Image>();
            dim.color = new Color(0.02f, 0.03f, 0.06f, 0.9f);
            var rootRt = _root.GetComponent<RectTransform>();
            rootRt.anchorMin = Vector2.zero; rootRt.anchorMax = Vector2.one;
            rootRt.offsetMin = Vector2.zero; rootRt.offsetMax = Vector2.zero;

            var title = MakeText("Title", _root.transform, 34, TextAnchor.MiddleCenter, new Color(1f, 0.87f, 0.5f));
            title.text = "✦ Summoning Rites";
            SetAnchors(title, new Vector2(0.5f, 1f), new Vector2(-400, -90), new Vector2(400, -30));

            _crystalsText = MakeText("Crystals", _root.transform, 20, TextAnchor.MiddleCenter, Color.white);
            SetAnchors(_crystalsText, new Vector2(0.5f, 1f), new Vector2(-400, -130), new Vector2(400, -95));

            _bannerText = MakeText("Banner", _root.transform, 24, TextAnchor.MiddleCenter, Color.white);
            SetAnchors(_bannerText, new Vector2(0.5f, 1f), new Vector2(-460, -185), new Vector2(460, -140));

            _pityText = MakeText("Pity", _root.transform, 16, TextAnchor.MiddleCenter, new Color(0.7f, 0.74f, 0.85f));
            SetAnchors(_pityText, new Vector2(0.5f, 1f), new Vector2(-400, -220), new Vector2(400, -188));

            _resultsText = MakeText("Results", _root.transform, 19, TextAnchor.UpperCenter, Color.white);
            SetAnchors(_resultsText, new Vector2(0.5f, 0.5f), new Vector2(-380, -190), new Vector2(380, 200));

            MakeButton("◀ Banner", _root.transform, new Vector2(-380, 70), new Vector2(-230, 110),
                delegate { _bannerIdx = (_bannerIdx + GameData.Banners.Length - 1) % GameData.Banners.Length; Refresh(""); });
            MakeButton("Banner ▶", _root.transform, new Vector2(230, 70), new Vector2(380, 110),
                delegate { _bannerIdx = (_bannerIdx + 1) % GameData.Banners.Length; Refresh(""); });
            MakeButton("Summon ×1  (160)", _root.transform, new Vector2(-200, 70), new Vector2(-10, 110),
                delegate { Pull(1); });
            MakeButton("Summon ×10  (1600)", _root.transform, new Vector2(10, 70), new Vector2(200, 110),
                delegate { Pull(10); });
            MakeButton("Close", _root.transform, new Vector2(-80, 18), new Vector2(80, 58),
                delegate { Toggle(); });
        }

        static void SetAnchors(Text t, Vector2 anchor, Vector2 offMin, Vector2 offMax)
        {
            var rt = t.GetComponent<RectTransform>();
            rt.anchorMin = anchor; rt.anchorMax = anchor;
            rt.offsetMin = offMin; rt.offsetMax = offMax;
        }

        // ------------------------------------------------------ pulls
        void Pull(int count)
        {
            var banner = GameData.Banners[_bannerIdx];
            if (!GachaSystem.CanAfford(count))
            {
                Refresh("Not enough crystals — clear stages and camps!");
                return;
            }
            var results = GachaSystem.Summon(banner, count);
            var sb = new System.Text.StringBuilder();
            foreach (var r in results)
            {
                if (r.CharacterId == null)
                {
                    sb.AppendLine("★★★  crystal shards (+15)");
                    continue;
                }
                var def = GameData.Character(r.CharacterId);
                string stars = r.Rarity == 5 ? "★★★★★" : "★★★★";
                sb.AppendLine(stars + "  " + def.Name + (r.IsNew ? "  — NEW!" : "  (resonance)"));
                // auto-fill empty party slots with new characters
                if (r.IsNew && SaveSystem.Data.Party.Count < 4 && !SaveSystem.Data.Party.Contains(r.CharacterId))
                    SaveSystem.Data.Party.Add(r.CharacterId);
            }
            SaveSystem.Save();
            if (PlayerCombat.Instance != null) PlayerCombat.Instance.RefreshParty();
            Refresh(sb.ToString());
        }

        void Refresh(string results)
        {
            var banner = GameData.Banners[_bannerIdx];
            var d = SaveSystem.Data;
            _crystalsText.text = "◆ " + d.Crystals.ToString("N0") + " crystals";
            string featured = "";
            if (banner.Limited)
            {
                var f = GameData.Character(banner.Featured5);
                featured = "  —  featured: " + (f != null ? f.Name : banner.Featured5);
            }
            _bannerText.text = banner.Name + featured;
            int p5 = banner.Limited ? d.PityLimited5 : d.PityStandard5;
            int p4 = banner.Limited ? d.PityLimited4 : d.PityStandard4;
            _pityText.text = "5★ pity " + p5 + "/90   ·   4★ pity " + p4 + "/10" +
                (banner.Limited && d.GuaranteeFeatured ? "   ·   next 5★ guaranteed featured" : "");
            _resultsText.text = results;
        }
    }
}
