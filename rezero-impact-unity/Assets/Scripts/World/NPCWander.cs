// Re:Impact Unity — ambient NPC: strolls near home, offers an original bark up close.
using UnityEngine;

namespace ReImpact
{
    public class NPCWander : MonoBehaviour
    {
        public float WanderRadius = 8f;
        [TextArea] public string Line = "Cold day, isn't it? Festival weather.";

        Vector3 _home;
        float _phase;
        float _lastBark = -999f;

        void Start()
        {
            _home = transform.position;
            _phase = Random.value * Mathf.PI * 2f;
        }

        void Update()
        {
            _phase += Time.deltaTime * 0.22f;
            float r = WanderRadius * (0.4f + 0.6f * Mathf.Abs(Mathf.Sin(_phase * 0.43f)));
            Vector3 target = _home + new Vector3(Mathf.Cos(_phase) * r, 0f, Mathf.Sin(_phase * 0.77f) * r);
            Vector3 to = target - transform.position; to.y = 0f;
            if (to.magnitude > 0.1f)
            {
                transform.position += to.normalized * Mathf.Min(1.1f * Time.deltaTime, to.magnitude);
                transform.rotation = Quaternion.Slerp(transform.rotation,
                    Quaternion.LookRotation(to.normalized), Time.deltaTime * 4f);
            }
            RaycastHit hit;
            if (Physics.Raycast(transform.position + Vector3.up * 10f, Vector3.down, out hit, 30f))
                transform.position = new Vector3(transform.position.x, hit.point.y, transform.position.z);

            if (PlayerCombat.Instance != null && Time.time - _lastBark > 30f)
            {
                Vector3 pp = PlayerCombat.Instance.transform.position - transform.position;
                pp.y = 0f;
                if (pp.sqrMagnitude < 5f * 5f)
                {
                    _lastBark = Time.time;
                    GameHUD.ShowBark(Line);
                }
            }
        }
    }
}
