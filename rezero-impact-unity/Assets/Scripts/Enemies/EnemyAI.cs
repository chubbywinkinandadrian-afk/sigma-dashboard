// Re:Impact Unity — enemy AI: chase, telegraphed melee/combos, charges, volleys,
// ground zones and boss slams. Registry-based (no physics layers required).
using System.Collections.Generic;
using UnityEngine;

namespace ReImpact
{
    public class EnemyAI : MonoBehaviour
    {
        public static readonly List<EnemyAI> All = new List<EnemyAI>();
        public static System.Action<EnemyAI> OnAnyDeath;

        public EnemyDef Def;
        public float Mult = 1f;
        public float Hp, MaxHp, Atk, Defense, Speed, Size = 1f;
        public bool IsDead;
        public bool CampMob;
        public string EncounterStage; // set by QuestManager for stage enemies

        int _aura = -1;
        bool _aggro;
        float _stagger;
        float[] _moveCd;

        // telegraph / charge state
        int _tgMove = -1;
        float _tgTimer, _tgDur;
        int _tgStruck;
        Vector3 _chargeDir;
        float _chargeT = -1f;
        bool _chargeHit;
        GameObject _slamRing;

        Vector3 _home;
        float _deathT = -1f;
        Renderer[] _renderers;
        Color[] _baseColors;

        public static EnemyAI Create(string enemyId, float mult, Vector3 pos)
        {
            var def = GameData.Enemy(enemyId);
            if (def == null) return null;
            var root = new GameObject("Enemy_" + enemyId);
            root.transform.position = pos;
            var ai = root.AddComponent<EnemyAI>();
            ai.Init(def, mult);
            return ai;
        }

        public void Init(EnemyDef def, float mult)
        {
            Def = def; Mult = mult;
            MaxHp = Hp = Mathf.RoundToInt(def.Hp * mult * 1.25f);
            Atk = def.Atk * mult;
            Defense = def.Def * Mathf.Sqrt(mult);
            Speed = Mathf.Clamp(def.Spd * 0.055f, 3.6f, 6.4f);
            Size = def.Size;
            _home = transform.position;
            _moveCd = new float[def.Moves.Length];
            for (int i = 0; i < _moveCd.Length; i++)
                _moveCd[i] = def.Moves[i].Cd * Random.Range(0.4f, 0.9f);
            BuildVisual();
            SnapToGround();
        }

        void BuildVisual()
        {
            Color body = GameData.ParseColor(Def.Color, Color.gray);
            Shader sh = Shader.Find("ReImpact/Toon");
            if (sh == null) sh = Shader.Find("Diffuse");

            GameObject Part(PrimitiveType t, Vector3 pos, Vector3 scale, Color c)
            {
                var p = GameObject.CreatePrimitive(t);
                Destroy(p.GetComponent<Collider>());
                p.transform.SetParent(transform, false);
                p.transform.localPosition = pos;
                p.transform.localScale = scale;
                var m = new Material(sh); m.color = c;
                p.GetComponent<Renderer>().material = m;
                return p;
            }

            Part(PrimitiveType.Capsule, new Vector3(0f, 1.0f, 0f), new Vector3(0.9f, 0.85f, 0.9f), body);
            Part(PrimitiveType.Sphere, new Vector3(0f, 1.95f, 0f), Vector3.one * 0.7f, body * 1.1f);
            Color eye = new Color(0.85f, 0.25f, 0.2f);
            Part(PrimitiveType.Sphere, new Vector3(-0.13f, 2.0f, 0.3f), Vector3.one * 0.1f, eye);
            Part(PrimitiveType.Sphere, new Vector3(0.13f, 2.0f, 0.3f), Vector3.one * 0.1f, eye);
            transform.localScale = Vector3.one * Size;

            _renderers = GetComponentsInChildren<Renderer>();
            _baseColors = new Color[_renderers.Length];
            for (int i = 0; i < _renderers.Length; i++) _baseColors[i] = _renderers[i].material.color;
        }

        void OnEnable() { All.Add(this); }
        void OnDisable() { All.Remove(this); }

        public void TakeElementalHit(float preDefDamage, Element element, Vector3 source)
        {
            if (IsDead) return;
            float dmg = preDefDamage * (100f / (100f + Defense));
            var rx = ElementSystem.ApplyHit(ref _aura, element);
            dmg *= rx.Mult;
            if (rx.StunChance > 0f && Random.value < rx.StunChance) _stagger = Mathf.Max(_stagger, 1.4f);
            dmg = Mathf.Max(1f, dmg);
            Hp -= dmg;
            _aggro = true;
            string text = Mathf.RoundToInt(dmg).ToString() + (rx.Name != null ? " " + rx.Name : "");
            Color c = rx.Name != null ? new Color(1f, 0.85f, 0.45f) : Color.white;
            DamageNumbers.Spawn(transform.position + Vector3.up * (Size * 2.4f), text, c, rx.Name != null ? 1.2f : 1f);
            if (Hp <= 0f) Die();
        }

        void Die()
        {
            IsDead = true;
            Hp = 0f;
            _deathT = 1f;
            ClearSlamRing();
            if (CampMob)
            {
                int crystals = Mathf.Max(1, Mathf.RoundToInt(2f * Mult));
                SaveSystem.Data.Crystals += crystals;
                SaveSystem.AddPartyXp(Mathf.RoundToInt(10f * Mult));
                SaveSystem.Save();
            }
            if (OnAnyDeath != null) OnAnyDeath(this);
        }

        void Update()
        {
            float dt = Time.deltaTime;
            if (IsDead)
            {
                _deathT -= dt;
                transform.localScale = Vector3.one * (Size * Mathf.Max(0.01f, _deathT));
                if (_deathT <= 0f) Destroy(gameObject);
                return;
            }
            if (PlayerCombat.Instance == null) return;

            for (int i = 0; i < _moveCd.Length; i++) _moveCd[i] = Mathf.Max(0f, _moveCd[i] - dt);
            if (_stagger > 0f) { _stagger -= dt; CancelTelegraph(); return; }

            Vector3 playerPos = PlayerCombat.Instance.transform.position;
            Vector3 to = playerPos - transform.position; to.y = 0f;
            float dist = to.magnitude;

            if (!_aggro)
            {
                if (dist < 16f) _aggro = true;
                else return;
            }
            // camp mobs leash home
            if (CampMob && EncounterStage == null)
            {
                if ((transform.position - _home).magnitude > 70f)
                {
                    transform.position = _home;
                    Hp = MaxHp; _aggro = false;
                    SnapToGround();
                    return;
                }
            }

            FaceToward(to, dt);

            // charge in progress
            if (_chargeT >= 0f)
            {
                _chargeT += dt;
                transform.position += _chargeDir * (18f * dt);
                SnapToGround();
                if (!_chargeHit && dist < 1.7f + Size)
                {
                    _chargeHit = true;
                    PlayerCombat.Instance.TakeDamage(Atk * 1.3f, transform.position, true);
                }
                if (_chargeT > 0.6f) _chargeT = -1f;
                return;
            }

            // telegraph in progress
            if (_tgMove >= 0)
            {
                _tgTimer += dt;
                UpdateTelegraphVisual();
                if (_tgTimer >= _tgDur) ResolveTelegraph(dist, to);
                return;
            }

            // pick a move
            float reach = 2.2f + Size * 0.8f;
            for (int i = 0; i < Def.Moves.Length; i++)
            {
                if (_moveCd[i] > 0f) continue;
                var mv = Def.Moves[i];
                bool ok = false;
                float dur = 0.85f;
                switch (mv.Type)
                {
                    case MoveType.Melee: ok = dist < reach + 0.6f; dur = 0.85f; break;
                    case MoveType.Combo: ok = dist < reach + 0.8f; dur = 0.8f; break;
                    case MoveType.Slam: ok = dist < (mv.Radius > 0f ? mv.Radius : 6f) + 1.5f; dur = 1.25f; break;
                    case MoveType.Charge: ok = dist > 5f && dist < 22f; dur = 0.7f; break;
                    case MoveType.Volley: ok = dist > 5f && dist < 30f; dur = 0.5f; break;
                    case MoveType.Zones: ok = dist < 26f; dur = 0.01f; break;
                }
                if (!ok) continue;
                _tgMove = i; _tgTimer = 0f; _tgDur = dur; _tgStruck = 0;
                if (mv.Type == MoveType.Slam) ShowSlamRing(mv.Radius > 0f ? mv.Radius : 6f + Size * 1.4f);
                return;
            }

            // chase / kite
            bool hasMelee = false;
            foreach (var mv in Def.Moves)
                if (mv.Type == MoveType.Melee || mv.Type == MoveType.Combo) hasMelee = true;
            float want = hasMelee ? reach * 0.7f : 14f;
            if (dist > want)
            {
                transform.position += to.normalized * (Speed * dt);
                SnapToGround();
            }
            else if (!hasMelee && dist < 8f)
            {
                transform.position -= to.normalized * (Speed * 0.7f * dt);
                SnapToGround();
            }
        }

        void ResolveTelegraph(float dist, Vector3 to)
        {
            var mv = Def.Moves[_tgMove];
            switch (mv.Type)
            {
                case MoveType.Melee:
                    if (dist < 3.4f + Size)
                        PlayerCombat.Instance.TakeDamage(Atk * mv.Mult, transform.position, true);
                    _moveCd[_tgMove] = mv.Cd;
                    break;
                case MoveType.Combo:
                    if (dist < 3.4f + Size)
                        PlayerCombat.Instance.TakeDamage(Atk * mv.Mult, transform.position, true);
                    _tgStruck++;
                    if (_tgStruck < mv.Count) { _tgTimer = _tgDur - 0.38f; return; }
                    _moveCd[_tgMove] = mv.Cd;
                    break;
                case MoveType.Slam:
                {
                    float r = mv.Radius > 0f ? mv.Radius : 6f + Size * 1.4f;
                    if (dist < r)
                        PlayerCombat.Instance.TakeDamage(Atk * 1.4f, transform.position, true);
                    ClearSlamRing();
                    _moveCd[_tgMove] = mv.Cd;
                    break;
                }
                case MoveType.Charge:
                    _chargeDir = to.normalized;
                    _chargeT = 0f; _chargeHit = false;
                    _moveCd[_tgMove] = mv.Cd;
                    break;
                case MoveType.Volley:
                {
                    Vector3 from = transform.position + Vector3.up * (Size * 1.4f);
                    Vector3 target = PlayerCombat.Instance.transform.position + Vector3.up * 1.2f;
                    for (int b = 0; b < mv.Count; b++)
                    {
                        float spread = (b - (mv.Count - 1) * 0.5f) * 14f;
                        Vector3 dir = Quaternion.Euler(0f, spread, 0f) * (target - from).normalized;
                        var bolt = Projectile.Spawn(from, dir, false, Atk * mv.Mult, Def.Element ?? Element.Yin, 22f, 1f);
                        bolt.HitRadius = 1.3f;
                    }
                    _moveCd[_tgMove] = mv.Cd;
                    break;
                }
                case MoveType.Zones:
                {
                    Vector3 center = PlayerCombat.Instance.transform.position;
                    for (int z = 0; z < mv.Count; z++)
                    {
                        Vector2 off = z == 0 ? Vector2.zero : Random.insideUnitCircle * 4.5f;
                        ZoneStrike.Spawn(center + new Vector3(off.x, 0f, off.y),
                            mv.Radius > 0f ? mv.Radius : 3.2f, Atk * 1.2f);
                    }
                    _moveCd[_tgMove] = mv.Cd;
                    break;
                }
            }
            CancelTelegraph();
        }

        void FaceToward(Vector3 to, float dt)
        {
            if (to.sqrMagnitude < 0.01f) return;
            transform.rotation = Quaternion.Slerp(transform.rotation,
                Quaternion.LookRotation(to.normalized), dt * 8f);
        }

        void SnapToGround()
        {
            RaycastHit hit;
            Vector3 origin = transform.position + Vector3.up * 20f;
            if (Physics.Raycast(origin, Vector3.down, out hit, 60f))
                transform.position = new Vector3(transform.position.x, hit.point.y, transform.position.z);
        }

        void UpdateTelegraphVisual()
        {
            if (_renderers == null) return;
            float k = Mathf.Clamp01(_tgTimer / Mathf.Max(0.01f, _tgDur));
            for (int i = 0; i < _renderers.Length; i++)
            {
                if (_renderers[i] == null) continue;
                _renderers[i].material.color = Color.Lerp(_baseColors[i], new Color(1f, 0.25f, 0.18f), k * 0.7f);
            }
        }

        void CancelTelegraph()
        {
            _tgMove = -1; _tgTimer = 0f;
            if (_renderers != null)
            {
                for (int i = 0; i < _renderers.Length; i++)
                {
                    if (_renderers[i] == null) continue;
                    _renderers[i].material.color = _baseColors[i];
                }
            }
        }

        void ShowSlamRing(float radius)
        {
            ClearSlamRing();
            _slamRing = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Destroy(_slamRing.GetComponent<Collider>());
            _slamRing.name = "SlamTelegraph";
            _slamRing.transform.position = new Vector3(transform.position.x, transform.position.y + 0.08f, transform.position.z);
            _slamRing.transform.localScale = new Vector3(radius * 2f, 0.03f, radius * 2f);
            Shader sh = Shader.Find("Legacy Shaders/Transparent/Diffuse");
            if (sh == null) sh = Shader.Find("Diffuse");
            var m = new Material(sh);
            m.color = new Color(1f, 0.25f, 0.15f, 0.4f);
            _slamRing.GetComponent<Renderer>().material = m;
        }

        void ClearSlamRing()
        {
            if (_slamRing != null) { Destroy(_slamRing); _slamRing = null; }
        }

        void OnDestroy() { ClearSlamRing(); }
    }

    /// Telegraphed ground AoE: red disc, then a strike against the player.
    public class ZoneStrike : MonoBehaviour
    {
        float _t, _dur = 1.15f, _radius, _damage;
        Material _mat;

        public static void Spawn(Vector3 pos, float radius, float damage)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Destroy(go.GetComponent<Collider>());
            go.name = "ZoneStrike";
            RaycastHit hit;
            if (Physics.Raycast(pos + Vector3.up * 20f, Vector3.down, out hit, 60f)) pos.y = hit.point.y;
            go.transform.position = pos + Vector3.up * 0.08f;
            go.transform.localScale = new Vector3(radius * 2f, 0.03f, radius * 2f);
            var z = go.AddComponent<ZoneStrike>();
            z._radius = radius;
            z._damage = damage;
            Shader sh = Shader.Find("Legacy Shaders/Transparent/Diffuse");
            if (sh == null) sh = Shader.Find("Diffuse");
            z._mat = new Material(sh);
            z._mat.color = new Color(1f, 0.3f, 0.15f, 0.25f);
            go.GetComponent<Renderer>().material = z._mat;
        }

        void Update()
        {
            _t += Time.deltaTime;
            if (_mat != null)
            {
                float k = Mathf.Clamp01(_t / _dur);
                _mat.color = new Color(1f, 0.3f - k * 0.1f, 0.15f, 0.25f + k * 0.4f);
            }
            if (_t >= _dur)
            {
                var pc = PlayerCombat.Instance;
                if (pc != null)
                {
                    Vector3 to = pc.transform.position - transform.position; to.y = 0f;
                    if (to.magnitude < _radius) pc.TakeDamage(_damage, transform.position, false);
                }
                Destroy(gameObject, 0.15f);
                enabled = false;
            }
        }
    }
}
