using System;
using System.Collections;
using System.Collections.Generic;
using FlowFactory.Core;
using UnityEngine;
using UnityEngine.UI;

namespace FlowFactory
{
    /// <summary>
    /// All screens (menu, level select, in-game HUD, success card, settings), built from code on one
    /// canvas inside the safe area. Contains no game rules: it only raises events and shows what it is told.
    /// </summary>
    public sealed class GameUIController : MonoBehaviour
    {
        public event Action PlayPressed;
        public event Action LevelsPressed;
        public event Action SettingsPressed;
        public event Action MenuPressed;
        public event Action<int> LevelChosen;
        public event Action RunPressed;
        public event Action ResetPressed;
        public event Action BackPressed;
        public event Action NextPressed;
        public event Action ReplayPressed;
        public event Action SoundToggled;
        public event Action VolumeCycled;
        public event Action FpsToggled;
        public event Action ProgressResetConfirmed;
        /// <summary>Raised for every button press so the app can play a click.</summary>
        public event Action AnyButton;

        private RectTransform safeRoot;
        private GameObject menuScreen;
        private GameObject levelScreen;
        private GameObject hudScreen;
        private GameObject settingsScreen;
        private GameObject successOverlay;

        private RectTransform levelGrid;
        private Text hudTitle;
        private Text hudHint;
        private Button runButton;
        private Button hudBackButton;
        private Button hudResetButton;
        private GameObject toast;
        private Text toastText;
        private float toastHideAt;

        private Text successTitle;
        private Text successBody;
        private Button nextButton;

        private Button soundButton;
        private Button volumeButton;
        private Button fpsButton;
        private Button resetProgressButton;
        private bool resetArmed;

        private bool pulseRun;

        public bool OverlayOpen
        {
            get { return successOverlay != null && successOverlay.activeSelf; }
        }

        // ---------------------------------------------------------------- build

        public void Build()
        {
            var canvasObject = new GameObject("UI", typeof(RectTransform));
            canvasObject.transform.SetParent(transform, false);
            var canvas = canvasObject.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;
            var scaler = canvasObject.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080f, 1920f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;
            canvasObject.AddComponent<GraphicRaycaster>();

            safeRoot = Ui.NewRect("SafeArea", canvasObject.transform);
            Ui.Stretch(safeRoot);
            safeRoot.gameObject.AddComponent<SafeAreaFitter>();

            BuildMenu();
            BuildLevelSelect();
            BuildHud();
            BuildSettings();
            BuildSuccess();
            HideAll();
        }

        private Button Btn(string name, Transform parent, string text, Color fill, int size, Action onClick, Action raise)
        {
            return Ui.NewButton(name, parent, text, fill, size, () =>
            {
                if (AnyButton != null) AnyButton();
                if (onClick != null) onClick();
                if (raise != null) raise();
            });
        }

        private GameObject NewScreen(string name, Color? background)
        {
            RectTransform rect = Ui.NewRect(name, safeRoot);
            Ui.Stretch(rect);
            if (background.HasValue)
            {
                // Backgrounds are drawn on the full canvas, not only inside the safe area.
                Image bg = Ui.NewImage("Background", rect, background.Value);
                bg.raycastTarget = true;
                RectTransform bgRect = bg.rectTransform;
                bgRect.anchorMin = new Vector2(-1f, -1f);
                bgRect.anchorMax = new Vector2(2f, 2f);
                bgRect.offsetMin = Vector2.zero;
                bgRect.offsetMax = Vector2.zero;
            }
            return rect.gameObject;
        }

        private void BuildMenu()
        {
            menuScreen = NewScreen("Menu", new Color(Palette.Background.r, Palette.Background.g, Palette.Background.b, 0.97f));
            Transform t = menuScreen.transform;

            Text title = Ui.NewLabel("Title", t, "FLOW\nFACTORY 3D", 150, Ui.TextColor);
            Ui.PlaceCentered(title.rectTransform, new Vector2(0.5f, 0.8f), new Vector2(900f, 420f), Vector2.zero);

            Text tag = Ui.NewLabel("Tagline", t, "Fix the belts. Send the parcels.", 46, Ui.TextDim, TextAnchor.MiddleCenter, FontStyle.Normal);
            Ui.PlaceCentered(tag.rectTransform, new Vector2(0.5f, 0.66f), new Vector2(900f, 90f), Vector2.zero);

            Button play = Btn("Play", t, "PLAY", Ui.Primary, 72, null, () => { if (PlayPressed != null) PlayPressed(); });
            Ui.PlaceCentered((RectTransform)play.transform, new Vector2(0.5f, 0.48f), new Vector2(720f, 190f), Vector2.zero);

            Button levels = Btn("Levels", t, "LEVELS", Ui.Secondary, 58, null, () => { if (LevelsPressed != null) LevelsPressed(); });
            Ui.PlaceCentered((RectTransform)levels.transform, new Vector2(0.5f, 0.48f), new Vector2(720f, 160f), new Vector2(0f, -230f));

            Button settings = Btn("Settings", t, "SETTINGS", Ui.Secondary, 58, null, () => { if (SettingsPressed != null) SettingsPressed(); });
            Ui.PlaceCentered((RectTransform)settings.transform, new Vector2(0.5f, 0.48f), new Vector2(720f, 160f), new Vector2(0f, -430f));

            Text version = Ui.NewLabel("Version", t, "v0.1 prototype", 34, Ui.TextDim, TextAnchor.MiddleCenter, FontStyle.Normal);
            Ui.PlaceCentered(version.rectTransform, new Vector2(0.5f, 0.04f), new Vector2(600f, 60f), Vector2.zero);
        }

        private void BuildLevelSelect()
        {
            levelScreen = NewScreen("LevelSelect", new Color(Palette.Background.r, Palette.Background.g, Palette.Background.b, 0.97f));
            Transform t = levelScreen.transform;

            Text title = Ui.NewLabel("Title", t, "SELECT LEVEL", 84, Ui.TextColor);
            Ui.PlaceCentered(title.rectTransform, new Vector2(0.5f, 0.92f), new Vector2(900f, 140f), Vector2.zero);

            levelGrid = Ui.NewRect("Grid", t);
            Ui.PlaceCentered(levelGrid, new Vector2(0.5f, 0.52f), new Vector2(900f, 1200f), Vector2.zero);

            Button back = Btn("Back", t, "BACK", Ui.Secondary, 56, null, () => { if (MenuPressed != null) MenuPressed(); });
            Ui.PlaceCentered((RectTransform)back.transform, new Vector2(0.5f, 0.06f), new Vector2(520f, 150f), Vector2.zero);
        }

        private void BuildHud()
        {
            hudScreen = NewScreen("Hud", null);
            Transform t = hudScreen.transform;

            hudBackButton = Btn("Back", t, "<", Ui.Secondary, 80, null, () => { if (BackPressed != null) BackPressed(); });
            Ui.PlaceCentered((RectTransform)hudBackButton.transform, new Vector2(0f, 1f), new Vector2(140f, 140f), new Vector2(95f, -95f));

            hudResetButton = Btn("Reset", t, "RESET", Ui.Danger, 36, null, () => { if (ResetPressed != null) ResetPressed(); });
            Ui.PlaceCentered((RectTransform)hudResetButton.transform, new Vector2(1f, 1f), new Vector2(190f, 140f), new Vector2(-120f, -95f));

            hudTitle = Ui.NewLabel("Title", t, "", 58, Ui.TextColor);
            Ui.PlaceCentered(hudTitle.rectTransform, new Vector2(0.5f, 1f), new Vector2(520f, 140f), new Vector2(0f, -95f));

            hudHint = Ui.NewLabel("Hint", t, "", 44, new Color(1f, 0.93f, 0.55f));
            Ui.PlaceCentered(hudHint.rectTransform, new Vector2(0.5f, 1f), new Vector2(940f, 130f), new Vector2(0f, -250f));

            runButton = Btn("Run", t, "RUN", Ui.Primary, 84, null, () => { if (RunPressed != null) RunPressed(); });
            Ui.PlaceCentered((RectTransform)runButton.transform, new Vector2(0.5f, 0f), new Vector2(640f, 180f), new Vector2(0f, 170f));

            Image toastBg = Ui.NewImage("Toast", t, new Color(0.05f, 0.07f, 0.12f, 0.92f));
            Ui.PlaceCentered(toastBg.rectTransform, new Vector2(0.5f, 0f), new Vector2(920f, 140f), new Vector2(0f, 380f));
            toastText = Ui.NewLabel("Text", toastBg.transform, "", 46, Ui.TextColor);
            Ui.Stretch(toastText.rectTransform);
            toastText.rectTransform.offsetMin = new Vector2(20f, 10f);
            toastText.rectTransform.offsetMax = new Vector2(-20f, -10f);
            toast = toastBg.gameObject;
        }

        private void BuildSettings()
        {
            settingsScreen = NewScreen("Settings", new Color(Palette.Background.r, Palette.Background.g, Palette.Background.b, 0.97f));
            Transform t = settingsScreen.transform;

            Text title = Ui.NewLabel("Title", t, "SETTINGS", 84, Ui.TextColor);
            Ui.PlaceCentered(title.rectTransform, new Vector2(0.5f, 0.88f), new Vector2(900f, 140f), Vector2.zero);

            soundButton = Btn("Sound", t, "", Ui.Secondary, 54, null, () => { if (SoundToggled != null) SoundToggled(); });
            Ui.PlaceCentered((RectTransform)soundButton.transform, new Vector2(0.5f, 0.7f), new Vector2(760f, 160f), Vector2.zero);

            volumeButton = Btn("Volume", t, "", Ui.Secondary, 54, null, () => { if (VolumeCycled != null) VolumeCycled(); });
            Ui.PlaceCentered((RectTransform)volumeButton.transform, new Vector2(0.5f, 0.7f), new Vector2(760f, 160f), new Vector2(0f, -200f));

            fpsButton = Btn("Fps", t, "", Ui.Secondary, 46, null, () => { if (FpsToggled != null) FpsToggled(); });
            Ui.PlaceCentered((RectTransform)fpsButton.transform, new Vector2(0.5f, 0.7f), new Vector2(760f, 140f), new Vector2(0f, -400f));

            resetProgressButton = Btn("ResetProgress", t, "RESET PROGRESS", Ui.Danger, 46, OnResetProgressPressed, null);
            Ui.PlaceCentered((RectTransform)resetProgressButton.transform, new Vector2(0.5f, 0.7f), new Vector2(760f, 140f), new Vector2(0f, -590f));

            Button back = Btn("Back", t, "BACK", Ui.Secondary, 56, null, () => { if (MenuPressed != null) MenuPressed(); });
            Ui.PlaceCentered((RectTransform)back.transform, new Vector2(0.5f, 0.08f), new Vector2(520f, 150f), Vector2.zero);
        }

        private void BuildSuccess()
        {
            successOverlay = NewScreen("Success", new Color(0f, 0f, 0f, 0.55f));
            Transform t = successOverlay.transform;

            Image card = Ui.NewImage("Card", t, Ui.Panel);
            Ui.PlaceCentered(card.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(900f, 880f), Vector2.zero);

            successTitle = Ui.NewLabel("Title", card.transform, "DELIVERED!", 100, new Color(0.55f, 1f, 0.65f));
            Ui.PlaceCentered(successTitle.rectTransform, new Vector2(0.5f, 1f), new Vector2(800f, 180f), new Vector2(0f, -140f));

            successBody = Ui.NewLabel("Body", card.transform, "", 48, Ui.TextColor, TextAnchor.MiddleCenter, FontStyle.Normal);
            Ui.PlaceCentered(successBody.rectTransform, new Vector2(0.5f, 1f), new Vector2(780f, 190f), new Vector2(0f, -330f));

            nextButton = Btn("Next", card.transform, "NEXT LEVEL", Ui.Primary, 64, null, () => { if (NextPressed != null) NextPressed(); });
            Ui.PlaceCentered((RectTransform)nextButton.transform, new Vector2(0.5f, 0f), new Vector2(700f, 160f), new Vector2(0f, 450f));

            Button replay = Btn("Replay", card.transform, "REPLAY", Ui.Secondary, 48, null, () => { if (ReplayPressed != null) ReplayPressed(); });
            Ui.PlaceCentered((RectTransform)replay.transform, new Vector2(0.25f, 0f), new Vector2(380f, 130f), new Vector2(40f, 250f));

            Button levels = Btn("Levels", card.transform, "LEVELS", Ui.Secondary, 48, null, () => { if (LevelsPressed != null) LevelsPressed(); });
            Ui.PlaceCentered((RectTransform)levels.transform, new Vector2(0.75f, 0f), new Vector2(380f, 130f), new Vector2(-40f, 250f));
        }

        // ---------------------------------------------------------------- screens

        private void HideAll()
        {
            menuScreen.SetActive(false);
            levelScreen.SetActive(false);
            hudScreen.SetActive(false);
            settingsScreen.SetActive(false);
            successOverlay.SetActive(false);
            pulseRun = false;
        }

        public void ShowMenu()
        {
            HideAll();
            menuScreen.SetActive(true);
        }

        public void ShowLevelSelect(IList<LevelData> levels, ProgressData progress)
        {
            HideAll();
            levelScreen.SetActive(true);

            foreach (Transform child in levelGrid)
            {
                Destroy(child.gameObject);
            }

            const int columns = 3;
            const float cell = 280f;
            int rows = (levels.Count + columns - 1) / columns;
            for (int i = 0; i < levels.Count; i++)
            {
                int id = levels[i].id;
                int col = i % columns;
                int row = i / columns;
                bool unlocked = progress.IsUnlocked(id);
                bool done = progress.IsCompleted(id);

                Color fill = !unlocked ? Ui.Disabled : done ? Ui.Primary : Ui.Secondary;
                Button button = Btn("Level" + id, levelGrid, id.ToString(), fill, 96, null, null);
                Ui.PlaceCentered((RectTransform)button.transform, new Vector2(0.5f, 0.5f), new Vector2(250f, 250f),
                    new Vector2((col - (columns - 1) * 0.5f) * cell, ((rows - 1) * 0.5f - row) * cell));
                button.interactable = unlocked;

                // The caption repeats the colour so progress is readable without telling colours apart.
                Text caption = Ui.NewLabel("Caption", button.transform, !unlocked ? "LOCKED" : done ? "DONE" : "PLAY", 34, Ui.TextColor);
                Ui.PlaceCentered(caption.rectTransform, new Vector2(0.5f, 0f), new Vector2(230f, 60f), new Vector2(0f, 45f));
                button.GetComponentInChildren<Text>().rectTransform.offsetMax = new Vector2(-12f, -45f);

                int captured = id;
                button.onClick.AddListener(() =>
                {
                    if (LevelChosen != null) LevelChosen(captured);
                });
            }
        }

        public void ShowSettings(ProgressData progress, bool fpsOn)
        {
            HideAll();
            settingsScreen.SetActive(true);
            RefreshSettings(progress, fpsOn);
        }

        public void RefreshSettings(ProgressData progress, bool fpsOn)
        {
            Ui.SetText(soundButton, progress.SoundOn ? "Sound: ON" : "Sound: OFF");
            string[] names = { "Low", "Medium", "High" };
            Ui.SetText(volumeButton, "Volume: " + names[Mathf.Clamp(progress.VolumeStep, 0, 2)]);
            volumeButton.interactable = progress.SoundOn;
            fpsButton.gameObject.SetActive(FpsCounter.Available);
            Ui.SetText(fpsButton, fpsOn ? "FPS display: ON" : "FPS display: OFF");
            resetArmed = false;
            Ui.SetText(resetProgressButton, "RESET PROGRESS");
        }

        private void OnResetProgressPressed()
        {
            if (!resetArmed)
            {
                resetArmed = true;
                Ui.SetText(resetProgressButton, "TAP AGAIN TO CONFIRM");
                StartCoroutine(DisarmReset());
                return;
            }
            resetArmed = false;
            Ui.SetText(resetProgressButton, "PROGRESS RESET");
            if (ProgressResetConfirmed != null) ProgressResetConfirmed();
        }

        private IEnumerator DisarmReset()
        {
            yield return new WaitForSecondsRealtime(3f);
            if (resetArmed)
            {
                resetArmed = false;
                Ui.SetText(resetProgressButton, "RESET PROGRESS");
            }
        }

        public void ShowHud(LevelData level)
        {
            HideAll();
            hudScreen.SetActive(true);
            toast.SetActive(false);
            hudTitle.text = "LEVEL " + level.id;
            hudHint.text = level.hint ?? "";
            runButton.interactable = true;
        }

        public void SetHint(string text)
        {
            hudHint.text = text ?? "";
        }

        public void SetRunPulse(bool pulse)
        {
            pulseRun = pulse;
            if (!pulse) ((RectTransform)runButton.transform).localScale = Vector3.one;
        }

        public void SetRunInteractable(bool interactable)
        {
            runButton.interactable = interactable;
        }

        public void ShowToast(string message, float seconds = 2.4f)
        {
            toastText.text = message;
            toast.SetActive(true);
            toastHideAt = Time.unscaledTime + seconds;
        }

        public void HideToast()
        {
            toast.SetActive(false);
        }

        public void ShowSuccess(LevelData level, bool hasNext, bool lastLevel)
        {
            successOverlay.SetActive(true);
            pulseRun = false;
            successTitle.text = lastLevel ? "FACTORY AWAKE!" : "DELIVERED!";
            successBody.text = lastLevel
                ? "All 12 levels complete.\nThanks for playing!"
                : "Level " + level.id + " complete.\n" + (hasNext ? "The next level is open." : "");
            nextButton.gameObject.SetActive(hasNext);
        }

        public void HideSuccess()
        {
            successOverlay.SetActive(false);
        }

        /// <summary>True if a tap here would land on a HUD button or an open overlay, so the board must ignore it.</summary>
        public bool IsBlockingPoint(Vector2 screenPosition)
        {
            if (OverlayOpen) return true;
            if (!hudScreen.activeSelf) return false;
            return Contains(hudBackButton, screenPosition) || Contains(hudResetButton, screenPosition) || Contains(runButton, screenPosition);
        }

        private static bool Contains(Button button, Vector2 point)
        {
            return RectTransformUtility.RectangleContainsScreenPoint((RectTransform)button.transform, point, null);
        }

        private void Update()
        {
            if (toast != null && toast.activeSelf && Time.unscaledTime > toastHideAt)
            {
                toast.SetActive(false);
            }
            if (pulseRun && hudScreen.activeSelf)
            {
                float s = 1f + 0.06f * Mathf.Sin(Time.unscaledTime * 6f);
                ((RectTransform)runButton.transform).localScale = new Vector3(s, s, 1f);
            }
        }
    }
}
