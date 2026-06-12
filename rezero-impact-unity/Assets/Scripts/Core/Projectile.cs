// Re:Impact Unity — magic bolts (player and enemy). Registry-based hits, no physics layers.
using UnityEngine;

namespace ReImpact
{
    public class Projectile : MonoBehaviour
    {
        public bool FromPlayer;
        public float Damage;
        public Element Element;
        public float Speed = 26f;
        public float Life = 2.2f;
        public float HitRadius = 1.2f;

        public static Projectile Spawn(Vector3 from, Vector3 dir, bool fromPlayer, float damage, Element element, float speed, float scale)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = fromPlayer ? "PlayerBolt" : "EnemyBolt";
            Object.Destroy(go.GetComponent<Collider>());
            go.transform.position = from;
            go.transform.localScale = Vector3.one * (0.45f * scale);
            var mat = new Material(Shader.Find("ReImpact/Toon") ?? Shader.Find("Diffuse"));
            mat.color = ElementSystem.ElementColor(element);
            go.GetComponent<Renderer>().material = mat;
            var p = go.AddComponent<Projectile>();
            p.FromPlayer = fromPlayer;
            p.Damage = damage;
            p.Element = element;
            p.Speed = speed;
            p.transform.forward = dir.normalized;
            return p;
        }

        void Update()
        {
            transform.position += transform.forward * (Speed * Time.deltaTime);
            Life -= Time.deltaTime;
            if (Life <= 0f) { Destroy(gameObject); return; }

            if (FromPlayer)
            {
                for (int i = EnemyAI.All.Count - 1; i >= 0; i--)
                {
                    var e = EnemyAI.All[i];
                    if (e == null || e.IsDead) continue;
                    float r = HitRadius + e.Size * 0.6f;
                    if ((e.transform.position + Vector3.up * e.Size - transform.position).sqrMagnitude < r * r)
                    {
                        e.TakeElementalHit(Damage, Element, transform.position);
                        Destroy(gameObject);
                        return;
                    }
                }
            }
            else if (PlayerCombat.Instance != null)
            {
                Vector3 pp = PlayerCombat.Instance.transform.position + Vector3.up * 1.2f;
                if ((pp - transform.position).sqrMagnitude < HitRadius * HitRadius)
                {
                    PlayerCombat.Instance.TakeDamage(Damage, transform.position, false);
                    Destroy(gameObject);
                }
            }
        }
    }
}
