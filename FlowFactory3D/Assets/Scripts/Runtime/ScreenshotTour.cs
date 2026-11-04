using System;
using System.Collections;
using System.IO;
using System.Text;
using UnityEngine;

namespace FlowFactory
{
    /// <summary>
    /// Walks through the screens of the real game and saves screenshots plus a short log with the number of
    /// Console errors. Start it from the menu Flow Factory > Capture Screenshot Tour (in the Editor, with the
    /// Game view set to 1080x1920) or from a build with the command line arguments  -fftour &lt;folder&gt;.
    /// </summary>
    public static class ScreenshotTour
    {
        public static bool Requested(out string folder)
        {
            folder = null;
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++)
            {
                if (args[i] == "-fftour")
                {
                    folder = args[i + 1];
                    return true;
                }
            }
#if UNITY_EDITOR
            string session = UnityEditor.SessionState.GetString("ff.tour", "");
            if (!string.IsNullOrEmpty(session))
            {
                UnityEditor.SessionState.EraseString("ff.tour");
                folder = session;
                return true;
            }
#endif
            return false;
        }

        public static IEnumerator Run(FlowFactoryApp app, string folder)
        {
            Directory.CreateDirectory(folder);
            var log = new StringBuilder();
            int errors = 0;
            int exceptions = 0;
            Application.LogCallback counter = (message, stack, type) =>
            {
                if (type == LogType.Error || type == LogType.Assert) errors++;
                if (type == LogType.Exception) { errors++; exceptions++; }
                if (type == LogType.Error || type == LogType.Exception) log.AppendLine("  CONSOLE " + type + ": " + message);
            };
            Application.logMessageReceived += counter;

            log.AppendLine("FlowFactory screenshot tour " + DateTime.Now.ToString("s"));
            log.AppendLine("Unity " + Application.unityVersion + ", platform " + Application.platform + ", screen " + Screen.width + "x" + Screen.height);

            yield return null;
            yield return null;
            app.Automation_ResetEverything();
            app.Automation_UnlockAll();

            yield return Shot(app, folder, log, "01_menu", 1.5f);
            app.Automation_ShowDailyGift();
            yield return Shot(app, folder, log, "02_daily_gift", 0.5f);
            app.Automation_ShowMenu();
            app.Automation_ShowLevelSelect();
            yield return Shot(app, folder, log, "03_level_select", 0.5f);
            app.Automation_ShowSettings();
            yield return Shot(app, folder, log, "04_settings", 0.5f);

            app.Automation_OpenLevel(1);
            yield return Shot(app, folder, log, "05_level01_start", 0.8f);
            app.Automation_ApplySolutionTaps();
            yield return null;
            app.Automation_PressRun();
            yield return Shot(app, folder, log, "06_level01_running", 0.9f);
            float waited = 0f;
            while (!app.SuccessCardOpen && waited < 20f) { waited += Time.unscaledDeltaTime; yield return null; }
            yield return Shot(app, folder, log, "07_level01_success", 1.3f);

            foreach (int id in new[] { 5, 12, 18, 30, 36 })
            {
                app.Automation_OpenLevel(id);
                yield return Shot(app, folder, log, "08_level" + id.ToString("00") + "_start", 0.8f);
                app.Automation_ApplySolutionTaps();
                yield return null;
                app.Automation_PressRun();
                waited = 0f;
                while (!app.SuccessCardOpen && waited < 40f) { waited += Time.unscaledDeltaTime; yield return null; }
                yield return Shot(app, folder, log, "09_level" + id.ToString("00") + "_success", 1.4f);
            }

            app.Automation_OpenLevel(2);
            app.Automation_PressRun(); // unsolved: shows the friendly failure
            yield return Shot(app, folder, log, "10_failure_feedback", 1.6f);

            app.Economy.AddCoins(400);
            app.Automation_OpenShop(ShopTab.Coins);
            yield return Shot(app, folder, log, "11_shop_coins", 0.6f);
            app.Automation_OpenShop(ShopTab.Themes);
            yield return Shot(app, folder, log, "12_shop_themes", 0.6f);
            app.Automation_OpenShop(ShopTab.Parcels);
            yield return Shot(app, folder, log, "13_shop_parcels", 0.6f);

            Application.logMessageReceived -= counter;
            log.AppendLine("Console errors/exceptions during the tour: " + errors + " / " + exceptions);
            File.WriteAllText(Path.Combine(folder, "tour_log.txt"), log.ToString());
            Debug.Log("[FlowFactory] Screenshot tour finished: " + folder + " (errors: " + errors + ")");

#if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
#else
            Application.Quit();
#endif
        }

        private static IEnumerator Shot(FlowFactoryApp app, string folder, StringBuilder log, string name, float settleSeconds)
        {
            float t = 0f;
            while (t < settleSeconds) { t += Time.unscaledDeltaTime; yield return null; }
            yield return new WaitForEndOfFrame();
            string path = Path.Combine(folder, name + ".png");
            ScreenCapture.CaptureScreenshot(path);
            yield return null;
            yield return null;
            log.AppendLine(name + ": screen=" + app.ScreenName + " level=" + app.CurrentLevelId + " state=" + app.CurrentLevelState +
                           " coins=" + app.Economy.Coins + " " + Screen.width + "x" + Screen.height);
        }
    }
}
