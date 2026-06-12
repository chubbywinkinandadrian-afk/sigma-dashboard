// Re:Impact Unity — stage chain: beacon, encounter waves, rewards, joins.
using System.Collections.Generic;
using UnityEngine;

namespace ReImpact
{
    public class QuestManager : MonoBehaviour
    {
        public static QuestManager Instance;

        StageDef _next;
        int _wave = -1;
        readonly List<EnemyAI> _spawned = new List<EnemyAI>();
        GameObject _beacon;

        void Awake()
        {
            Instance = this;
            EnemyAI.OnAnyDeath += HandleDeath;
        }

        void OnDestroy()
        {
            EnemyAI.OnAnyDeath -= HandleDeath;
            if (Instance == this) Instance = null;
        }

        void Start()
        {
            Advance();
            if (_next != null)
                GameHUD.Toast("Objective: " + _next.Name + " — follow the golden beacon");
        }

        void Advance()
        {
            _next = null;
            foreach (var s in GameData.Stages)
            {
                if (s.Spot == Vector3.zero) continue;     // not placed in this district
                if (SaveSystem.IsCleared(s.Id)) continue;
                _next = s;
                break;
            }
            UpdateBeacon();
        }

        void UpdateBeacon()
        {
            if (_beacon == null)
            {
                _beacon = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                Destroy(_beacon.GetComponent<Collider>());
                _beacon.name = "QuestBeacon";
                Shader sh = Shader.Find("Legacy Shaders/Transparent/Diffuse");
                if (sh == null) sh = Shader.Find("Diffuse");
                var m = new Material(sh);
                m.color = new Color(1f, 0.85f, 0.45f, 0.3f);
                _beacon.GetComponent<Renderer>().material = m;
                _beacon.transform.localScale = new Vector3(2.4f, 30f, 2.4f);
            }
            if (_next != null)
            {
                _beacon.SetActive(true);
                _beacon.transform.position = _next.Spot + Vector3.up * 30f;
            }
            else
            {
                _beacon.SetActive(false);
            }
        }

        void Update()
        {
            if (_next == null || _wave >= 0 || PlayerCombat.Instance == null) return;
            Vector3 p = PlayerCombat.Instance.transform.position;
            Vector3 spot = _next.Spot;
            if ((new Vector2(p.x - spot.x, p.z - spot.z)).sqrMagnitude < 12f * 12f)
            {
                GameHUD.Toast("⚔ " + _next.Name + "!");
                _wave = 0;
                SpawnWave();
            }
        }

        void SpawnWave()
        {
            _spawned.Clear();
            string[] wave = _next.Waves[_wave];
            for (int i = 0; i < wave.Length; i++)
            {
                float ang = (i / (float)wave.Length) * Mathf.PI * 2f + 0.6f;
                Vector3 pos = _next.Spot + new Vector3(Mathf.Cos(ang), 0f, Mathf.Sin(ang)) * 8f;
                var e = EnemyAI.Create(wave[i], _next.Mult, pos);
                if (e != null)
                {
                    e.EncounterStage = _next.Id;
                    _spawned.Add(e);
                }
            }
            if (_wave > 0) GameHUD.Toast("Wave " + (_wave + 1) + "!");
        }

        void HandleDeath(EnemyAI dead)
        {
            if (_wave < 0 || _next == null) return;
            if (dead.EncounterStage != _next.Id) return;
            foreach (var e in _spawned)
                if (e != null && !e.IsDead) return;

            _wave++;
            if (_wave < _next.Waves.Length)
            {
                Invoke("SpawnWave", 1.2f);
                return;
            }
            CompleteStage();
        }

        void CompleteStage()
        {
            var stage = _next;
            _wave = -1;
            SaveSystem.MarkCleared(stage.Id);
            SaveSystem.Data.Crystals += stage.Crystals;
            SaveSystem.AddPartyXp(stage.Xp);
            GameHUD.Toast("Stage clear! +" + stage.Crystals + " crystals, +" + stage.Xp + " XP");
            if (!string.IsNullOrEmpty(stage.JoinCharacter))
            {
                bool isNew = SaveSystem.Grant(stage.JoinCharacter);
                if (isNew && SaveSystem.Data.Party.Count < 4)
                    SaveSystem.Data.Party.Add(stage.JoinCharacter);
                var c = GameData.Character(stage.JoinCharacter);
                GameHUD.Toast((c != null ? c.Name : stage.JoinCharacter) + " joins your party!");
                if (PlayerCombat.Instance != null) PlayerCombat.Instance.RefreshParty();
            }
            SaveSystem.Save();
            Advance();
            if (_next != null) GameHUD.Toast("New objective: " + _next.Name);
            else GameHUD.Toast("District clear! More chapters arrive with the next district.");
        }

        /// Called on Return by Death — despawn the active encounter so it restarts fresh.
        public void ResetEncounter()
        {
            if (_wave < 0) return;
            foreach (var e in _spawned)
                if (e != null && !e.IsDead) Destroy(e.gameObject);
            _spawned.Clear();
            _wave = -1;
        }
    }

    /// Placed by the scene builder: spawns a roaming mob camp at play start.
    public class CampSpawner : MonoBehaviour
    {
        public string EnemyId = "thug";
        public int Count = 3;
        public float Mult = 1f;

        void Start()
        {
            for (int i = 0; i < Count; i++)
            {
                float ang = Random.value * Mathf.PI * 2f;
                Vector3 pos = transform.position + new Vector3(Mathf.Cos(ang), 0f, Mathf.Sin(ang)) * Random.Range(2f, 6f);
                var e = EnemyAI.Create(EnemyId, Mult, pos);
                if (e != null) e.CampMob = true;
            }
        }
    }
}
