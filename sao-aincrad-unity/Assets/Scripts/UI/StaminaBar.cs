using UnityEngine;
using UnityEngine.UI;
using SAO.Player;

namespace SAO.UI
{
    /// <summary>
    /// Minimal HUD stamina bar driven by <see cref="FPSController"/>.
    /// Scales a fill rect (no sprite/fill-mode dependencies), tints red while
    /// exhausted, and fades out when stamina is full so the screen stays as
    /// clean as the show's UI.
    ///
    /// Built automatically by  Tools > SAO > 3. Build FPS Player Rig.
    /// Manual setup: background Image with a stretched child "Fill" Image
    /// whose RectTransform pivot.x = 0, then assign both here.
    /// </summary>
    public class StaminaBar : MonoBehaviour
    {
        [Header("References")]
        [Tooltip("Auto-found in the scene if left empty.")]
        [SerializeField] private FPSController controller;
        [Tooltip("RectTransform scaled on X to show the fill. Pivot.x must be 0.")]
        [SerializeField] private RectTransform fillRect;
        [SerializeField] private Image fillImage;
        [Tooltip("Optional. Used to fade the whole bar when stamina is full.")]
        [SerializeField] private CanvasGroup canvasGroup;

        [Header("Style")]
        [SerializeField] private Color normalColor = new Color(1f, 0.83f, 0.48f);      // warm amber
        [SerializeField] private Color exhaustedColor = new Color(0.88f, 0.32f, 0.30f); // alert red
        [SerializeField] private float fadeSpeed = 4f;

        private void Start()
        {
            if (controller == null)
                controller = FindObjectOfType<FPSController>();

            if (controller == null)
                Debug.LogWarning("[StaminaBar] No FPSController found in scene; bar will not update.");
        }

        private void Update()
        {
            if (controller == null || fillRect == null)
                return;

            float s = controller.Stamina01;

            fillRect.localScale = new Vector3(s, 1f, 1f);

            if (fillImage != null)
                fillImage.color = controller.IsExhausted ? exhaustedColor : normalColor;

            if (canvasGroup != null)
            {
                // Visible while spending/recovering; invisible at full.
                float targetAlpha = (s >= 0.999f && !controller.IsExhausted) ? 0f : 1f;
                canvasGroup.alpha = Mathf.MoveTowards(canvasGroup.alpha, targetAlpha,
                                                      fadeSpeed * Time.deltaTime);
            }
        }
    }
}
