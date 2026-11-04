using System.Collections;
using FlowFactory.Core;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace FlowFactory.Tests
{
    /// <summary>
    /// Runs the real game in Play Mode (Test Runner > PlayMode, or the command line  -runTests -testPlatform PlayMode).
    /// The game starts itself (GameBootstrap) in the test scene; these tests drive it through the same code paths
    /// as a player and fail on any Console error or exception.
    /// </summary>
    public class PlayModeSmokeTests
    {
        private FlowFactoryApp app;

        [UnitySetUp]
        public IEnumerator SetUp()
        {
            Time.timeScale = 1f;
            float waited = 0f;
            while (FlowFactoryApp.Instance == null && waited < 10f)
            {
                waited += Time.unscaledDeltaTime;
                yield return null;
            }
            app = FlowFactoryApp.Instance;
            Assert.IsNotNull(app, "The game did not start (GameBootstrap).");
            app.Automation_ResetEverything();
            yield return null;
        }

        [TearDown]
        public void TearDown()
        {
            Time.timeScale = 1f;
        }

        [UnityTest]
        public IEnumerator Boots_ToMenu_WithoutErrors()
        {
            yield return null;
            Assert.AreEqual("Menu", app.ScreenName);
            Assert.AreEqual(36, app.LevelCount);
            Assert.IsNotNull(Camera.main);
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator Screens_Navigate_WithoutErrors()
        {
            app.Automation_ShowLevelSelect();
            yield return null;
            Assert.AreEqual("LevelSelect", app.ScreenName);
            app.Automation_ShowSettings();
            yield return null;
            Assert.AreEqual("Settings", app.ScreenName);
            app.Automation_ShowMenu();
            yield return null;
            app.Automation_OpenShop(ShopTab.Coins);
            yield return null;
            Assert.IsTrue(app.AnyMoneyOverlayOpen);
            app.Automation_OpenShop(ShopTab.Themes);
            yield return null;
            app.Automation_OpenShop(ShopTab.Parcels);
            yield return null;
            app.Automation_OpenLevel(1);
            yield return null;
            Assert.AreEqual("Playing", app.ScreenName);
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator AllLevels_PlayThrough_InOrder()
        {
            Time.timeScale = 8f; // the parcel animation uses scaled time; this keeps the test short
            int previousCoins = app.Economy.Coins;
            for (int id = 1; id <= app.LevelCount; id++)
            {
                Assert.IsTrue(app.Progress.Data.IsUnlocked(id), "level " + id + " should be unlocked after finishing level " + (id - 1));
                app.Automation_OpenLevel(id);
                yield return null;
                Assert.AreEqual(id, app.CurrentLevelId);
                Assert.AreEqual(LevelState.Idle, app.CurrentLevelState);

                yield return app.Automation_SolveAndWait(120f);
                Assert.IsTrue(app.AutomationResult, "level " + id + " did not finish");
                Assert.IsTrue(app.Progress.Data.IsCompleted(id), "level " + id + " not saved as completed");
                Assert.GreaterOrEqual(app.Progress.Data.StarsFor(id), 1);
                Assert.Greater(app.Economy.Coins, previousCoins, "level " + id + " paid no coins");
                previousCoins = app.Economy.Coins;
            }
            Assert.AreEqual(app.LevelCount, app.Progress.Data.Completed.Count);
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator Progress_IsWrittenToStorage_AndReloads()
        {
            Time.timeScale = 8f;
            for (int id = 1; id <= 3; id++)
            {
                app.Automation_OpenLevel(id);
                yield return app.Automation_SolveAndWait(60f);
                Assert.IsTrue(app.AutomationResult);
            }
            app.Economy.AddCoins(77);
            int coins = app.Economy.Coins;

            // A fresh service over the same PlayerPrefs is what the next app start sees.
            var reloaded = new SaveService(new PlayerPrefsStore(), app.LevelCount);
            Assert.IsTrue(reloaded.Data.IsCompleted(3));
            Assert.IsTrue(reloaded.Data.IsUnlocked(4));
            Assert.AreEqual(coins, reloaded.Data.Coins);
            Assert.AreEqual(app.Progress.Data.StarsFor(2), reloaded.Data.StarsFor(2));
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator UnsolvedRun_FailsFriendly_AndAllowsRetry()
        {
            Time.timeScale = 6f;
            app.Automation_OpenLevel(1);
            yield return null;
            app.Automation_PressRun();
            float waited = 0f;
            while (app.CurrentLevelState != LevelState.Idle && waited < 30f)
            {
                waited += Time.unscaledDeltaTime;
                yield return null;
            }
            Assert.AreEqual(LevelState.Idle, app.CurrentLevelState, "the game must return to editing after a failed run");
            Assert.IsFalse(app.Progress.Data.IsCompleted(1));

            yield return app.Automation_SolveAndWait(60f);
            Assert.IsTrue(app.AutomationResult);
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator Shop_BuyEquipTheme_ThenPlayALevel()
        {
            app.Economy.AddCoins(300);
            Assert.IsTrue(app.Economy.TryBuyWithCoins("theme.candy"));
            Assert.IsTrue(app.Economy.Equip("theme.candy"));
            ThemeCatalog.Apply("theme.candy", app.Progress.Data.Parcel);
            app.Automation_OpenLevel(1);
            yield return null;
            Time.timeScale = 8f;
            yield return app.Automation_SolveAndWait(60f);
            Assert.IsTrue(app.AutomationResult);
            Assert.AreEqual("theme.candy", app.Progress.Data.Theme);
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator Hint_CostsCoins()
        {
            app.Economy.AddCoins(100);
            int before = app.Economy.Coins;
            app.Automation_OpenLevel(5);
            yield return null;
            app.Automation_PressHint();
            yield return null;
            Assert.AreEqual(before - EconomyConfig.HintCost, app.Economy.Coins);
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator DailyGift_CanBeClaimedOncePerDay()
        {
            int today = PlayerEconomy.DayNumber(System.DateTime.Now);
            Assert.IsTrue(app.Economy.DailyAvailable(today));
            int coins = app.Economy.ClaimDaily(today);
            Assert.Greater(coins, 0);
            Assert.AreEqual(0, app.Economy.ClaimDaily(today));
            yield return null;
            LogAssert.NoUnexpectedReceived();
        }
    }
}
