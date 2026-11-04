using System;
using System.Collections;
using System.Collections.Generic;
using FlowFactory.Core;
using UnityEngine;
using UnityEngine.UI;

namespace FlowFactory
{
    /// <summary>
    /// The game screens (menu, level select, in-game HUD, success card, settings), built from code on one
    /// canvas inside the safe area. Contains no game rules: it only raises events and shows what it is told.
    /// Money-related screens live in <see cref="MonetizationUi"/>.
    /// </summary>
    public sealed class GameUIController : MonoBehaviour
    {
        public const int LevelsPerWorld = 12;

        public event Action PlayPressed;
        public event Action LevelsPressed;
        public event Action SettingsPressed;
        public event Action ShopPressed;
        public event Action MenuPressed;
        public event Action<int> LevelChosen;
        public event Action RunPressed;
        public event Action HintPressed;
        public event Action ResetPressed;
        public event Action BackPressed;
        public event Action NextPressed;
        public event Action ReplayPressed;
        public event Action DoubleCoinsPressed;
        public event Action SoundToggled;
        public event Action VolumeCycled;
        public event Action FpsToggled;
        public event Action FrameRateToggled;
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
        private Text worldLabel;
        private Button prevWorld;
        private Button nextWorld;
        private int worldPage;
        private IList<LevelData> levelList;
        private ProgressData levelProgress;

        private Text hudTitle;
        private Text hudHint;
        private Button runButton;
        private Button hintButton;
        private Text hintCost;
        private Button hudBackButton;
        private Button hudResetButton;
        private GameObject toast;
        private Text toastText;
        private float toastHideAt;

        private readonly List<Text> coinLabels = new List<Text>();
        private Image shopDot;

        private Text successTitle;
        private Text successBody;
        private Button nextButton;
        private Button doubleButton;
        private readonly Image[] successStars = new Image[3];

        private Button soundButton;
        private Button volumeButton;
        private Button fpsButton;
        private Button frameRateButton;
        private Button resetProgressButton;
        private bool resetArmed;

        private bool pulseRun;

        public RectTransform SafeRoot
        {
            get { return safeRoot; }
        }

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
            rect.gameObject.AddComponent<ScreenFx>();
            return rect.gameObject;
        }

        private static Color ScreenTint
        {
            get { return new Color(0.04f, 0.09f, 0.13f, 0.97f); }
        }

        private void BuildMenu()
        {
            // No opaque background: the 3D demo board shows through behind the title and buttons.
            menuScreen = NewScreen("Menu", null);
            Transform t = menuScreen.transform;

            Image shade = Ui.NewImage("ButtonShade", t, new Color(0.02f, 0.06f, 0.09f, 0.60f), false);
            shade.rectTransform.anchorMin = new Vector2(-1f, -1f);
            shade.rectTransform.anchorMax = new Vector2(2f, 0.40f);
            shade.rectTransform.offsetMin = Vector2.zero;
            shade.rectTransform.offsetMax = Vector2.zero;

            Text title = Ui.NewLabel("Title", t, "FLOW\n<color=#FFC85A>FACTORY</color> 3D", 120, Ui.TextColor);
            Ui.PlaceCentered(title.rectTransform, new Vector2(0.5f, 0.90f), new Vector2(900f, 300f), Vector2.zero);
            Ui.AddShadow(title, 8f, 0.55f);

            Text tag = Ui.NewLabel("Tagline", t, "Fix the belts. Send the parcels.", 44, Ui.TextDim, TextAnchor.MiddleCenter, FontStyle.Normal);
            Ui.PlaceCentered(tag.rectTransform, new Vector2(0.5f, 0.79f), new Vector2(900f, 80f), Vector2.zero);
            Ui.AddShadow(tag, 4f, 0.5f);

            coinLabels.Add(MonetizationUi.CreateCoinBadge(t, new Vector2(0f, 1f), new Vector2(180f, -70f), new Vector2(300f, 84f)));

            Button play = Btn("Play", t, "PLAY", Ui.Primary, 72, null, () => { if (PlayPressed != null) PlayPressed(); });
            Ui.PlaceCentered((RectTransform)play.transform, new Vector2(0.5f, 0.31f), new Vector2(720f, 175f), Vector2.zero);

            Button levels = Btn("Levels", t, "LEVELS", Ui.Secondary, 56, null, () => { if (LevelsPressed != null) LevelsPressed(); });
            Ui.PlaceCentered((RectTransform)levels.transform, new Vector2(0.5f, 0.31f), new Vector2(720f, 140f), new Vector2(0f, -205f));

            Button shop = Btn("Shop", t, "SHOP", new Color(0.85f, 0.50f, 0.15f), 50, null, () => { if (ShopPressed != null) ShopPressed(); });
            Ui.PlaceCentered((RectTransform)shop.transform, new Vector2(0.5f, 0.31f), new Vector2(350f, 140f), new Vector2(-185f, -375f));
            shopDot = Ui.NewImage("Dot", shop.transform, new Color(0.95f, 0.15f, 0.2f));
            shopDot.sprite = UiSprites.Circle;
            Ui.PlaceCentered(shopDot.rectTransform, new Vector2(1f, 1f), new Vector2(44f, 44f), new Vector2(-14f, -14f));

            Button settings = Btn("Settings", t, "SETTINGS", Ui.Secondary, 44, null, () => { if (SettingsPressed != null) SettingsPressed(); });
            Ui.PlaceCentered((RectTransform)settings.transform, new Vector2(0.5f, 0.31f), new Vector2(350f, 140f), new Vector2(185f, -375f));

            Text version = Ui.NewLabel("Version", t, "v0.2 prototype", 32, Ui.TextDim, TextAnchor.MiddleCenter, FontStyle.Normal);
            Ui.PlaceCentered(version.rectTransform, new Vector2(0.5f, 0.03f), new Vector2(600f, 50f), Vector2.zero);
        }

        private void BuildLevelSelect()
        {
            levelScreen = NewScreen("LevelSelect", ScreenTint);
            Transform t = levelScreen.transform;

            Text title = Ui.NewLabel("Title", t, "SELECT LEVEL", 84, Ui.TextColor);
            Ui.PlaceCentered(title.rectTransform, new Vector2(0.5f, 0.93f), new Vector2(900f, 130f), Vector2.zero);
            Ui.AddShadow(title, 6f, 0.5f);

            levelGrid = Ui.NewRect("Grid", t);
            Ui.PlaceCentered(levelGrid, new Vector2(0.5f, 0.54f), new Vector2(900f, 1200f), Vector2.zero);

            prevWorld = Btn("Prev", t, "PREV", Ui.Secondary, 40, () => ChangeWorld(-1), null);
            Ui.PlaceCentered((RectTransform)prevWorld.transform, new Vector2(0.5f, 0.155f), new Vector2(240f, 120f), new Vector2(-320f, 0f));
            nextWorld = Btn("Next", t, "NEXT", Ui.Secondary, 40, () => ChangeWorld(1), null);
            Ui.PlaceCentered((RectTransform)nextWorld.transform, new Vector2(0.5f, 0.155f), new Vector2(240f, 120f), new Vector2(320f, 0f));
            worldLabel = Ui.NewLabel("World", t, "WORLD 1", 54, new Color(1f, 0.85f, 0.4f));
            Ui.PlaceCentered(worldLabel.rectTransform, new Vector2(0.5f, 0.155f), new Vector2(380f, 110f), Vector2.zero);

            Button back = Btn("Back", t, "BACK", Ui.Secondary, 56, null, () => { if (MenuPressed != null) MenuPressed(); });
            Ui.PlaceCentered((RectTransform)back.transform, new Vector2(0.5f, 0.06f), new Vector2(520f, 140f), Vector2.zero);
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
            Ui.AddShadow(hudTitle, 5f, 0.5f);

            hudHint = Ui.NewLabel("Hint", t, "", 44, new Color(1f, 0.93f, 0.55f));
            Ui.PlaceCentered(hudHint.rectTransform, new Vector2(0.5f, 1f), new Vector2(940f, 120f), new Vector2(0f, -240f));
            Ui.AddShadow(hudHint, 4f, 0.5f);

            coinLabels.Add(MonetizationUi.CreateCoinBadge(t, new Vector2(0.5f, 1f), new Vector2(0f, -345f), new Vector2(320f, 72f)));

            // Hint button (left) and Run button (right) share the bottom row.
            hintButton = Btn("Hint", t, "HINT", new Color(0.78f, 0.55f, 0.15f), 46, null, () => { if (HintPressed != null) HintPressed(); });
            Ui.PlaceCentered((RectTransform)hintButton.transform, new Vector2(0.5f, 0f), new Vector2(270f, 180f), new Vector2(-330f, 170f));
            hintButton.GetComponentInChildren<Text>().rectTransform.offsetMin = new Vector2(12f, 52f);
            Image hintCoin = Ui.NewImage("Coin", hintButton.transform, new Color(1f, 0.80f, 0.22f));
            hintCoin.sprite = UiSprites.Circle;
            Ui.PlaceCentered(hintCoin.rectTransform, new Vector2(0.5f, 0f), new Vector2(40f, 40f), new Vector2(-34f, 40f));
            hintCost = Ui.NewLabel("Cost", hintButton.transform, EconomyConfig.HintCost.ToString(), 38, Ui.TextColor);
            Ui.PlaceCentered(hintCost.rectTransform, new Vector2(0.5f, 0f), new Vector2(110f, 56f), new Vector2(34f, 40f));

            runButton = Btn("Run", t, "RUN", Ui.Primary, 84, null, () => { if (RunPressed != null) RunPressed(); });
            Ui.PlaceCentered((RectTransform)runButton.transform, new Vector2(0.5f, 0f), new Vector2(560f, 180f), new Vector2(120f, 170f));
            Image runIcon = Ui.NewImage("Icon", runButton.transform, Color.white);
            runIcon.sprite = UiSprites.Triangle;
            Ui.PlaceCentered(runIcon.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(84f, 84f), new Vector2(-120f, 0f));
            runButton.GetComponentInChildren<Text>().rectTransform.offsetMin = new Vector2(70f, 8f);

            Image toastBg = Ui.NewImage("Toast", t, new Color(0.04f, 0.08f, 0.12f, 0.92f), true);
            Ui.PlaceCentered(toastBg.rectTransform, new Vector2(0.5f, 0f), new Vector2(920f, 140f), new Vector2(0f, 380f));
            toastText = Ui.NewLabel("Text", toastBg.transform, "", 46, Ui.TextColor);
            Ui.Stretch(toastText.rectTransform);
            toastText.rectTransform.offsetMin = new Vector2(20f, 10f);
            toastText.rectTransform.offsetMax = new Vector2(-20f, -10f);
            toast = toastBg.gameObject;
        }

        private void BuildSettings()
        {
            settingsScreen = NewScreen("Settings", ScreenTint);
            Transform t = settingsScreen.transform;

            Text title = Ui.NewLabel("Title", t, "SETTINGS", 84, Ui.TextColor);
            Ui.PlaceCentered(title.rectTransform, new Vector2(0.5f, 0.88f), new Vector2(900f, 140f), Vector2.zero);
            Ui.AddShadow(title, 6f, 0.5f);

            soundButton = Btn("Sound", t, "", Ui.Secondary, 54, null, () => { if (SoundToggled != null) SoundToggled(); });
            Ui.PlaceCentered((RectTransform)soundButton.transform, new Vector2(0.5f, 0.74f), new Vector2(760f, 150f), Vector2.zero);

            volumeButton = Btn("Volume", t, "", Ui.Secondary, 54, null, () => { if (VolumeCycled != null) VolumeCycled(); });
            Ui.PlaceCentered((RectTransform)volumeButton.transform, new Vector2(0.5f, 0.74f), new Vector2(760f, 150f), new Vector2(0f, -175f));

            frameRateButton = Btn("FrameRate", t, "", Ui.Secondary, 46, null, () => { if (FrameRateToggled != null) FrameRateToggled(); });
            Ui.PlaceCentered((RectTransform)frameRateButton.transform, new Vector2(0.5f, 0.74f), new Vector2(760f, 150f), new Vector2(0f, -350f));

            fpsButton = Btn("Fps", t, "", Ui.Secondary, 42, null, () => { if (FpsToggled != null) FpsToggled(); });
            Ui.PlaceCentered((RectTransform)fpsButton.transform, new Vector2(0.5f, 0.74f), new Vector2(760f, 120f), new Vector2(0f, -510f));

            resetProgressButton = Btn("ResetProgress", t, "RESET LEVELS", Ui.Danger, 44, OnResetProgressPressed, null);
            Ui.PlaceCentered((RectTransform)resetProgressButton.transform, new Vector2(0.5f, 0.74f), new Vector2(760f, 130f), new Vector2(0f, -655f));

            Text note = Ui.NewLabel("Note", t, "Ads and purchases in this build are TEST ONLY.\nNo real money is charged.", 32, Ui.TextDim, TextAnchor.MiddleCenter, FontStyle.Normal);
            Ui.PlaceCentered(note.rectTransform, new Vector2(0.5f, 0.2f), new Vector2(900f, 110f), Vector2.zero);

            Button back = Btn("Back", t, "BACK", Ui.Secondary, 56, null, () => { if (MenuPressed != null) MenuPressed(); });
            Ui.PlaceCentered((RectTransform)back.transform, new Vector2(0.5f, 0.08f), new Vector2(520f, 150f), Vector2.zero);
        }

        private void BuildSuccess()
        {
            successOverlay = NewScreen("Success", new Color(0f, 0f, 0f, 0.55f));
            Transform t = successOverlay.transform;

            Image card = Ui.NewImage("Card", t, Ui.Panel, true);
            Ui.AddShadow(card, 14f, 0.5f);
            Ui.PlaceCentered(card.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(900f, 960f), Vector2.zero);

            successTitle = Ui.NewLabel("Title", card.transform, "DELIVERED!", 100, new Color(0.55f, 1f, 0.65f));
            Ui.PlaceCentered(successTitle.rectTransform, new Vector2(0.5f, 1f), new Vector2(800f, 170f), new Vector2(0f, -115f));
            Ui.AddShadow(successTitle, 6f, 0.5f);

            for (int i = 0; i < 3; i++)
            {
                Image star = Ui.NewImage("Star" + i, card.transform, Color.white);
                star.sprite = UiSprites.Star;
                Ui.PlaceCentered(star.rectTransform, new Vector2(0.5f, 1f), new Vector2(150f, 150f), new Vector2((i - 1) * 170f, -290f));
                successStars[i] = star;
            }

            successBody = Ui.NewLabel("Body", card.transform, "", 44, Ui.TextColor, TextAnchor.MiddleCenter, FontStyle.Normal);
            Ui.PlaceCentered(successBody.rectTransform, new Vector2(0.5f, 1f), new Vector2(820f, 150f), new Vector2(0f, -455f));

            doubleButton = Btn("Double", card.transform, "", new Color(0.85f, 0.50f, 0.15f), 44, null, () => { if (DoubleCoinsPressed != null) DoubleCoinsPressed(); });
            Ui.PlaceCentered((RectTransform)doubleButton.transform, new Vector2(0.5f, 1f), new Vector2(740f, 125f), new Vector2(0f, -600f));

            nextButton = Btn("Next", card.transform, "NEXT LEVEL", Ui.Primary, 64, null, () => { if (NextPressed != null) NextPressed(); });
            Ui.PlaceCentered((RectTransform)nextButton.transform, new Vector2(0.5f, 1f), new Vector2(740f, 140f), new Vector2(0f, -745f));

            Button replay = Btn("Replay", card.transform, "REPLAY", Ui.Secondary, 48, null, () => { if (ReplayPressed != null) ReplayPressed(); });
            Ui.PlaceCentered((RectTransform)replay.transform, new Vector2(0.5f, 1f), new Vector2(360f, 120f), new Vector2(-190f, -895f));

            Button levels = Btn("Levels", card.transform, "LEVELS", Ui.Secondary, 48, null, () => { if (LevelsPressed != null) LevelsPressed(); });
            Ui.PlaceCentered((RectTransform)levels.transform, new Vector2(0.5f, 1f), new Vector2(360f, 120f), new Vector2(190f, -895f));
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

        public void SetShopBadge(bool visible)
        {
            if (shopDot != null) shopDot.gameObject.SetActive(visible);
        }

        public void SetCoins(int coins)
        {
            foreach (Text label in coinLabels)
            {
                label.text = coins.ToString();
            }
        }

        public void ShowLevelSelect(IList<LevelData> levels, ProgressData progress)
        {
            HideAll();
            levelScreen.SetActive(true);
            levelList = levels;
            levelProgress = progress;
            worldPage = Mathf.Clamp((progress.LastLevel - 1) / LevelsPerWorld, 0, WorldCount - 1);
            RebuildLevelGrid();
        }

        private int WorldCount
        {
            get { return Mathf.Max(1, (levelList.Count + LevelsPerWorld - 1) / LevelsPerWorld); }
        }

        private void ChangeWorld(int delta)
        {
            worldPage = Mathf.Clamp(worldPage + delta, 0, WorldCount - 1);
            RebuildLevelGrid();
        }

        private void RebuildLevelGrid()
        {
            foreach (Transform child in levelGrid)
            {
                Destroy(child.gameObject);
            }

            int first = worldPage * LevelsPerWorld;
            int last = Mathf.Min(first + LevelsPerWorld, levelList.Count);
            int worldStars = 0;
            for (int i = first; i < last; i++) worldStars += levelProgress.StarsFor(levelList[i].id);
            worldLabel.text = "WORLD " + (worldPage + 1) + "\n" + worldStars + "/" + ((last - first) * 3) + " stars";
            prevWorld.interactable = worldPage > 0;
            nextWorld.interactable = worldPage < WorldCount - 1;

            const int columns = 3;
            const float cell = 280f;
            int rows = (last - first + columns - 1) / columns;
            for (int i = first; i < last; i++)
            {
                int id = levelList[i].id;
                int local = i - first;
                int col = local % columns;
                int row = local / columns;
                bool unlocked = levelProgress.IsUnlocked(id);
                bool done = levelProgress.IsCompleted(id);

                Color fill = !unlocked ? Ui.Disabled : done ? Ui.Primary : Ui.Secondary;
                Button button = Btn("Level" + id, levelGrid, id.ToString(), fill, 96, null, null);
                Ui.PlaceCentered((RectTransform)button.transform, new Vector2(0.5f, 0.5f), new Vector2(250f, 250f),
                    new Vector2((col - (columns - 1) * 0.5f) * cell, ((rows - 1) * 0.5f - row) * cell));
                button.interactable = unlocked;
                button.GetComponentInChildren<Text>().rectTransform.offsetMax = new Vector2(-12f, -45f);

                if (!unlocked || !done)
                {
                    Text caption = Ui.NewLabel("Caption", button.transform, !unlocked ? "LOCKED" : "PLAY", 34, Ui.TextColor);
                    Ui.PlaceCentered(caption.rectTransform, new Vector2(0.5f, 0f), new Vector2(230f, 60f), new Vector2(0f, 45f));
                }
                else
                {
                    // Earned stars (gold) and missing stars (dim) under the number.
                    int stars = levelProgress.StarsFor(id);
                    for (int s = 0; s < 3; s++)
                    {
                        Image star = Ui.NewImage("Star" + s, button.transform, s < stars ? new Color(1f, 0.82f, 0.2f) : new Color(0f, 0f, 0f, 0.35f));
                        star.sprite = UiSprites.Star;
                        Ui.PlaceCentered(star.rectTransform, new Vector2(0.5f, 0f), new Vector2(62f, 62f), new Vector2((s - 1) * 66f, 46f));
                    }
                }

                int captured = id;
                button.onClick.AddListener(() =>
                {
                    if (LevelChosen != null) LevelChosen(captured);
                });
            }
        }

        public void ShowSettings(ProgressData progress, bool fpsOn, bool smooth60)
        {
            HideAll();
            settingsScreen.SetActive(true);
            RefreshSettings(progress, fpsOn, smooth60);
        }

        public void RefreshSettings(ProgressData progress, bool fpsOn, bool smooth60)
        {
            Ui.SetText(soundButton, progress.SoundOn ? "Sound: ON" : "Sound: OFF");
            string[] names = { "Low", "Medium", "High" };
            Ui.SetText(volumeButton, "Volume: " + names[Mathf.Clamp(progress.VolumeStep, 0, 2)]);
            volumeButton.interactable = progress.SoundOn;
            Ui.SetText(frameRateButton, smooth60 ? "Frame rate: 60 (smooth)" : "Frame rate: 30 (battery)");
            fpsButton.gameObject.SetActive(FpsCounter.Available);
            Ui.SetText(fpsButton, fpsOn ? "FPS display: ON" : "FPS display: OFF");
            resetArmed = false;
            Ui.SetText(resetProgressButton, "RESET LEVELS");
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
                Ui.SetText(resetProgressButton, "RESET LEVELS");
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
            hintButton.interactable = true;
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
            hintButton.interactable = interactable;
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

        public void ShowSuccess(LevelData level, bool hasNext, bool worldEnd, bool finalLevel, LevelReward reward, bool canDouble, string nudge)
        {
            successOverlay.SetActive(true);
            pulseRun = false;
            successTitle.text = worldEnd ? "FACTORY AWAKE!" : "DELIVERED!";

            string coins = "<color=#FFD24A>+" + reward.Coins + " coins</color>" + (reward.FirstClear ? "" : "  (replay)");
            string extra = finalLevel ? "All " + level.id + " levels complete!" : (string.IsNullOrEmpty(nudge) ? "" : nudge);
            successBody.text = coins + (extra.Length > 0 ? "\n" + extra : "");

            nextButton.gameObject.SetActive(hasNext);
            doubleButton.gameObject.SetActive(canDouble);
            doubleButton.interactable = true;
            Ui.SetFill(doubleButton, new Color(0.85f, 0.50f, 0.15f));
            Ui.SetText(doubleButton, "x2 COINS  (watch test ad)");

            StartCoroutine(PopStars(reward.Stars));
        }

        public void ShowDoubled(int coinsAdded)
        {
            doubleButton.interactable = false;
            Ui.SetFill(doubleButton, Ui.Disabled);
            Ui.SetText(doubleButton, "DOUBLED!  +" + coinsAdded);
        }

        private IEnumerator PopStars(int stars)
        {
            for (int i = 0; i < 3; i++)
            {
                successStars[i].color = i < stars ? new Color(1f, 0.82f, 0.2f) : new Color(1f, 1f, 1f, 0.18f);
                successStars[i].rectTransform.localScale = Vector3.zero;
            }
            for (int i = 0; i < 3; i++)
            {
                if (i >= stars)
                {
                    successStars[i].rectTransform.localScale = Vector3.one;
                    continue;
                }
                yield return new WaitForSecondsRealtime(0.22f);
                for (float t = 0f; t < 0.22f; t += Time.unscaledDeltaTime)
                {
                    float k = t / 0.22f;
                    float s = Mathf.Sin(k * Mathf.PI * 0.5f) * (1f + 0.25f * Mathf.Sin(k * Mathf.PI));
                    successStars[i].rectTransform.localScale = Vector3.one * s;
                    yield return null;
                }
                successStars[i].rectTransform.localScale = Vector3.one;
            }
        }

        public void HideSuccess()
        {
            StopAllCoroutines();
            successOverlay.SetActive(false);
        }

        /// <summary>True if a tap here would land on a HUD button or an open overlay, so the board must ignore it.</summary>
        public bool IsBlockingPoint(Vector2 screenPosition)
        {
            if (OverlayOpen) return true;
            if (!hudScreen.activeSelf) return false;
            return Contains(hudBackButton, screenPosition) || Contains(hudResetButton, screenPosition) ||
                   Contains(runButton, screenPosition) || Contains(hintButton, screenPosition);
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
