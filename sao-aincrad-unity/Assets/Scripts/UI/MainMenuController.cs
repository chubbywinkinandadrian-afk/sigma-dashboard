using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace SAO.UI
{
    /// <summary>
    /// Main menu logic: Start Game / Load Game / Options / Quit.
    ///
    /// Button references are wired in code on Awake (the scene builder assigns
    /// them, or you can drag them in the inspector). The public On* methods can
    /// also be hooked straight into Button OnClick events if you prefer.
    ///
    /// "Load Game" is a placeholder until the save system exists: the button is
    /// only interactable if a save flag is present in PlayerPrefs.
    /// </summary>
    public class MainMenuController : MonoBehaviour
    {
        /// <summary>PlayerPrefs key the future save system should write.</summary>
        public const string SaveExistsKey = "sao.save.exists";

        [Header("Scene")]
        [Tooltip("Scene loaded by Start Game. Must be added to File > Build Settings.")]
        public string gameSceneName = "TownOfBeginnings";

        [Header("UI References")]
        public Button startButton;
        public Button loadButton;
        public Button optionsButton;
        public Button quitButton;
        [Tooltip("Panel toggled by the Options button. Inactive by default.")]
        public GameObject optionsPanel;
        [Tooltip("Back button inside the options panel.")]
        public Button optionsBackButton;

        private void Awake()
        {
            // The menu must own the cursor (the FPS controller locks it in-game).
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
            Time.timeScale = 1f;    // safety if we ever arrive from a paused state

            if (startButton != null) startButton.onClick.AddListener(OnStartGame);
            if (loadButton != null) loadButton.onClick.AddListener(OnLoadGame);
            if (optionsButton != null) optionsButton.onClick.AddListener(OnOpenOptions);
            if (quitButton != null) quitButton.onClick.AddListener(OnQuit);
            if (optionsBackButton != null) optionsBackButton.onClick.AddListener(OnCloseOptions);
        }

        private void Start()
        {
            if (optionsPanel != null)
                optionsPanel.SetActive(false);

            // No save system yet — grey the button out until one writes the key.
            if (loadButton != null)
                loadButton.interactable = PlayerPrefs.HasKey(SaveExistsKey);
        }

        private void Update()
        {
            // Escape backs out of the options panel.
            if (optionsPanel != null && optionsPanel.activeSelf && Input.GetKeyDown(KeyCode.Escape))
                OnCloseOptions();
        }

        // ------------------------------------------------------------------ //
        //  Button handlers (public so they can also be wired via OnClick)
        // ------------------------------------------------------------------ //

        public void OnStartGame()
        {
            if (!Application.CanStreamedLevelBeLoaded(gameSceneName))
            {
                Debug.LogError($"[MainMenu] Scene '{gameSceneName}' is not in Build Settings. " +
                               "Add it via File > Build Settings > Add Open Scenes.");
                return;
            }
            SceneManager.LoadScene(gameSceneName);
        }

        public void OnLoadGame()
        {
            // TODO: replace with real save-slot loading once the save system exists.
            // For now a "load" simply enters the game scene.
            Debug.Log("[MainMenu] Load Game pressed — save system not implemented yet, starting fresh.");
            OnStartGame();
        }

        public void OnOpenOptions()
        {
            if (optionsPanel != null)
                optionsPanel.SetActive(true);
        }

        public void OnCloseOptions()
        {
            if (optionsPanel != null)
                optionsPanel.SetActive(false);
        }

        public void OnQuit()
        {
#if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
#else
            Application.Quit();
#endif
        }
    }
}
