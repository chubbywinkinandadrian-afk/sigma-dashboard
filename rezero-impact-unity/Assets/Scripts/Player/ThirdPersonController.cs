// Re:Impact Unity — third-person movement: jump, sprint+stamina, dodge i-frames.
using UnityEngine;

namespace ReImpact
{
    [RequireComponent(typeof(CharacterController))]
    public class ThirdPersonController : MonoBehaviour
    {
        public float MoveSpeed = 7.2f;
        public float SprintMult = 1.65f;
        public float JumpVelocity = 9.4f;
        public float Gravity = 24f;
        public float DodgeSpeed = 13f;
        public float DodgeDuration = 0.3f;
        public float DodgeCooldown = 0.95f;
        public float DodgeIFrames = 0.45f;
        public float MaxStamina = 100f;

        [HideInInspector] public float Stamina = 100f;
        [HideInInspector] public float MoveFactor = 1f;   // PlayerCombat slows movement during swings
        [HideInInspector] public bool InIFrames;
        [HideInInspector] public Transform CameraTransform;

        CharacterController _cc;
        float _vy;
        float _dodgeT, _dodgeCd, _iframeT, _staminaPauseT;
        Vector3 _dodgeDir = Vector3.forward;
        Vector3 _knock;

        public bool IsGrounded { get { return _cc != null && _cc.isGrounded; } }
        public bool IsDodging { get { return _dodgeT > 0f; } }

        void Awake()
        {
            _cc = GetComponent<CharacterController>();
            Stamina = MaxStamina;
        }

        public bool TrySpendStamina(float amount)
        {
            if (Stamina <= 0f) return false;
            Stamina = Mathf.Max(0f, Stamina - amount);
            _staminaPauseT = 0.5f;
            return true;
        }

        public void AddKnockback(Vector3 dir, float force)
        {
            dir.y = 0f;
            _knock += dir.normalized * force;
        }

        void Update()
        {
            float dt = Time.deltaTime;
            _dodgeCd = Mathf.Max(0f, _dodgeCd - dt);
            _iframeT = Mathf.Max(0f, _iframeT - dt);
            _staminaPauseT = Mathf.Max(0f, _staminaPauseT - dt);
            InIFrames = _iframeT > 0f;

            // camera-relative move intent
            Vector3 input = new Vector3(Input.GetAxisRaw("Horizontal"), 0f, Input.GetAxisRaw("Vertical"));
            Vector3 move = Vector3.zero;
            if (input.sqrMagnitude > 0.01f && CameraTransform != null)
            {
                Vector3 fwd = CameraTransform.forward; fwd.y = 0f; fwd.Normalize();
                Vector3 right = CameraTransform.right; right.y = 0f; right.Normalize();
                move = (fwd * input.z + right * input.x).normalized;
            }

            bool sprint = (Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift))
                          && move.sqrMagnitude > 0.01f && Stamina > 0f && _cc.isGrounded;

            // dodge
            bool dodgePressed = Input.GetKeyDown(KeyCode.LeftControl) || Input.GetKeyDown(KeyCode.RightControl)
                                || Input.GetKeyDown(KeyCode.K);
            if (dodgePressed && _dodgeCd <= 0f && _cc.isGrounded && TrySpendStamina(12f))
            {
                _dodgeT = DodgeDuration;
                _dodgeCd = DodgeCooldown;
                _iframeT = DodgeIFrames;
                _dodgeDir = move.sqrMagnitude > 0.01f ? move : -transform.forward;
            }

            Vector3 velocity;
            if (_dodgeT > 0f)
            {
                _dodgeT -= dt;
                velocity = _dodgeDir * DodgeSpeed;
            }
            else
            {
                float speed = MoveSpeed * MoveFactor;
                if (sprint)
                {
                    speed *= SprintMult;
                    Stamina = Mathf.Max(0f, Stamina - 9f * dt);
                    _staminaPauseT = 0.5f;
                }
                velocity = move * speed;
                if (move.sqrMagnitude > 0.01f && PlayerCombat.Instance != null && PlayerCombat.Instance.LockTarget == null)
                {
                    Quaternion want = Quaternion.LookRotation(move);
                    transform.rotation = Quaternion.Slerp(transform.rotation, want, dt * 12f);
                }
            }

            // facing locked target
            if (PlayerCombat.Instance != null && PlayerCombat.Instance.LockTarget != null)
            {
                Vector3 to = PlayerCombat.Instance.LockTarget.transform.position - transform.position;
                to.y = 0f;
                if (to.sqrMagnitude > 0.01f)
                    transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(to), dt * 14f);
            }

            // vertical
            if (_cc.isGrounded)
            {
                _vy = -1f;
                if (Input.GetKeyDown(KeyCode.Space)) _vy = JumpVelocity;
            }
            else
            {
                _vy -= Gravity * dt;
            }

            // knockback decay
            velocity += _knock;
            _knock = Vector3.Lerp(_knock, Vector3.zero, dt * 6f);

            velocity.y = _vy;
            _cc.Move(velocity * dt);

            // stamina regen
            if (_staminaPauseT <= 0f && !sprint)
                Stamina = Mathf.Min(MaxStamina, Stamina + 17f * dt);
        }
    }
}
