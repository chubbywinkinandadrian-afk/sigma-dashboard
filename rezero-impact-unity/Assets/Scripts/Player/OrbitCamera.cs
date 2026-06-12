// Re:Impact Unity — third-person orbit camera with cursor lock and wall avoidance.
using UnityEngine;

namespace ReImpact
{
    public class OrbitCamera : MonoBehaviour
    {
        public Transform Target;
        public float Distance = 8.5f;
        public float MinDistance = 4f, MaxDistance = 15f;
        public float Sensitivity = 2.4f;
        public float PitchMin = 5f, PitchMax = 70f;
        public Vector3 TargetOffset = new Vector3(0f, 2.0f, 0f);

        float _yaw = 180f, _pitch = 24f;

        void Start()
        {
            if (Target != null)
            {
                var tpc = Target.GetComponent<ThirdPersonController>();
                if (tpc != null) tpc.CameraTransform = transform;
            }
        }

        void Update()
        {
            if (Input.GetMouseButtonDown(0) && Cursor.lockState != CursorLockMode.Locked && !SummonPanel.IsOpen)
            {
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;
            }
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
            }
            if (Cursor.lockState == CursorLockMode.Locked)
            {
                _yaw += Input.GetAxis("Mouse X") * Sensitivity;
                _pitch -= Input.GetAxis("Mouse Y") * Sensitivity;
                _pitch = Mathf.Clamp(_pitch, PitchMin, PitchMax);
            }
            float scroll = Input.GetAxis("Mouse ScrollWheel");
            if (Mathf.Abs(scroll) > 0.001f)
                Distance = Mathf.Clamp(Distance - scroll * 4f, MinDistance, MaxDistance);
        }

        void LateUpdate()
        {
            if (Target == null) return;

            // soft lock-on bias
            if (PlayerCombat.Instance != null && PlayerCombat.Instance.LockTarget != null)
            {
                Vector3 to = PlayerCombat.Instance.LockTarget.transform.position - Target.position;
                float wantYaw = Mathf.Atan2(to.x, to.z) * Mathf.Rad2Deg + 180f;
                _yaw = Mathf.LerpAngle(_yaw, wantYaw, Time.deltaTime * 2.5f);
            }

            Vector3 pivot = Target.position + TargetOffset;
            Quaternion rot = Quaternion.Euler(_pitch, _yaw, 0f);
            Vector3 desired = pivot - rot * Vector3.forward * Distance;

            // keep camera out of walls
            RaycastHit hit;
            Vector3 dir = desired - pivot;
            float dist = dir.magnitude;
            if (Physics.SphereCast(pivot, 0.35f, dir.normalized, out hit, dist))
                desired = pivot + dir.normalized * Mathf.Max(1.2f, hit.distance - 0.2f);

            transform.position = desired;
            transform.rotation = Quaternion.LookRotation(pivot - transform.position);
        }
    }
}
