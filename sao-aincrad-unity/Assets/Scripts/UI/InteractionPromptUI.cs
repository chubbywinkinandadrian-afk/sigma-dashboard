using UnityEngine;
using UnityEngine.UI;
using SAO.Player;

namespace SAO.UI
{
    /// <summary>
    /// Small center-bottom prompt driven by the player's SAOInteractionProbe:
    /// shows the targeted interactable's PromptText ("Press E - Read Sign"),
    /// hides when nothing usable is under the crosshair.
    ///
    /// The scene builder wires the references; anything left empty is
    /// auto-found on Awake (same pattern as StaminaBar). Visibility toggles
    /// via CanvasGroup alpha so no layout rebuilds happen per frame.
    /// </summary>
    public class InteractionPromptUI : MonoBehaviour
    {
        [Tooltip("Probe to read. Auto-found in the scene if left empty.")]
        [SerializeField] private SAOInteractionProbe probe;
        [Tooltip("Label that shows the interactable's prompt text.")]
        [SerializeField] private Text label;
        [Tooltip("Group used to show/hide the whole prompt (alpha only).")]
        [SerializeField] private CanvasGroup canvasGroup;

        private void Awake()
        {
            if (probe == null) probe = FindObjectOfType<SAOInteractionProbe>();
            if (canvasGroup == null) canvasGroup = GetComponent<CanvasGroup>();
            if (label == null) label = GetComponentInChildren<Text>(true);

            if (probe == null)
                Debug.LogWarning("[SAO] InteractionPromptUI found no SAOInteractionProbe in the scene.", this);

            SetVisible(false);   // hidden until something is targeted
        }

        private void LateUpdate()
        {
            bool show = probe != null && probe.HasInteractable;
            if (show && label != null) label.text = probe.CurrentPrompt;
            SetVisible(show);
        }

        private void SetVisible(bool visible)
        {
            if (canvasGroup != null)
            {
                canvasGroup.alpha = visible ? 1f : 0f;
                // The prompt is read-only chrome — never block clicks.
                canvasGroup.blocksRaycasts = false;
                canvasGroup.interactable = false;
            }
            else if (label != null)
            {
                label.enabled = visible;
            }
        }
    }
}
