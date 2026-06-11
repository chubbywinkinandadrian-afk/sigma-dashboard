using UnityEngine;

namespace SAO.UI
{
    /// <summary>
    /// Slow cinematic orbit for the main menu: circles a target (the Aincrad
    /// castle) at a fixed distance and height, with a gentle vertical drift so
    /// the shot never feels mechanical. Runs in LateUpdate like any follow cam.
    /// </summary>
    public class MenuOrbitCamera : MonoBehaviour
    {
        [Header("Target")]
        [Tooltip("Point the camera circles and looks at (e.g. mid-height of the castle).")]
        public Transform target;

        [Header("Orbit")]
        [Tooltip("Horizontal distance from the target.")]
        public float distance = 115f;
        [Tooltip("Camera height relative to the target's Y.")]
        public float height = 42f;
        [Tooltip("Orbit speed in degrees per second. Keep it slow and stately.")]
        public float degreesPerSecond = 3.5f;

        [Header("Drift")]
        [Tooltip("Amplitude of the slow vertical bob in meters.")]
        public float bobAmplitude = 2.5f;
        [Tooltip("Vertical bob cycles per second. Very low = breathing, not bouncing.")]
        public float bobFrequency = 0.05f;

        private float angleDeg;

        private void Start()
        {
            // Start from wherever the camera was placed so designers can pick
            // the opening framing just by positioning it in the scene.
            if (target != null)
            {
                Vector3 flat = transform.position - target.position;
                flat.y = 0f;
                if (flat.sqrMagnitude > 0.01f)
                    angleDeg = Mathf.Atan2(flat.z, flat.x) * Mathf.Rad2Deg;
            }
        }

        private void LateUpdate()
        {
            if (target == null)
            {
                // No target: degrade gracefully to a slow self-spin.
                transform.Rotate(0f, degreesPerSecond * Time.deltaTime, 0f, Space.World);
                return;
            }

            angleDeg += degreesPerSecond * Time.deltaTime;
            float rad = angleDeg * Mathf.Deg2Rad;

            float bob = Mathf.Sin(Time.time * bobFrequency * 2f * Mathf.PI) * bobAmplitude;

            Vector3 offset = new Vector3(Mathf.Cos(rad) * distance,
                                         height + bob,
                                         Mathf.Sin(rad) * distance);

            transform.position = target.position + offset;
            transform.LookAt(target.position);
        }
    }
}
