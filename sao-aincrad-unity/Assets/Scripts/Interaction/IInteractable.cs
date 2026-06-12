using UnityEngine;

namespace SAO.Interaction
{
    /// <summary>
    /// Contract for anything the player can use with the interact key.
    ///
    /// Implement it on a MonoBehaviour on (or above) the object's collider —
    /// SAOInteractionProbe finds it with GetComponentInParent, so a single
    /// component on a prop root covers all of its child colliders.
    ///
    /// PromptText is the full HUD line (e.g. "Press E - Read Sign");
    /// Interact receives the player object so implementations can react to
    /// who used them without a lookup.
    /// </summary>
    public interface IInteractable
    {
        string PromptText { get; }
        void Interact(GameObject interactor);
    }
}
