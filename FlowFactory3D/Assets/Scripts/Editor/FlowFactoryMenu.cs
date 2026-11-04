using System;
using System.Collections.Generic;
using System.IO;
using FlowFactory.Core;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace FlowFactory.EditorTools
{
    /// <summary>Editor menu: level generation and validation, one-click project setup, Android build.</summary>
    public static class FlowFactoryMenu
    {
        private const string LevelFolder = "Assets/Resources/Levels";
        private const string ScenePath = "Assets/Scenes/Main.unity";
        private const string DevApkPath = "Builds/Android/FlowFactory3D-dev.apk";
        private const string ReleaseApkPath = "Builds/Android/FlowFactory3D.apk";

        // ------------------------------------------------------------ levels

        [MenuItem("Flow Factory/Generate Level Assets (create missing)")]
        public static void GenerateMissingLevels()
        {
            GenerateLevels(false);
        }

        [MenuItem("Flow Factory/Regenerate All Level Assets (overwrites edits)")]
        public static void RegenerateAllLevels()
        {
            if (!EditorUtility.DisplayDialog("Regenerate levels",
                    "This overwrites every level asset in " + LevelFolder + " with the built-in catalog, discarding manual edits. Continue?",
                    "Overwrite", "Cancel"))
            {
                return;
            }
            GenerateLevels(true);
        }

        private static void GenerateLevels(bool overwrite)
        {
            EnsureFolder("Assets/Resources");
            EnsureFolder(LevelFolder);

            int created = 0;
            int updated = 0;
            foreach (LevelData data in LevelCatalog.BuildAll())
            {
                string path = LevelFolder + "/Level_" + data.id.ToString("00") + ".asset";
                var asset = AssetDatabase.LoadAssetAtPath<LevelDefinition>(path);
                if (asset == null)
                {
                    asset = ScriptableObject.CreateInstance<LevelDefinition>();
                    asset.CopyFrom(data);
                    AssetDatabase.CreateAsset(asset, path);
                    created++;
                }
                else if (overwrite)
                {
                    asset.CopyFrom(data);
                    EditorUtility.SetDirty(asset);
                    updated++;
                }
            }
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log("[FlowFactory] Level assets: " + created + " created, " + updated + " overwritten.");
            ValidateLevels();
        }

        /// <summary>Checks every level asset and its known solution. Returns the number of problems.</summary>
        [MenuItem("Flow Factory/Validate All Levels (known solutions)")]
        public static int ValidateLevels()
        {
            string[] guids = AssetDatabase.FindAssets("t:LevelDefinition", new[] { "Assets" });
            var assets = new List<LevelDefinition>();
            foreach (string guid in guids)
            {
                assets.Add(AssetDatabase.LoadAssetAtPath<LevelDefinition>(AssetDatabase.GUIDToAssetPath(guid)));
            }
            assets.Sort((a, b) => a.levelId.CompareTo(b.levelId));

            int problems = 0;
            if (assets.Count == 0)
            {
                Debug.LogWarning("[FlowFactory] No LevelDefinition assets found. Use Flow Factory > Generate Level Assets. (The game falls back to the built-in catalog.)");
                return 0;
            }

            for (int i = 0; i < assets.Count; i++)
            {
                LevelData data = assets[i].ToLevelData();
                List<string> errors = LevelValidator.Validate(data);
                if (data.id != i + 1) errors.Add("Level ids must be 1..N without gaps (found " + data.id + " at position " + (i + 1) + ")");

                if (errors.Count == 0)
                {
                    RouteResult solved = RouteValidator.Validate(data, data.solution);
                    Debug.Log("[FlowFactory] Level " + data.id + " '" + data.title + "' OK: " + data.width + "x" + data.height +
                              ", solution path " + solved.Path.Count + " cells, minimum " + data.MinimumTaps() + " taps.", assets[i]);
                }
                else
                {
                    problems += errors.Count;
                    foreach (string error in errors) Debug.LogError("[FlowFactory] " + error, assets[i]);
                }
            }

            Debug.Log("[FlowFactory] Level validation finished: " + assets.Count + " levels, " + problems + " problem(s).");
            return problems;
        }

        // ------------------------------------------------------------ setup

        [MenuItem("Flow Factory/Setup Project (portrait, Android, Main scene)")]
        public static void SetUpProject()
        {
            PlayerSettings.productName = "Flow Factory 3D";
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
            PlayerSettings.allowedAutorotateToPortrait = true;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = false;
            PlayerSettings.allowedAutorotateToLandscapeRight = false;

            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, "com.flowfactory.prototype3d");
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;
            PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.Android, ManagedStrippingLevel.Medium);
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { UnityEngine.Rendering.GraphicsDeviceType.OpenGLES3, UnityEngine.Rendering.GraphicsDeviceType.Vulkan });
            PlayerSettings.bundleVersion = "0.3.0";
            PlayerSettings.Android.bundleVersionCode = 3;
            PlayerSettings.gpuSkinning = false;

            GenerateLevels(false);
            EnsureMainScene();
            Debug.Log("[FlowFactory] Project set up: portrait, Android IL2CPP/ARM64, level assets, " + ScenePath + " in Build Settings.");
        }

        private static void EnsureMainScene()
        {
            if (!File.Exists(ScenePath))
            {
                if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
                {
                    return;
                }
                EnsureFolder("Assets/Scenes");
                var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
                new GameObject("FlowFactoryApp").AddComponent<FlowFactoryApp>();
                EditorSceneManager.SaveScene(scene, ScenePath);
            }
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
        }

        // ------------------------------------------------------------ build

        [MenuItem("Flow Factory/Build Android APK (development, FPS display)")]
        public static void BuildAndroidDevelopment()
        {
            Build(DevApkPath, BuildOptions.Development);
        }

        [MenuItem("Flow Factory/Build Android APK (release)")]
        public static void BuildAndroidRelease()
        {
            Build(ReleaseApkPath, BuildOptions.None);
        }

        /// <summary>Command line: Unity -batchmode -quit -projectPath . -executeMethod FlowFactory.EditorTools.FlowFactoryMenu.BuildAndroidBatch</summary>
        public static void BuildAndroidBatch()
        {
            bool ok = Build(DevApkPath, BuildOptions.Development);
            EditorApplication.Exit(ok ? 0 : 1);
        }

        private static bool Build(string outputPath, BuildOptions options)
        {
            if (ValidateLevels() > 0)
            {
                Debug.LogError("[FlowFactory] Build cancelled: fix the level problems first.");
                return false;
            }

            EnsureMainScene();
            EditorUserBuildSettings.buildAppBundle = false;
            Directory.CreateDirectory(Path.GetDirectoryName(outputPath));

            var buildOptions = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = outputPath,
                target = BuildTarget.Android,
                targetGroup = BuildTargetGroup.Android,
                options = options
            };

            BuildReport report = BuildPipeline.BuildPlayer(buildOptions);
            bool ok = report.summary.result == BuildResult.Succeeded;
            if (ok)
            {
                Debug.Log("[FlowFactory] Android build succeeded: " + outputPath + " (" + report.summary.totalSize / (1024 * 1024) + " MB)");
            }
            else
            {
                Debug.LogError("[FlowFactory] Android build failed: " + report.summary.result + ", errors: " + report.summary.totalErrors);
            }
            return ok;
        }

        // ------------------------------------------------------------ diagnostics

        /// <summary>Prints (and saves) what this Unity installation offers, so problems can be diagnosed from a copy of the text.</summary>
        [MenuItem("Flow Factory/Environment Report")]
        public static void EnvironmentReport()
        {
            var sb = new System.Text.StringBuilder();
            sb.AppendLine("FlowFactory environment report " + DateTime.Now.ToString("s"));
            sb.AppendLine("Unity " + Application.unityVersion + " on " + Application.platform);
            sb.AppendLine("Active build target: " + EditorUserBuildSettings.activeBuildTarget);
            sb.AppendLine("Android Build Support installed: " + BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.Android, BuildTarget.Android));
            sb.AppendLine("Render pipeline asset: " + (UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline != null ? UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline.name : "none (Built-in)"));
            sb.AppendLine("Color space: " + PlayerSettings.colorSpace);
            sb.AppendLine("Orientation: " + PlayerSettings.defaultInterfaceOrientation);
            sb.AppendLine("Android scripting backend: " + PlayerSettings.GetScriptingBackend(NamedBuildTarget.Android));
            sb.AppendLine("Android min SDK: " + PlayerSettings.Android.minSdkVersion + ", architectures: " + PlayerSettings.Android.targetArchitectures);
            sb.AppendLine("Application id: " + PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android));
            sb.AppendLine("Scenes in build: " + EditorBuildSettings.scenes.Length);
            sb.AppendLine("Level assets: " + AssetDatabase.FindAssets("t:LevelDefinition").Length + " (catalog has " + LevelCatalog.Count + ")");
            sb.AppendLine("Level problems: " + ValidateLevels());
            string text = sb.ToString();
            Debug.Log(text);
            Directory.CreateDirectory("Logs");
            File.WriteAllText("Logs/flowfactory_environment.txt", text);
        }

        [MenuItem("Flow Factory/Capture Screenshot Tour (Game view 1080x1920)")]
        public static void CaptureScreenshotTour()
        {
            string folder = Path.GetFullPath("Logs/ScreenshotTour");
            SessionState.SetString("ff.tour", folder);
            Debug.Log("[FlowFactory] Screenshot tour starts. Output: " + folder);
            EditorApplication.EnterPlaymode();
        }

        private static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path))
            {
                return;
            }
            string parent = Path.GetDirectoryName(path).Replace('\\', '/');
            EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, Path.GetFileName(path));
        }
    }
}
