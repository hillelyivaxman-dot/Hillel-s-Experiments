using System.Collections;
using System.Collections.Generic;
using FlowFactory.Core;
using UnityEngine;

namespace FlowFactory
{
    /// <summary>
    /// Wires everything together: camera, UI, board, parcel, audio, save and telemetry, and drives the
    /// flow between menu, level select, play and settings. One generic game; levels are loaded as data.
    /// </summary>
    public sealed class FlowFactoryApp : MonoBehaviour
    {
        private enum AppScreen
        {
            Menu,
            LevelSelect,
            Playing,
            Settings
        }

        private const float ParcelSpeed = 4.2f;
        private const int TutorialLastLevel = 2;

        private IList<LevelData> levels;
        private SaveService save;
        private LocalTelemetry telemetry;
        private AudioService audioService;
        private GameUIController ui;
        private GridManager grid;
        private ParcelController parcel;
        private FactoryAwakening awakening;
        private FpsCounter fps;
        private Camera cam;
        private readonly LevelManager manager = new LevelManager();

        private AppScreen screen = AppScreen.Menu;
        private int levelIndex;
        private float levelStartTime;
        private Coroutine runRoutine;
        private bool awakeningRunning;
        private bool tutorialStartLogged;
        private bool tutorialCompleteLogged;
        private int lastScreenWidth;
        private int lastScreenHeight;

        private static FlowFactoryApp instance;

        // ---------------------------------------------------------------- setup

        private void Awake()
        {
            if (instance != null && instance != this)
            {
                Destroy(gameObject);
                return;
            }
            instance = this;

            Application.targetFrameRate = Application.isMobilePlatform ? 30 : 60;
            if (Application.isMobilePlatform)
            {
                QualitySettings.vSyncCount = 0;
                Screen.sleepTimeout = SleepTimeout.NeverSleep;
                Screen.orientation = ScreenOrientation.Portrait;
            }

            levels = LevelRepository.LoadAll();
            save = new SaveService(new PlayerPrefsStore(), levels.Count);
            telemetry = new LocalTelemetry();
            telemetry.Log("session_start", "version=0.1 levels=" + levels.Count);

            SetUpCamera();

            audioService = gameObject.AddComponent<AudioService>();
            audioService.Enabled = save.Data.SoundOn;
            audioService.VolumeStep = save.Data.VolumeStep;

            InputBridge.EnsureEventSystem();

            ui = new GameObject("UI").AddComponent<GameUIController>();
            ui.transform.SetParent(transform, false);
            ui.Build();
            HookUi();

            grid = new GameObject("Grid").AddComponent<GridManager>();
            grid.transform.SetParent(transform, false);

            parcel = new GameObject("Parcel").AddComponent<ParcelController>();
            parcel.transform.SetParent(transform, false);
            parcel.Build();
            parcel.Hide();

            awakening = new GameObject("Awakening").AddComponent<FactoryAwakening>();
            awakening.transform.SetParent(transform, false);

            fps = gameObject.AddComponent<FpsCounter>();
            fps.enabled = FpsCounter.Available;

            manager.TileRotated += (x, y) =>
            {
                grid.RotateTile(x, y);
                UpdateHint();
            };
            manager.LevelReset += () =>
            {
                grid.SnapRotations(manager.Rotations);
                UpdateHint();
            };

            ShowMenu();
        }

        private void SetUpCamera()
        {
            cam = Camera.main;
            if (cam == null)
            {
                var camObject = new GameObject("Main Camera") { tag = "MainCamera" };
                cam = camObject.AddComponent<Camera>();
                camObject.AddComponent<AudioListener>();
            }
            cam.orthographic = true;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Palette.Background;
            cam.nearClipPlane = 0.1f;
            cam.farClipPlane = 120f;

            if (Object.FindFirstObjectByType<Light>() == null)
            {
                var lightObject = new GameObject("Light");
                var light = lightObject.AddComponent<Light>();
                light.type = LightType.Directional;
                light.shadows = LightShadows.None;
                lightObject.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
            }
        }

        private void HookUi()
        {
            ui.AnyButton += () => audioService.Play(Sfx.Click);
            ui.PlayPressed += OnPlay;
            ui.LevelsPressed += ShowLevelSelect;
            ui.SettingsPressed += ShowSettings;
            ui.MenuPressed += ShowMenu;
            ui.LevelChosen += id => StartLevel(id - 1);
            ui.RunPressed += OnRun;
            ui.ResetPressed += OnReset;
            ui.BackPressed += ShowLevelSelect;
            ui.NextPressed += () => StartLevel(levelIndex + 1);
            ui.ReplayPressed += () => StartLevel(levelIndex);
            ui.SoundToggled += () =>
            {
                save.Data.SoundOn = !save.Data.SoundOn;
                audioService.Enabled = save.Data.SoundOn;
                save.Save();
                ui.RefreshSettings(save.Data, fps.Visible);
            };
            ui.VolumeCycled += () =>
            {
                save.Data.VolumeStep = (save.Data.VolumeStep + 1) % 3;
                audioService.VolumeStep = save.Data.VolumeStep;
                save.Save();
                ui.RefreshSettings(save.Data, fps.Visible);
            };
            ui.FpsToggled += () =>
            {
                fps.Visible = !fps.Visible;
                ui.RefreshSettings(save.Data, fps.Visible);
            };
            ui.ProgressResetConfirmed += () =>
            {
                save.ResetAll();
                save.Save();
                tutorialStartLogged = false;
                tutorialCompleteLogged = false;
            };
        }

        // ---------------------------------------------------------------- screens

        private void ShowMenu()
        {
            LeaveLevel();
            screen = AppScreen.Menu;
            ui.ShowMenu();
        }

        private void ShowLevelSelect()
        {
            LeaveLevel();
            screen = AppScreen.LevelSelect;
            ui.ShowLevelSelect(levels, save.Data);
        }

        private void ShowSettings()
        {
            screen = AppScreen.Settings;
            ui.ShowSettings(save.Data, fps.Visible);
        }

        private void LeaveLevel()
        {
            StopRun();
            ui.HideSuccess();
            awakening.Clear();
            parcel.Hide();
            grid.Clear();
        }

        private void OnPlay()
        {
            ProgressData data = save.Data;
            int target = data.IsUnlocked(data.LastLevel) && !data.IsCompleted(data.LastLevel) ? data.LastLevel : data.HighestUnlocked;
            StartLevel(target - 1);
        }

        private void StartLevel(int index)
        {
            if (index < 0 || index >= levels.Count || !save.Data.IsUnlocked(index + 1))
            {
                ShowLevelSelect();
                return;
            }

            LeaveLevel();
            levelIndex = index;
            LevelData level = levels[index];

            manager.Load(level);
            grid.Build(level, manager.Rotations);
            ConfigureCamera(level);
            parcel.PlaceAt(ParcelStart());
            save.SetLastLevel(level.id);

            screen = AppScreen.Playing;
            ui.ShowHud(level);
            ui.SetRunInteractable(true);
            UpdateHint();

            levelStartTime = Time.realtimeSinceStartup;
            telemetry.Log("level_start", "level=" + level.id);
            if (level.id == 1 && !tutorialStartLogged && !save.Data.IsCompleted(1))
            {
                tutorialStartLogged = true;
                telemetry.Log("tutorial_start");
            }
        }

        // ---------------------------------------------------------------- camera

        /// <summary>Fixed isometric view: orthographic, 45 degrees around, tilted down, fitted to the board width.</summary>
        private void ConfigureCamera(LevelData level)
        {
            lastScreenWidth = Screen.width;
            lastScreenHeight = Screen.height;

            Transform t = cam.transform;
            t.rotation = Quaternion.Euler(52f, 45f, 0f);
            t.position = -t.forward * 40f;

            float halfW = level.width * 0.5f;
            float halfH = level.height * 0.5f;
            float minX = float.MaxValue, maxX = float.MinValue, minY = float.MaxValue, maxY = float.MinValue;
            for (int cx = -1; cx <= 1; cx += 2)
            {
                for (int cz = -1; cz <= 1; cz += 2)
                {
                    foreach (float y in new[] { -0.5f, 1.2f })
                    {
                        Vector3 local = t.InverseTransformPoint(new Vector3(cx * halfW, y, cz * halfH));
                        minX = Mathf.Min(minX, local.x);
                        maxX = Mathf.Max(maxX, local.x);
                        minY = Mathf.Min(minY, local.y);
                        maxY = Mathf.Max(maxY, local.y);
                    }
                }
            }

            float aspect = Mathf.Max(0.2f, (float)Screen.width / Mathf.Max(1, Screen.height));
            float size = Mathf.Max((maxX - minX) * 0.5f / aspect + 0.9f, (maxY - minY));
            cam.orthographicSize = size;
            t.position += -t.up * (size * 0.10f);

            Vector3 flatForward = new Vector3(t.forward.x, 0f, t.forward.z).normalized;
            // The factory goes in front of the board (towards the camera), where the screen is empty,
            // so it does not cover the title and hint at the top.
            awakeningPosition = -flatForward * (Mathf.Max(level.width, level.height) * 0.55f + 2.4f);
        }

        private Vector3 awakeningPosition;

        // ---------------------------------------------------------------- per-frame

        private void Update()
        {
            if (InputBridge.BackPressed())
            {
                HandleBack();
            }

            if (screen != AppScreen.Playing)
            {
                return;
            }

            if (Screen.width != lastScreenWidth || Screen.height != lastScreenHeight)
            {
                ConfigureCamera(manager.Level);
            }

            Vector2 press;
            if (!InputBridge.TryGetPress(out press))
            {
                return;
            }

            if (awakeningRunning)
            {
                awakening.SkipRequested = true;
                return;
            }
            if (ui.IsBlockingPoint(press) || manager.State != LevelState.Idle)
            {
                return;
            }

            GridPoint cell;
            if (grid.TryPickCell(cam, press, out cell) && manager.TryRotate(cell.x, cell.y))
            {
                audioService.Play(Sfx.Rotate);
            }
        }

        private void HandleBack()
        {
            switch (screen)
            {
                case AppScreen.Playing:
                    ShowLevelSelect();
                    break;
                case AppScreen.LevelSelect:
                case AppScreen.Settings:
                    ShowMenu();
                    break;
                default:
                    Application.Quit();
                    break;
            }
        }

        // ---------------------------------------------------------------- playing

        private Vector3 ParcelStart()
        {
            GridPoint source;
            levels[levelIndex].TryFind(TileKind.Source, out source);
            Direction side = TileGeometry.TerminalSide(manager.Rotations[levels[levelIndex].IndexOf(source.x, source.y)]);
            return grid.CellCenter(source) + GridManager.WorldDirection(side) * 0.4f + Vector3.up * GridManager.ParcelHeight;
        }

        private void UpdateHint()
        {
            LevelData level = manager.Level;
            if (level == null || manager.State != LevelState.Idle)
            {
                return;
            }

            if (!level.isTutorial)
            {
                ui.SetHint(level.hint);
                grid.HideHint();
                ui.SetRunPulse(false);
                return;
            }

            // Tutorial: point at the next belt that still faces the wrong way, then at the Run button.
            for (int i = 0; i < level.tiles.Length; i++)
            {
                TileSpec tile = level.tiles[i];
                if (tile.rotatable && TileGeometry.Openings(tile.kind, manager.Rotations[i]) != TileGeometry.Openings(tile.kind, level.solution[i]))
                {
                    grid.ShowHint(new GridPoint(i % level.width, i / level.width));
                    ui.SetHint("Tap the glowing belt to turn it.");
                    ui.SetRunPulse(false);
                    return;
                }
            }
            grid.HideHint();
            ui.SetHint("Now press RUN!");
            ui.SetRunPulse(true);
        }

        private void OnRun()
        {
            if (screen != AppScreen.Playing || manager.State != LevelState.Idle)
            {
                return;
            }

            RouteResult result = manager.Run();
            if (result == null)
            {
                return;
            }

            if (manager.Attempts > 1)
            {
                telemetry.Log("level_retry", "level=" + manager.Level.id + " attempt=" + manager.Attempts);
            }

            audioService.Play(Sfx.Run);
            grid.HideHint();
            ui.SetRunPulse(false);
            ui.HideToast();
            ui.SetRunInteractable(false);
            runRoutine = StartCoroutine(RunRoutine(result));
        }

        private void OnReset()
        {
            if (screen != AppScreen.Playing)
            {
                return;
            }

            StopRun();
            awakening.Clear();
            telemetry.Log("level_retry", "level=" + manager.Level.id + " reason=reset");
            manager.ResetLevel();
            parcel.PlaceAt(ParcelStart());
            ui.HideToast();
            ui.SetRunInteractable(true);
            UpdateHint();
        }

        private void StopRun()
        {
            if (runRoutine != null)
            {
                StopCoroutine(runRoutine);
                runRoutine = null;
            }
            awakeningRunning = false;
        }

        private IEnumerator RunRoutine(RouteResult result)
        {
            LevelData level = manager.Level;
            List<Vector3> waypoints = grid.BuildWaypoints(result);
            yield return parcel.Travel(waypoints, ParcelSpeed);

            if (result.Success)
            {
                yield return parcel.Deliver(grid.CellCenter(result.Path[result.Path.Count - 1]));
                grid.FlashCell(result.Path[result.Path.Count - 1], Palette.FlashOk, 0.5f);
                audioService.Play(Sfx.Deliver);
                audioService.Play(Sfx.Success);
                manager.CompleteRun();

                save.CompleteLevel(level.id);
                telemetry.Log("level_success", "level=" + level.id + " seconds=" + (Time.realtimeSinceStartup - levelStartTime).ToString("0.0") +
                                               " attempts=" + manager.Attempts + " taps=" + manager.TapCount);
                if (level.id == TutorialLastLevel && !tutorialCompleteLogged)
                {
                    tutorialCompleteLogged = true;
                    telemetry.Log("tutorial_complete");
                }

                bool last = levelIndex == levels.Count - 1;
                if (last)
                {
                    awakeningRunning = true;
                    yield return awakening.Play(awakeningPosition);
                    awakeningRunning = false;
                }
                else
                {
                    yield return new WaitForSeconds(0.45f);
                }
                ui.ShowSuccess(level, !last, last);
            }
            else
            {
                yield return FailureRoutine(result);
                manager.CompleteRun();
                yield return new WaitForSeconds(0.6f);
                manager.ReturnToEditing();
                parcel.PlaceAt(ParcelStart());
                ui.SetRunInteractable(true);
                UpdateHint();
            }
            runRoutine = null;
        }

        private IEnumerator FailureRoutine(RouteResult result)
        {
            Vector3 lastCenter = grid.CellCenter(result.Path[result.Path.Count - 1]) + Vector3.up * GridManager.ParcelHeight;
            Vector3 heading = GridManager.WorldDirection(result.FailDirection);

            if (result.Reason == FailureReason.OffBoard)
            {
                yield return parcel.Travel(new[] { lastCenter + heading * 0.5f }, ParcelSpeed);
                audioService.Play(Sfx.Fail);
                yield return parcel.FallOff(heading);
            }
            else
            {
                yield return parcel.Travel(new[] { lastCenter + heading * 0.3f }, ParcelSpeed);
                grid.FlashCell(result.FailCell, Palette.FlashFail, 0.7f);
                audioService.Play(Sfx.Fail);
                yield return parcel.Bump(heading);
            }
            ui.ShowToast(FailureMessage(result.Reason));
        }

        private static string FailureMessage(FailureReason reason)
        {
            switch (reason)
            {
                case FailureReason.WrongConnection: return "The belts don't line up here. Try turning one!";
                case FailureReason.EmptyCell: return "Nothing here to carry the parcel.";
                case FailureReason.BlockedCell: return "A crate is in the way!";
                case FailureReason.OffBoard: return "Oops! The parcel fell off the board.";
                case FailureReason.Loop:
                case FailureReason.StepLimit: return "The parcel went in circles.";
                default: return "The parcel got stuck. Try again!";
            }
        }

        // ---------------------------------------------------------------- lifecycle

        private void OnApplicationPause(bool paused)
        {
            if (telemetry == null)
            {
                return;
            }

            if (paused)
            {
                save.Save();
                telemetry.Log("session_end", "reason=pause");
            }
            else
            {
                telemetry.Reopen();
                telemetry.Log("session_start", "resume=1");
            }
        }

        private void OnApplicationQuit()
        {
            if (telemetry == null)
            {
                return;
            }
            save.Save();
            telemetry.Log("session_end", "reason=quit");
        }
    }
}
