using UnityEngine;

namespace SAO.Interaction
{
    /// <summary>
    /// Smallest possible IInteractable: a sign that logs when read. Lives on
    /// the generated Debug_Interactable_Sign in the inn so the whole
    /// look -> prompt -> press E -> Interact() loop is testable end to end.
    /// A real readable-sign UI (parchment panel etc.) replaces the log later.
    /// </summary>
    public class DebugSignInteractable : MonoBehaviour, IInteractable
    {
        [Tooltip("Full prompt line the HUD shows while this sign is targeted.")]
        [SerializeField] private string promptText = "Press E - Read Sign";

        public string PromptText => promptText;

        public void Interact(GameObject interactor)
        {
            string who = interactor != null ? interactor.name : "unknown";
            Debug.Log($"[Interaction] Debug sign interacted by {who}", this);
        }
    }
}
