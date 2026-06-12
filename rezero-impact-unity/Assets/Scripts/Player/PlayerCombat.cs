// Re:Impact Unity — weapon combos, heavy attacks, skills/bursts, lock-on, party switching.
using System.Collections.Generic;
using UnityEngine;

namespace ReImpact
{
    [RequireComponent(typeof(ThirdPersonController))]
    public class PlayerCombat : MonoBehaviour
    {
        public static PlayerCombat Instance;

        [HideInInspector] public EnemyAI LockTarget;

        ThirdPersonController _tpc;
        GameObject _visual;
        readonly List<string> _party = new List<string>();
        int _activeIdx;

        readonly Dictionary<string, float> _hp = new Dictionary<string, float>();
        readonly Dictionary<string, float> _energy = new Dictionary<string, float>();
        readonly Dictionary<string, float> _skillCd = new Dictionary<string, float>();

        int _comboIdx;
        float _comboTimer = 99f, _attackCd;
        float _lastHurt = -99f;
        float _shield;
        float _atkBuffVal; float _atkBuffUntil;
        Vector3 _spawnPoint;

        public IList<string> Party { get { return _party; } }
        public string ActiveId { get { return _party.Count > 0 ? _party[_activeIdx] : "subaru"; } }
        public float GetHp(string id) { float v; return _hp.TryGetValue(id, out v) ? v : 0f; }
        public float GetEnergy(string id) { float v; return _energy.TryGetValue(id, out v) ? v : 0f; }
        public float GetMaxHp(string id) { int hp, a, d; SaveSystem.Stats(id, out hp, out a, out d); return hp; }
        public float SkillCooldown { get { float v; return _skillCd.TryGetValue(ActiveId, out v) ? v : 0f; } }

        void Awake()
        {
            Instance = this;
            _tpc = GetComponent<ThirdPersonController>();
            _spawnPoint = transform.position;
            RefreshParty();
        }

        public void RefreshParty()
        {
            _party.Clear();
            foreach (var id in SaveSystem.Data.Party)
                if (SaveSystem.Owned(id) != null) _party.Add(id);
            if (_party.Count == 0) _party.Add("subaru");
            _activeIdx = Mathf.Clamp(_activeIdx, 0, _party.Count - 1);
            foreach (var id in _party)
            {
                if (!_hp.ContainsKey(id)) _hp[id] = GetMaxHp(id);
                if (!_energy.ContainsKey(id)) _energy[id] = 0f;
                if (!_skillCd.ContainsKey(id)) _skillCd[id] = 0f;
            }
            RebuildVisual();
        }

        void RebuildVisual()
        {
            if (_visual != null) Destroy(_visual);
            _visual = CharacterVisuals.Spawn(ActiveId, transform);
        }

        float EffectiveAtk()
        {
            int hp, atk, def; SaveSystem.Stats(ActiveId, out hp, out atk, out def);
            float buff = Time.time < _atkBuffUntil ? 1f + _atkBuffVal : 1f;
            return atk * buff;
        }

        float EffectiveDef()
        {
            int hp, atk, def; SaveSystem.Stats(ActiveId, out hp, out atk, out def);
            return def;
        }

        void Update()
        {
            float dt = Time.deltaTime;
            _comboTimer += dt;
            _attackCd = Mathf.Max(0f, _attackCd - dt);
            var keys = new List<string>(_skillCd.Keys);
            foreach (var k in keys) _skillCd[k] = Mathf.Max(0f, _skillCd[k] - dt);
            if (_comboTimer > 1.3f) _comboIdx = 0;
            _tpc.MoveFactor = Mathf.MoveTowards(_tpc.MoveFactor, 1f, dt * 4f);

            // out-of-combat regen
            if (Time.time - _lastHurt > 6f)
            {
                foreach (var id in _party)
                    _hp[id] = Mathf.Min(GetMaxHp(id), _hp[id] + GetMaxHp(id) * 0.045f * dt);
            }

            if (Cursor.lockState != CursorLockMode.Locked) return;

            // party switch
            for (int i = 0; i < 4 && i < _party.Count; i++)
            {
                if (Input.GetKeyDown(KeyCode.Alpha1 + i) && i != _activeIdx && _hp[_party[i]] > 0f)
                {
                    _activeIdx = i;
                    RebuildVisual();
                    GameHUD.Toast(GameData.Character(ActiveId).Name + " takes the field!");
                }
            }

            // lock-on
            if (Input.GetKeyDown(KeyCode.Tab))
            {
                LockTarget = LockTarget != null ? null : NearestEnemy(30f);
            }
            if (LockTarget != null && (LockTarget.IsDead ||
                (LockTarget.transform.position - transform.position).sqrMagnitude > 42f * 42f))
                LockTarget = null;

            // attacks
            var def = GameData.Character(ActiveId);
            WeaponMoveset ms;
            if (!GameData.Movesets.TryGetValue(def.Weapon, out ms)) ms = GameData.Movesets[WeaponKind.Sword];

            if (Input.GetMouseButtonDown(1) && _attackCd <= 0f && _tpc.TrySpendStamina(16f))
            {
                DoStrike(ms.Heavy, ms.CasterBolts > 0, true);
                _comboIdx = 0;
            }
            else if (Input.GetMouseButton(0) && _attackCd <= 0f && _tpc.TrySpendStamina(5f))
            {
                var step = ms.Combo[_comboIdx % ms.Combo.Length];
                DoStrike(step, ms.CasterBolts > 0, false);
                _comboIdx++;
            }

            // skill / burst
            if (Input.GetKeyDown(KeyCode.E) && SkillCooldown <= 0f)
            {
                if (CastSkill(def.Skill, false))
                {
                    _skillCd[ActiveId] = def.Skill.Cooldown;
                    AddEnergy(ActiveId, 14f);
                }
            }
            if (Input.GetKeyDown(KeyCode.Q) && _energy[ActiveId] >= 100f)
            {
                if (CastSkill(def.Burst, true)) _energy[ActiveId] = 0f;
            }
        }

        void DoStrike(LightStep step, bool caster, bool heavy)
        {
            var def = GameData.Character(ActiveId);
            _attackCd = step.Rate;
            _comboTimer = 0f;
            _tpc.MoveFactor = 0.35f;
            if (step.Lunge > 0f) _tpc.AddKnockback(transform.forward, step.Lunge * 2.5f);

            if (caster)
            {
                Vector3 from = transform.position + Vector3.up * 1.6f + transform.forward * 0.6f;
                Vector3 dir = AimDirection();
                float dmg = EffectiveAtk() * step.Mult * Random.Range(0.92f, 1.08f);
                var bolt = Projectile.Spawn(from, dir, true, dmg, def.Element, heavy ? 17f : 26f, heavy ? 1.8f : 1f);
                if (heavy) bolt.HitRadius = 2f;
                AddEnergy(ActiveId, 6f);
                return;
            }

            bool landed = false;
            foreach (var e in EnemyAI.All)
            {
                if (e == null || e.IsDead) continue;
                Vector3 to = e.transform.position - transform.position;
                to.y = 0f;
                float dist = to.magnitude;
                if (dist > step.Range + e.Size) continue;
                if (step.ArcDot > -0.99f && Vector3.Dot(transform.forward, to.normalized) < step.ArcDot) continue;
                float dmg = EffectiveAtk() * step.Mult * Random.Range(0.92f, 1.08f);
                if (Random.value * 100f < def.Crit) dmg *= 1.5f;
                e.TakeElementalHit(dmg, def.Element, transform.position);
                landed = true;
            }
            if (landed) AddEnergy(ActiveId, 6f);
        }

        Vector3 AimDirection()
        {
            if (LockTarget != null)
            {
                Vector3 to = (LockTarget.transform.position + Vector3.up * LockTarget.Size) -
                             (transform.position + Vector3.up * 1.6f);
                return to.normalized;
            }
            return transform.forward;
        }

        bool CastSkill(SkillDef skill, bool isBurst)
        {
            var def = GameData.Character(ActiveId);
            float atk = EffectiveAtk();
            switch (skill.Kind)
            {
                case SkillKind.Damage:
                {
                    var target = NearestEnemy(9f);
                    if (target == null) { GameHUD.Toast("No target in range."); return false; }
                    target.TakeElementalHit(atk * skill.Mult, def.Element, transform.position);
                    break;
                }
                case SkillKind.AOE:
                {
                    bool any = false;
                    foreach (var e in EnemyAI.All)
                    {
                        if (e == null || e.IsDead) continue;
                        if ((e.transform.position - transform.position).sqrMagnitude < 10f * 10f)
                        {
                            e.TakeElementalHit(atk * skill.Mult, def.Element, transform.position);
                            any = true;
                        }
                    }
                    if (!any) { GameHUD.Toast("No target in range."); return false; }
                    break;
                }
                case SkillKind.Heal:
                {
                    string low = null; float lowFrac = 2f;
                    foreach (var id in _party)
                    {
                        if (_hp[id] <= 0f) continue;
                        float frac = _hp[id] / GetMaxHp(id);
                        if (frac < lowFrac) { lowFrac = frac; low = id; }
                    }
                    if (low != null)
                    {
                        float amount = atk * skill.Mult * 3f;
                        _hp[low] = Mathf.Min(GetMaxHp(low), _hp[low] + amount);
                        DamageNumbers.Spawn(transform.position + Vector3.up * 2.4f,
                            "+" + Mathf.RoundToInt(amount), new Color(0.55f, 0.88f, 0.6f));
                    }
                    break;
                }
                case SkillKind.BuffAtk:
                    _atkBuffVal = skill.Mult;
                    _atkBuffUntil = Time.time + 10f;
                    GameHUD.Toast("ATK up!");
                    break;
                case SkillKind.Shield:
                    _shield += atk * skill.Mult * 3f;
                    GameHUD.Toast("Shielded!");
                    break;
            }
            return true;
        }

        EnemyAI NearestEnemy(float maxDist)
        {
            EnemyAI best = null;
            float bd = maxDist * maxDist;
            foreach (var e in EnemyAI.All)
            {
                if (e == null || e.IsDead) continue;
                float d = (e.transform.position - transform.position).sqrMagnitude;
                if (d < bd) { bd = d; best = e; }
            }
            return best;
        }

        void AddEnergy(string id, float amount)
        {
            _energy[id] = Mathf.Min(100f, _energy[id] + amount);
        }

        public void TakeDamage(float raw, Vector3 sourcePos, bool knock)
        {
            if (_tpc.InIFrames)
            {
                DamageNumbers.Spawn(transform.position + Vector3.up * 2.4f, "dodged!", new Color(0.75f, 0.83f, 1f));
                return;
            }
            float dmg = raw * Random.Range(0.92f, 1.08f) * (100f / (100f + EffectiveDef()));
            if (_shield > 0f)
            {
                float absorbed = Mathf.Min(_shield, dmg);
                _shield -= absorbed; dmg -= absorbed;
            }
            dmg = Mathf.Max(1f, dmg);
            string id = ActiveId;
            _hp[id] = Mathf.Max(0f, _hp[id] - dmg);
            _lastHurt = Time.time;
            AddEnergy(id, 5f);
            DamageNumbers.Spawn(transform.position + Vector3.up * 2.4f,
                Mathf.RoundToInt(dmg).ToString(), new Color(1f, 0.55f, 0.48f));
            if (knock) _tpc.AddKnockback(transform.position - sourcePos, 6f);

            if (_hp[id] <= 0f)
            {
                int next = -1;
                for (int i = 0; i < _party.Count; i++) if (_hp[_party[i]] > 0f) { next = i; break; }
                if (next >= 0)
                {
                    _activeIdx = next;
                    RebuildVisual();
                    GameHUD.Toast(GameData.Character(ActiveId).Name + " takes the field!");
                }
                else
                {
                    ReturnByDeath();
                }
            }
        }

        void ReturnByDeath()
        {
            GameHUD.Toast("RETURN BY DEATH — you wake at the plaza...");
            var cc = GetComponent<CharacterController>();
            cc.enabled = false;
            transform.position = _spawnPoint;
            cc.enabled = true;
            foreach (var id in _party) { _hp[id] = GetMaxHp(id); _energy[id] = 0f; }
            _shield = 0f;
            LockTarget = null;
            if (QuestManager.Instance != null) QuestManager.Instance.ResetEncounter();
        }
    }
}
