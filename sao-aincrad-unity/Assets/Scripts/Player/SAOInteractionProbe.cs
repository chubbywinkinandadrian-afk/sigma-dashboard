using UnityEngine;
using SAO.Interaction;

namespace SAO.Player
{
    /// <summary>
    /// First-person interaction sensor: raycasts from the center of the
    /// player camera every frame, ignores the player's own colliders, and
    /// looks for an IInteractable on the hit object or its parents.
    ///
    ///   look at interactable -> InteractionPromptUI shows PromptText ->
    ///   press the interact key -> Interact(player) runs on the target
    ///
    /// This stays a sensor + dispatcher: what an interaction *does* lives in
    /// the IInteractable implementation (signs now; doors / NPCs / loot
    /// later). No dialogue, inventory or quest logic in here.
    ///
    /// Setup: attach to the same GameObject as FPSController. Like the
    /// controller, it finds the child camera on Awake if none is assigned.
    /// </summary>
    public class SAOInteractionProbe : MonoBehaviour
    {
        [Header("Probe")]
        [Tooltip("Camera whose view center the ray fires from. Auto-detected from children if left empty.")]
        public Camera probeCamera;
        [Tooltip("How far ahead (meters) the player can reach things.")]
        public float interactDistance = 3f;
        [Tooltip("Layers the probe can hit. Defaults to everything except Ignore Raycast.")]
        public LayerMask interactMask = Physics.DefaultRaycastLayers;
        [Tooltip("Key that uses whatever is under the crosshair.")]
        public KeyCode interactKey = KeyCode.E;

        [Header("Debug")]
        [Tooltip("Draw the probe ray in the Scene view (green = interactable, yellow = plain hit, gray = miss).")]
        public bool showDebugRay = true;
        [Tooltip("Log interactions and empty presses to the console.")]
        public bool logOnInteract = true;

        /// <summary>Interactable under the crosshair, or null. The prompt UI
        /// and future systems read this instead of raycasting again.</summary>
        public IInteractable CurrentInteractable { get; private set; }

        /// <summary>Collider under the crosshair (interactable or not), or null.</summary>
        public Collider CurrentTarget { get; private set; }

        /// <summary>Hit info for CurrentTarget. Only meaningful while
        /// CurrentTarget is non-null.</summary>
        public RaycastHit CurrentHit { get; private set; }

        /// <summary>True while a prompt should be visible.</summary>
        public bool HasInteractable => CurrentInteractable != null;

        /// <summary>Prompt line for the current interactable; "" when none.</summary>
        public string CurrentPrompt =>
            CurrentInteractable != null ? CurrentInteractable.PromptText : string.Empty;

        // The ray starts inside the player's own CharacterController, which
        // PhysX can report as a hit at 0.00 m. So: collect everything along
        // the ray and skip colliders under this transform, rather than
        // trusting the closest raw hit. 8 slots is plenty for a 3 m ray.
        private readonly RaycastHit[] hitBuffer = new RaycastHit[8];
        private Transform eye;

        private void Awake()
        {
            if (probeCamera == null) probeCamera = GetComponentInChildren<Camera>();
            eye = probeCamera != null ? probeCamera.transform : transform;
            if (probeCamera == null)
                Debug.LogWarning("[SAO] SAOInteractionProbe found no camera; probing from the player root instead.", this);
        }

        private void Update()
        {
            var ray = new Ray(eye.position, eye.forward);
            ScanForTarget(ray);

            if (showDebugRay)
            {
                float len = CurrentTarget != null ? CurrentHit.distance : interactDistance;
                Color c = HasInteractable ? Color.green
                        : CurrentTarget != null ? Color.yellow
                        : Color.gray;
                Debug.DrawRay(ray.origin, ray.direction * len, c);
            }

            if (Input.GetKeyDown(interactKey))
            {
                if (CurrentInteractable != null)
                {
                    CurrentInteractable.Interact(gameObject);
                    if (logOnInteract)
                        Debug.Log($"[SAO] Interacted with '{CurrentTarget.name}' at {CurrentHit.distance:0.00} m.", CurrentTarget);
                }
                else if (logOnInteract)
                {
                    Debug.Log(CurrentTarget != null
                        ? $"[SAO] '{CurrentTarget.name}' is not interactable."
                        : "[SAO] Interact: nothing in reach.");
                }
            }
        }

        private void ScanForTarget(Ray ray)
        {
            CurrentTarget = null;
            CurrentInteractable = null;

            // Triggers included so future trigger-collider interactables
            // (door zones, talk radii) register too.
            int count = Physics.RaycastNonAlloc(ray, hitBuffer, interactDistance, interactMask,
                                                QueryTriggerInteraction.Collide);

            // RaycastNonAlloc results are unsorted: pick the nearest hit that
            // is not part of the player rig.
            float best = float.MaxValue;
            for (int i = 0; i < count; i++)
            {
                RaycastHit h = hitBuffer[i];
                if (h.collider == null) continue;
                if (h.collider.transform.IsChildOf(transform)) continue;   // own rig
                if (h.distance >= best) continue;

                best = h.distance;
                CurrentTarget = h.collider;
                CurrentHit = h;
            }

            if (CurrentTarget != null)
                CurrentInteractable = CurrentTarget.GetComponentInParent<IInteractable>();
        }
    }
}
