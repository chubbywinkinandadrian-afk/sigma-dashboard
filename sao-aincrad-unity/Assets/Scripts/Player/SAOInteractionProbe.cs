using UnityEngine;

namespace SAO.Player
{
    /// <summary>
    /// Minimal first-person interaction probe: raycasts from the center of the
    /// player camera every frame and remembers what is under the crosshair.
    /// Pressing the interact key only logs the target's name for now.
    ///
    /// This is deliberately NOT an interaction system — it is the sensing
    /// foundation the future doors / NPCs / signs / loot will hang off of:
    /// those systems should read <see cref="CurrentTarget"/> instead of
    /// casting their own rays.
    ///
    /// Setup: attach to the same GameObject as FPSController. Like the
    /// controller, it finds the child camera on Awake.
    /// </summary>
    public class SAOInteractionProbe : MonoBehaviour
    {
        [Header("Probe")]
        [Tooltip("How far ahead (meters) the player can reach things.")]
        public float interactDistance = 3f;
        [Tooltip("Layers the probe can hit. Defaults to everything except Ignore Raycast.")]
        public LayerMask interactMask = Physics.DefaultRaycastLayers;
        [Tooltip("Key that 'uses' whatever is under the crosshair (just logs it, for now).")]
        public KeyCode interactKey = KeyCode.E;

        [Header("Debug")]
        [Tooltip("Draw the probe ray in the Scene view (green = hit, gray = miss).")]
        public bool showDebugRay = true;
        [Tooltip("Log the target's name to the console when the interact key is pressed.")]
        public bool logOnInteract = true;

        /// <summary>Collider currently under the crosshair, or null. Future
        /// interaction systems read this instead of raycasting again.</summary>
        public Collider CurrentTarget { get; private set; }

        /// <summary>Full hit info for CurrentTarget. Only meaningful while
        /// CurrentTarget is non-null.</summary>
        public RaycastHit CurrentHit { get; private set; }

        private Transform eye;

        private void Awake()
        {
            // Same convention as FPSController: the rig's camera is a child.
            var cam = GetComponentInChildren<Camera>();
            eye = cam != null ? cam.transform : transform;
            if (cam == null)
                Debug.LogWarning("[SAO] SAOInteractionProbe found no child camera; probing from the player root instead.", this);
        }

        private void Update()
        {
            var ray = new Ray(eye.position, eye.forward);

            // QueryTriggerInteraction.Collide so future trigger-collider
            // interactables (door zones, NPC talk radii) are detectable too.
            // The ray starts inside the player's own CharacterController, so
            // it cannot hit it (raycasts never hit backfaces / from inside).
            if (Physics.Raycast(ray, out RaycastHit hit, interactDistance, interactMask,
                                QueryTriggerInteraction.Collide))
            {
                CurrentTarget = hit.collider;
                CurrentHit = hit;
            }
            else
            {
                CurrentTarget = null;
            }

            if (showDebugRay)
            {
                float len = CurrentTarget != null ? CurrentHit.distance : interactDistance;
                Debug.DrawRay(ray.origin, ray.direction * len,
                              CurrentTarget != null ? Color.green : Color.gray);
            }

            if (logOnInteract && Input.GetKeyDown(interactKey))
            {
                if (CurrentTarget != null)
                    Debug.Log($"[SAO] Interact: '{CurrentTarget.name}' at {CurrentHit.distance:0.00} m.", CurrentTarget);
                else
                    Debug.Log("[SAO] Interact: nothing in reach.");
            }
        }
    }
}
