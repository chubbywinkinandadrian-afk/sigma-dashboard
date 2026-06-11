using UnityEngine;

namespace SAO.Player
{
    /// <summary>
    /// First-person controller for the Aincrad project.
    ///
    /// Features
    ///  - WASD movement relative to facing (Input Manager axes, no packages)
    ///  - Mouse look: body yaw + camera pitch with clamp, cursor lock
    ///  - Jump (Space) with coyote time + jump buffering so it never feels
    ///    like an input was "eaten"
    ///  - Sprint (Left Shift) gated by a stamina pool
    ///  - Stamina: drains while sprinting, costs a chunk per jump, regenerates
    ///    after a short delay. Hitting zero triggers an "exhausted" state that
    ///    lasts until partially refilled (hysteresis), which prevents the
    ///    stutter-sprint exploit of tapping Shift at 1% stamina.
    ///  - Game-feel extras: sprint FOV kick, subtle head bob, landing dip
    ///
    /// Setup
    ///  - Attach to a GameObject with a CharacterController
    ///    (height 1.8, radius 0.35, center (0, 0.9, 0) works well).
    ///  - Put the Camera on a CHILD object at local position (0, 1.62, 0).
    ///    If the camera field is left empty the controller finds it on Awake.
    ///  - Or just run  Tools > SAO > 3. Build FPS Player Rig  in the editor.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class FPSController : MonoBehaviour
    {
        // ------------------------------------------------------------------ //
        //  Inspector
        // ------------------------------------------------------------------ //

        [Header("References")]
        [Tooltip("Child camera. Auto-detected from children if left empty.")]
        [SerializeField] private Camera playerCamera;

        [Header("Movement")]
        [Tooltip("Walk speed in m/s. SAO avatars move briskly; 4.5 reads heroic without feeling slippery.")]
        [SerializeField] private float walkSpeed = 4.5f;
        [Tooltip("Sprint speed in m/s while Shift is held and stamina remains.")]
        [SerializeField] private float sprintSpeed = 7.5f;
        [Tooltip("How fast we reach target speed on the ground. High = responsive.")]
        [SerializeField] private float groundAcceleration = 40f;
        [Tooltip("How fast we stop when input is released. Higher than accel so stopping feels planted.")]
        [SerializeField] private float groundDeceleration = 55f;
        [Tooltip("Steering authority while airborne. Low value keeps jumps committed.")]
        [SerializeField] private float airAcceleration = 12f;

        [Header("Jump & Gravity")]
        [Tooltip("Apex height of a jump in meters.")]
        [SerializeField] private float jumpHeight = 1.1f;
        [Tooltip("Gravity in m/s^2 (negative). Stronger than -9.81 so the arc feels snappy, not floaty.")]
        [SerializeField] private float gravity = -25f;
        [Tooltip("Small constant downward velocity while grounded; keeps the controller glued on slopes and stairs.")]
        [SerializeField] private float groundStickVelocity = -3f;
        [Tooltip("Grace period after walking off a ledge during which a jump still counts (seconds).")]
        [SerializeField] private float coyoteTime = 0.12f;
        [Tooltip("How early a jump press may arrive before landing and still fire (seconds).")]
        [SerializeField] private float jumpBufferTime = 0.10f;

        [Header("Mouse Look")]
        [Tooltip("Degrees of rotation per mouse unit. 2.2 is a comfortable mid sensitivity.")]
        [SerializeField] private float mouseSensitivity = 2.2f;
        [Tooltip("How far the player can look up/down, in degrees.")]
        [SerializeField] private float pitchClamp = 85f;

        [Header("Stamina")]
        [SerializeField] private float maxStamina = 100f;
        [Tooltip("Stamina drained per second of sprinting.")]
        [SerializeField] private float sprintDrainPerSecond = 18f;
        [Tooltip("Flat stamina cost of a jump.")]
        [SerializeField] private float jumpStaminaCost = 12f;
        [Tooltip("Stamina regenerated per second once regen kicks in.")]
        [SerializeField] private float regenPerSecond = 22f;
        [Tooltip("Seconds after the last stamina spend before regen begins.")]
        [SerializeField] private float regenDelay = 0.8f;
        [Tooltip("After hitting 0, sprint/jump stay locked until stamina refills to this fraction of max.")]
        [Range(0.05f, 0.9f)]
        [SerializeField] private float exhaustionRecoveryFraction = 0.3f;

        [Header("Game Feel")]
        [Tooltip("Extra FOV while sprinting; sells the speed change.")]
        [SerializeField] private float sprintFovKick = 8f;
        [SerializeField] private float fovLerpSpeed = 8f;
        [Tooltip("Head bob vertical amplitude in meters. Keep tiny; this is seasoning, not soup.")]
        [SerializeField] private float bobAmplitude = 0.045f;
        [SerializeField] private float bobWalkFrequency = 8f;
        [SerializeField] private float bobSprintFrequency = 11.5f;
        [Tooltip("Camera dip scale when landing from a fall.")]
        [SerializeField] private float landingDipScale = 0.018f;

        // ------------------------------------------------------------------ //
        //  Public read-only state (for HUD / other systems)
        // ------------------------------------------------------------------ //

        /// <summary>Current stamina normalized to 0..1 — feed this to a HUD bar.</summary>
        public float Stamina01 => stamina / maxStamina;

        /// <summary>True while the exhaustion lockout is active.</summary>
        public bool IsExhausted { get; private set; }

        /// <summary>True while actually sprint-moving this frame.</summary>
        public bool IsSprinting { get; private set; }

        // ------------------------------------------------------------------ //
        //  Private state
        // ------------------------------------------------------------------ //

        private CharacterController controller;
        private Transform camTransform;

        // look
        private float pitch;                    // accumulated camera pitch in degrees

        // movement
        private Vector3 horizontalVelocity;     // XZ plane velocity
        private float verticalVelocity;         // Y velocity (gravity / jump)
        private Vector2 moveInput;              // sanitized WASD this frame
        private bool wasGrounded;
        private float lastGroundedTime = -999f; // for coyote time
        private float jumpPressedTime = -999f;  // for jump buffering

        // stamina
        private float stamina;
        private float lastStaminaSpendTime = -999f;

        // camera feel
        private float baseFov;
        private Vector3 baseCamLocalPos;
        private float bobTimer;
        private float landingDip;               // negative camera offset that decays after landing

        // ------------------------------------------------------------------ //
        //  Unity lifecycle
        // ------------------------------------------------------------------ //

        private void Awake()
        {
            controller = GetComponent<CharacterController>();

            // Find the camera if not wired up in the inspector.
            if (playerCamera == null)
                playerCamera = GetComponentInChildren<Camera>(true);

            if (playerCamera == null)
            {
                Debug.LogError("[FPSController] No child Camera found. Add a Camera as a child " +
                               "of the player (local pos ~(0, 1.62, 0)) or assign one in the inspector.");
                enabled = false;
                return;
            }

            camTransform = playerCamera.transform;
            baseFov = playerCamera.fieldOfView;
            baseCamLocalPos = camTransform.localPosition;

            stamina = maxStamina;
        }

        private void Start()
        {
            LockCursor(true);
        }

        private void Update()
        {
            HandleCursorToggle();

            // Only rotate with the mouse while the cursor is captured,
            // so alt-tabbing or opening menus doesn't spin the view.
            if (Cursor.lockState == CursorLockMode.Locked)
                HandleMouseLook();

            ReadMoveInput();
            UpdateStamina();
            HandleMovement();
            UpdateCameraFeel();
        }

        // ------------------------------------------------------------------ //
        //  Cursor
        // ------------------------------------------------------------------ //

        private void HandleCursorToggle()
        {
            // Escape frees the cursor (handy in the editor); click recaptures.
            if (Input.GetKeyDown(KeyCode.Escape))
                LockCursor(false);
            else if (Cursor.lockState != CursorLockMode.Locked && Input.GetMouseButtonDown(0))
                LockCursor(true);
        }

        private void LockCursor(bool locked)
        {
            Cursor.lockState = locked ? CursorLockMode.Locked : CursorLockMode.None;
            Cursor.visible = !locked;
        }

        // ------------------------------------------------------------------ //
        //  Look
        // ------------------------------------------------------------------ //

        private void HandleMouseLook()
        {
            // Mouse axes are already per-frame deltas — do NOT multiply by
            // deltaTime or sensitivity becomes framerate-dependent.
            float mouseX = Input.GetAxisRaw("Mouse X") * mouseSensitivity;
            float mouseY = Input.GetAxisRaw("Mouse Y") * mouseSensitivity;

            // Yaw rotates the whole body so movement direction follows the view.
            transform.Rotate(0f, mouseX, 0f, Space.Self);

            // Pitch rotates only the camera, clamped so we can't somersault.
            pitch = Mathf.Clamp(pitch - mouseY, -pitchClamp, pitchClamp);
            camTransform.localRotation = Quaternion.Euler(pitch, 0f, 0f);
        }

        // ------------------------------------------------------------------ //
        //  Input
        // ------------------------------------------------------------------ //

        private void ReadMoveInput()
        {
            // Raw axes = no Unity smoothing; we do our own acceleration so the
            // response curve is fully under our control.
            moveInput = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));

            // Normalize only when needed so diagonal isn't faster, but analog
            // partial input (gamepads later) is preserved.
            if (moveInput.sqrMagnitude > 1f)
                moveInput.Normalize();

            // Buffer the jump press; consumption happens in HandleMovement.
            if (Input.GetKeyDown(KeyCode.Space))
                jumpPressedTime = Time.time;
        }

        // ------------------------------------------------------------------ //
        //  Stamina
        // ------------------------------------------------------------------ //

        private void UpdateStamina()
        {
            // Sprint intent: Shift held, pushing (mostly) forward, not locked out.
            bool wantsSprint = Input.GetKey(KeyCode.LeftShift)
                               && moveInput.y > 0.05f
                               && !IsExhausted
                               && stamina > 0f;

            IsSprinting = wantsSprint && moveInput.sqrMagnitude > 0.01f;

            if (IsSprinting)
            {
                SpendStamina(sprintDrainPerSecond * Time.deltaTime);
            }
            else if (Time.time - lastStaminaSpendTime >= regenDelay && stamina < maxStamina)
            {
                stamina = Mathf.Min(maxStamina, stamina + regenPerSecond * Time.deltaTime);

                // Exhaustion clears only once we've recovered a real buffer.
                if (IsExhausted && stamina >= maxStamina * exhaustionRecoveryFraction)
                    IsExhausted = false;
            }
        }

        private void SpendStamina(float amount)
        {
            stamina = Mathf.Max(0f, stamina - amount);
            lastStaminaSpendTime = Time.time;

            if (stamina <= 0f)
                IsExhausted = true;     // lockout until recovery threshold
        }

        // ------------------------------------------------------------------ //
        //  Movement
        // ------------------------------------------------------------------ //

        private void HandleMovement()
        {
            // isGrounded reflects the previous Move() call — the standard
            // CharacterController pattern.
            bool grounded = controller.isGrounded;
            if (grounded)
                lastGroundedTime = Time.time;

            // --- landing dip ------------------------------------------------
            if (grounded && !wasGrounded && verticalVelocity < -4f)
            {
                // Dip the camera proportionally to impact speed, clamped so a
                // big fall doesn't bury the camera in the floor.
                landingDip = Mathf.Max(-0.22f, verticalVelocity * landingDipScale);
            }

            // --- horizontal -------------------------------------------------
            float targetSpeed = IsSprinting ? sprintSpeed : walkSpeed;
            Vector3 desired = (transform.right * moveInput.x + transform.forward * moveInput.y) * targetSpeed;

            float accel = grounded
                ? (desired.sqrMagnitude > 0.01f ? groundAcceleration : groundDeceleration)
                : airAcceleration;

            horizontalVelocity = Vector3.MoveTowards(horizontalVelocity, desired, accel * Time.deltaTime);

            // --- vertical ---------------------------------------------------
            if (grounded && verticalVelocity < 0f)
                verticalVelocity = groundStickVelocity;   // glue to ground/slopes

            // Jump fires if a buffered press exists AND we were grounded
            // within the coyote window. Exhausted players can't jump — legs
            // of jelly, just like post-boss-fight Kirito.
            bool bufferedJump = Time.time - jumpPressedTime <= jumpBufferTime;
            bool canUseGround = Time.time - lastGroundedTime <= coyoteTime;

            if (bufferedJump && canUseGround && !IsExhausted && verticalVelocity <= 0.1f)
            {
                // v = sqrt(2 * g * h) gives an exact apex height.
                verticalVelocity = Mathf.Sqrt(2f * -gravity * jumpHeight);
                jumpPressedTime = -999f;        // consume the buffer
                lastGroundedTime = -999f;       // consume coyote
                SpendStamina(jumpStaminaCost);
            }

            verticalVelocity += gravity * Time.deltaTime;

            // --- integrate --------------------------------------------------
            Vector3 frameVelocity = horizontalVelocity + Vector3.up * verticalVelocity;
            controller.Move(frameVelocity * Time.deltaTime);

            // Cancel upward velocity when we bonk a ceiling beam.
            if ((controller.collisionFlags & CollisionFlags.Above) != 0 && verticalVelocity > 0f)
                verticalVelocity = 0f;

            wasGrounded = grounded;
        }

        // ------------------------------------------------------------------ //
        //  Camera feel (FOV kick, head bob, landing dip)
        // ------------------------------------------------------------------ //

        private void UpdateCameraFeel()
        {
            // FOV kick while sprinting.
            float targetFov = baseFov + (IsSprinting ? sprintFovKick : 0f);
            playerCamera.fieldOfView = Mathf.Lerp(playerCamera.fieldOfView, targetFov,
                                                  fovLerpSpeed * Time.deltaTime);

            // Head bob only while grounded and actually moving.
            float planarSpeed = horizontalVelocity.magnitude;
            Vector3 bobOffset = Vector3.zero;

            if (controller.isGrounded && planarSpeed > 0.4f)
            {
                float sprint01 = Mathf.InverseLerp(walkSpeed, sprintSpeed, planarSpeed);
                float frequency = Mathf.Lerp(bobWalkFrequency, bobSprintFrequency, sprint01);
                bobTimer += Time.deltaTime * frequency;

                float intensity = Mathf.Clamp01(planarSpeed / walkSpeed);
                bobOffset.y = Mathf.Sin(bobTimer) * bobAmplitude * intensity;
                bobOffset.x = Mathf.Cos(bobTimer * 0.5f) * bobAmplitude * 0.5f * intensity;
            }
            else
            {
                bobTimer = 0f;
            }

            // Landing dip decays back to zero.
            landingDip = Mathf.Lerp(landingDip, 0f, 7f * Time.deltaTime);

            Vector3 targetLocal = baseCamLocalPos + bobOffset + Vector3.up * landingDip;
            camTransform.localPosition = Vector3.Lerp(camTransform.localPosition, targetLocal,
                                                      14f * Time.deltaTime);
        }
    }
}
