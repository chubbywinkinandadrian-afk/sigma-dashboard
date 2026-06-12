// Re:Impact Unity — floating world-space damage/heal popups.
using UnityEngine;

namespace ReImpact
{
    public static class DamageNumbers
    {
        public static void Spawn(Vector3 worldPos, string text, Color color, float scale = 1f)
        {
            var go = new GameObject("DmgNumber");
            go.transform.position = worldPos + new Vector3(Random.Range(-0.4f, 0.4f), 0f, Random.Range(-0.2f, 0.2f));
            var tm = go.AddComponent<TextMesh>();
            tm.text = text;
            tm.color = color;
            tm.anchor = TextAnchor.MiddleCenter;
            tm.alignment = TextAlignment.Center;
            tm.fontSize = 48;
            tm.characterSize = 0.06f * scale;
            tm.fontStyle = FontStyle.Bold;
            go.AddComponent<DamageNumberFloat>();
        }
    }

    public class DamageNumberFloat : MonoBehaviour
    {
        float _life;
        TextMesh _tm;

        void Awake() { _tm = GetComponent<TextMesh>(); }

        void Update()
        {
            _life += Time.deltaTime;
            transform.position += Vector3.up * (2.2f * Time.deltaTime);
            if (Camera.main != null)
            {
                transform.rotation = Quaternion.LookRotation(transform.position - Camera.main.transform.position);
            }
            if (_tm != null)
            {
                var c = _tm.color;
                c.a = Mathf.Clamp01(1.2f - _life);
                _tm.color = c;
            }
            if (_life > 1.2f) Destroy(gameObject);
        }
    }
}
