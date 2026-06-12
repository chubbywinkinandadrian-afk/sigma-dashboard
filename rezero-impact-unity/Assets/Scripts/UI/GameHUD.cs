// Re:Impact Unity — code-built HUD: quest tracker, crystals, party bars, stamina,
// toasts, NPC barks, summon button. No prefabs or scene wiring needed.
using UnityEngine;
using UnityEngine.UI;

namespace ReImpact
{
    public class GameHUD : MonoBehaviour
    {
        public static GameHUD Instance;

        Text _questText, _crystalsText, _toastText, _barkText;
        Image _staminaFill;
        readonly Text[] _partyNames = new Text[4];
        readonly Image[] _partyHp = new Image[4];
        readonly Image[] _partyEn = new Image[4];
        readonly Image[] _partyBg = new Image[4];
        float _toastUntil, _barkUntil;
        Font _font;

        void Awake()
        {
            Instance = this;
            _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            BuildUI();
        }

        public static void Toast(string msg)
        {
            if (Instance == null) return;
            Instance._toastText.text = msg;
            Instance._toastUntil = Time.time + 3f;
        }

        public static void ShowBark(string msg)
        {
            if (Instance == null) return;
            Instance._barkText.text = "“" + msg + "”";
            Instance._barkUntil = Time.time + 4.5f;
        }

        // ------------------------------------------------------ build
        RectTransform Rect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return go.GetComponent<RectTransform>();
        }

        Text MakeText(string name, Transform parent, int size, TextAnchor anchor, Color color)
        {
            var rt = Rect(name, parent);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = _font;
            t.fontSize = size;
            t.alignment = anchor;
            t.color = color;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            return t;
        }

        Image MakeImage(string name, Transform parent, Color color)
        {
            var rt = Rect(name, parent);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = color;
            return img;
        }

        static void Anchor(RectTransform rt, Vector2 min, Vector2 max, Vector2 offMin, Vector2 offMax)
        {
            rt.anchorMin = min; rt.anchorMax = max;
            rt.offsetMin = offMin; rt.offsetMax = offMax;
        }

        void BuildUI()
        {
            var canvasGo = new GameObject("HUDCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1600, 900);

            // quest tracker (top-left)
            var questBg = MakeImage("QuestBg", canvasGo.transform, new Color(0.07f, 0.09f, 0.14f, 0.8f));
            Anchor(questBg.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(16, -96), new Vector2(360, -16));
            _questText = MakeText("QuestText", questBg.transform, 18, TextAnchor.MiddleLeft, new Color(1f, 0.85f, 0.48f));
            Anchor(_questText.rectTransform, Vector2.zero, Vector2.one, new Vector2(12, 6), new Vector2(-8, -6));

            // crystals + summon (top-right)
            var topRight = MakeImage("CrystalsBg", canvasGo.transform, new Color(0.07f, 0.09f, 0.14f, 0.8f));
            Anchor(topRight.rectTransform, new Vector2(1, 1), new Vector2(1, 1), new Vector2(-260, -56), new Vector2(-16, -16));
            _crystalsText = MakeText("Crystals", topRight.transform, 20, TextAnchor.MiddleCenter, Color.white);
            Anchor(_crystalsText.rectTransform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);

            var summonBtnImg = MakeImage("SummonBtn", canvasGo.transform, new Color(0.83f, 0.66f, 0.33f, 0.95f));
            Anchor(summonBtnImg.rectTransform, new Vector2(1, 1), new Vector2(1, 1), new Vector2(-260, -100), new Vector2(-16, -62));
            var summonLabel = MakeText("SummonLabel", summonBtnImg.transform, 18, TextAnchor.MiddleCenter, new Color(0.16f, 0.12f, 0.03f));
            summonLabel.text = "✦ Summon";
            Anchor(summonLabel.rectTransform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var btn = summonBtnImg.gameObject.AddComponent<Button>();
            btn.onClick.AddListener(delegate { if (SummonPanel.Instance != null) SummonPanel.Instance.Toggle(); });

            // party bars (bottom-left)
            for (int i = 0; i < 4; i++)
            {
                var row = MakeImage("Party" + i, canvasGo.transform, new Color(0.07f, 0.09f, 0.14f, 0.8f));
                Anchor(row.rectTransform, new Vector2(0, 0), new Vector2(0, 0),
                    new Vector2(16, 16 + (3 - i) * 46), new Vector2(236, 56 + (3 - i) * 46));
                _partyBg[i] = row;
                _partyNames[i] = MakeText("Name", row.transform, 14, TextAnchor.UpperLeft, Color.white);
                Anchor(_partyNames[i].rectTransform, Vector2.zero, Vector2.one, new Vector2(8, 18), new Vector2(-6, -2));
                var hpBg = MakeImage("HpBg", row.transform, new Color(0.06f, 0.08f, 0.12f, 1f));
                Anchor(hpBg.rectTransform, new Vector2(0, 0), new Vector2(1, 0), new Vector2(8, 10), new Vector2(-8, 17));
                _partyHp[i] = MakeImage("HpFill", hpBg.transform, new Color(0.49f, 0.83f, 0.49f));
                Anchor(_partyHp[i].rectTransform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
                var enBg = MakeImage("EnBg", row.transform, new Color(0.06f, 0.08f, 0.12f, 1f));
                Anchor(enBg.rectTransform, new Vector2(0, 0), new Vector2(1, 0), new Vector2(8, 4), new Vector2(-8, 8));
                _partyEn[i] = MakeImage("EnFill", enBg.transform, new Color(1f, 0.85f, 0.48f));
                Anchor(_partyEn[i].rectTransform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            }

            // stamina (bottom-center)
            var stBg = MakeImage("StaminaBg", canvasGo.transform, new Color(0.06f, 0.08f, 0.12f, 0.8f));
            Anchor(stBg.rectTransform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(-130, 60), new Vector2(130, 70));
            _staminaFill = MakeImage("StaminaFill", stBg.transform, new Color(0.68f, 0.88f, 0.49f));
            Anchor(_staminaFill.rectTransform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);

            // toast + bark
            _toastText = MakeText("Toast", canvasGo.transform, 22, TextAnchor.MiddleCenter, new Color(1f, 0.9f, 0.6f));
            Anchor(_toastText.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(-400, -160), new Vector2(400, -110));
            _barkText = MakeText("Bark", canvasGo.transform, 18, TextAnchor.MiddleCenter, new Color(0.95f, 0.92f, 0.85f));
            Anchor(_barkText.rectTransform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(-380, 86), new Vector2(380, 126));

            var hint = MakeText("Hints", canvasGo.transform, 13, TextAnchor.MiddleCenter, new Color(1f, 1f, 1f, 0.45f));
            hint.text = "WASD move · LMB combo · RMB heavy · Space jump · Shift sprint · Ctrl/K dodge · E skill · Q burst · Tab lock · 1-4 switch";
            Anchor(hint.rectTransform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(-460, 2), new Vector2(460, 22));
        }

        // ------------------------------------------------------ refresh
        void Update()
        {
            var pc = PlayerCombat.Instance;
            if (pc == null) return;

            _crystalsText.text = "◆ " + SaveSystem.Data.Crystals.ToString("N0") + " crystals";

            var tpc = pc.GetComponent<ThirdPersonController>();
            if (tpc != null)
            {
                float frac = tpc.Stamina / tpc.MaxStamina;
                _staminaFill.rectTransform.anchorMax = new Vector2(Mathf.Clamp01(frac), 1f);
                _staminaFill.transform.parent.gameObject.SetActive(frac < 0.995f);
            }

            for (int i = 0; i < 4; i++)
            {
                bool has = i < pc.Party.Count;
                _partyBg[i].gameObject.SetActive(has);
                if (!has) continue;
                string id = pc.Party[i];
                var def = GameData.Character(id);
                bool active = id == pc.ActiveId;
                _partyNames[i].text = (i + 1) + "  " + (def != null ? def.Name : id);
                _partyNames[i].color = active ? new Color(1f, 0.85f, 0.48f) : Color.white;
                _partyBg[i].color = active ? new Color(0.12f, 0.14f, 0.2f, 0.92f) : new Color(0.07f, 0.09f, 0.14f, 0.8f);
                float hpFrac = Mathf.Clamp01(pc.GetHp(id) / Mathf.Max(1f, pc.GetMaxHp(id)));
                _partyHp[i].rectTransform.anchorMax = new Vector2(hpFrac, 1f);
                _partyEn[i].rectTransform.anchorMax = new Vector2(Mathf.Clamp01(pc.GetEnergy(id) / 100f), 1f);
            }

            _questText.text = BuildQuestLine();
            _toastText.gameObject.SetActive(Time.time < _toastUntil);
            _barkText.gameObject.SetActive(Time.time < _barkUntil);
        }

        string BuildQuestLine()
        {
            foreach (var s in GameData.Stages)
            {
                if (s.Spot == Vector3.zero || SaveSystem.IsCleared(s.Id)) continue;
                var pc = PlayerCombat.Instance;
                int dist = pc != null
                    ? Mathf.RoundToInt(Vector3.Distance(pc.transform.position, s.Spot)) : 0;
                return "Ch." + s.Chapter + "  " + s.Name + "\n" + dist + "m — follow the beacon";
            }
            return "District clear!\nSummon, fight camps, explore.";
        }
    }
}
