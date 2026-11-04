using System;
using FlowFactory.Core;
using NUnit.Framework;

namespace FlowFactory.Tests
{
    public class EconomyTests
    {
        private static PlayerEconomy NewEconomy(out SaveService save, MemoryStore store = null)
        {
            save = new SaveService(store ?? new MemoryStore(), 36);
            return new PlayerEconomy(save);
        }

        private static LevelData Level(int id)
        {
            return LevelCatalog.BuildAll()[id - 1];
        }

        // ---------------------------------------------------------------- stars and level rewards

        [Test]
        public void Stars_DependOnTapsOnly()
        {
            Assert.AreEqual(3, StarRating.Calculate(4, 4));
            Assert.AreEqual(3, StarRating.Calculate(2, 4));
            Assert.AreEqual(2, StarRating.Calculate(5, 4));
            Assert.AreEqual(2, StarRating.Calculate(6, 4));
            Assert.AreEqual(1, StarRating.Calculate(7, 4));
            Assert.AreEqual(2, StarRating.Calculate(3, 1)); // at least 2 extra taps allowed
            Assert.AreEqual(1, StarRating.Calculate(4, 1));
        }

        [Test]
        public void FirstClear_GivesCoinsStarsAndUnlocksNext()
        {
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save);
            LevelData level = Level(1);

            LevelReward reward = economy.AwardLevel(level, level.MinimumTaps());

            Assert.IsTrue(reward.FirstClear);
            Assert.AreEqual(3, reward.Stars);
            Assert.AreEqual(10 + 15 + 10 + 0, reward.Coins);
            Assert.AreEqual(reward.Coins, economy.Coins);
            Assert.AreEqual(3, save.Data.StarsFor(1));
            Assert.IsTrue(save.Data.IsUnlocked(2));
        }

        [Test]
        public void Replay_WithoutImprovement_GivesSmallFixedReward_AndNeverLowersStars()
        {
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save);
            LevelData level = Level(1);
            economy.AwardLevel(level, level.MinimumTaps());
            int before = economy.Coins;

            LevelReward worse = economy.AwardLevel(level, level.MinimumTaps() + 10);

            Assert.IsFalse(worse.FirstClear);
            Assert.IsFalse(worse.ImprovedStars);
            Assert.AreEqual(5, worse.Coins);
            Assert.AreEqual(before + 5, economy.Coins);
            Assert.AreEqual(3, save.Data.StarsFor(1));
        }

        [Test]
        public void Replay_WithMoreStars_PaysTheImprovement()
        {
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save);
            LevelData level = Level(5);
            economy.AwardLevel(level, level.MinimumTaps() + 20); // 1 star
            LevelReward better = economy.AwardLevel(level, level.MinimumTaps()); // 3 stars

            Assert.IsTrue(better.ImprovedStars);
            Assert.AreEqual(5 + 5 * 2, better.Coins);
            Assert.AreEqual(3, save.Data.StarsFor(5));
        }

        // ---------------------------------------------------------------- coins

        [Test]
        public void Spending_NeverGoesNegative()
        {
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save);
            economy.AddCoins(40);
            Assert.IsFalse(economy.TrySpend(41));
            Assert.AreEqual(40, economy.Coins);
            Assert.IsTrue(economy.TrySpend(40));
            Assert.AreEqual(0, economy.Coins);
            Assert.IsFalse(economy.TrySpend(-5));
        }

        // ---------------------------------------------------------------- shop

        [Test]
        public void FreeItems_AreOwnedAndEquippedFromTheStart()
        {
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save);
            Assert.IsTrue(economy.IsOwned(ShopCatalog.DefaultTheme));
            Assert.IsTrue(economy.IsOwned(ShopCatalog.DefaultParcel));
            Assert.IsTrue(economy.IsEquipped(ShopCatalog.DefaultTheme));
            Assert.IsFalse(economy.IsOwned("theme.candy"));
        }

        [Test]
        public void BuyWithCoins_NeedsEnoughCoins_AndOnlyOnce()
        {
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save);
            Assert.IsFalse(economy.TryBuyWithCoins("theme.candy"));
            Assert.IsFalse(economy.IsOwned("theme.candy"));

            economy.AddCoins(200);
            Assert.IsTrue(economy.TryBuyWithCoins("theme.candy"));
            Assert.AreEqual(50, economy.Coins);
            Assert.IsTrue(economy.IsOwned("theme.candy"));
            Assert.IsFalse(economy.TryBuyWithCoins("theme.candy")); // no double charge
            Assert.AreEqual(50, economy.Coins);
        }

        [Test]
        public void Equip_RequiresOwnership()
        {
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save);
            Assert.IsFalse(economy.Equip("theme.gold"));
            Assert.AreEqual(ShopCatalog.DefaultTheme, save.Data.Theme);

            economy.AddCoins(600);
            economy.TryBuyWithCoins("theme.gold");
            Assert.IsTrue(economy.Equip("theme.gold"));
            Assert.AreEqual("theme.gold", save.Data.Theme);
            Assert.IsTrue(economy.Equip(ShopCatalog.DefaultTheme));
            Assert.IsFalse(economy.Equip("coins.small")); // not a cosmetic
        }

        [Test]
        public void CoinPack_GrantsCoins_Repeatably()
        {
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save);
            Assert.IsTrue(economy.GrantProduct("ff_coins_500"));
            Assert.IsTrue(economy.GrantProduct("ff_coins_500"));
            Assert.AreEqual(1000, economy.Coins);
            Assert.IsTrue(economy.GrantProduct("ff_coins_1500"));
            Assert.AreEqual(2800, economy.Coins); // 1500 + 300 bonus
            Assert.IsFalse(economy.GrantProduct("not_a_product"));
        }

        [Test]
        public void StarterPack_GrantsItemsOnce()
        {
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save);
            Assert.IsTrue(economy.CanBuyProduct("ff_starter"));
            Assert.IsTrue(economy.GrantProduct("ff_starter"));

            Assert.AreEqual(1000, economy.Coins);
            Assert.IsTrue(economy.IsOwned("theme.candy"));
            Assert.IsTrue(economy.IsOwned("parcel.gift"));
            Assert.IsFalse(economy.CanBuyProduct("ff_starter"));
            Assert.IsFalse(economy.GrantProduct("ff_starter"));
            Assert.AreEqual(1000, economy.Coins);
        }

        // ---------------------------------------------------------------- daily gift

        [Test]
        public void DailyGift_OncePerDay_StreakGrows_AndWrapsAfterSeven()
        {
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save);
            int day = 100;

            Assert.IsTrue(economy.DailyAvailable(day));
            Assert.AreEqual(20, economy.ClaimDaily(day));
            Assert.AreEqual(0, economy.ClaimDaily(day)); // same day
            Assert.IsFalse(economy.DailyAvailable(day));

            Assert.AreEqual(25, economy.ClaimDaily(day + 1));
            Assert.AreEqual(2, save.Data.DailyStreak);
            for (int i = 2; i < 7; i++) economy.ClaimDaily(day + i);
            Assert.AreEqual(7, save.Data.DailyStreak);
            Assert.AreEqual(20, economy.ClaimDaily(day + 7)); // day 8 starts the cycle again
        }

        [Test]
        public void DailyGift_MissingADay_ResetsTheStreak()
        {
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save);
            economy.ClaimDaily(10);
            economy.ClaimDaily(11);
            Assert.AreEqual(2, save.Data.DailyStreak);
            Assert.AreEqual(20, economy.ClaimDaily(14));
            Assert.AreEqual(1, save.Data.DailyStreak);
        }

        [Test]
        public void DayNumber_ChangesAtMidnight()
        {
            int a = PlayerEconomy.DayNumber(new DateTime(2026, 11, 4, 23, 59, 0));
            int b = PlayerEconomy.DayNumber(new DateTime(2026, 11, 5, 0, 1, 0));
            Assert.AreEqual(a + 1, b);
        }

        // ---------------------------------------------------------------- rewarded ads

        [Test]
        public void RewardedAds_AreCappedPerDay_WithCooldown_AndResetNextDay()
        {
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save);
            int day = 50;
            double now = 1000;

            for (int i = 0; i < EconomyConfig.DailyAdLimit; i++)
            {
                Assert.IsTrue(economy.CanOfferRewardedAd(day, now), "ad " + i);
                economy.RegisterAdWatched(day, now);
                Assert.IsFalse(economy.CanOfferRewardedAd(day, now + 1), "cooldown after ad " + i);
                now += EconomyConfig.AdCooldownSeconds + 1;
            }

            Assert.AreEqual(0, economy.AdsRemainingToday(day));
            Assert.IsFalse(economy.CanOfferRewardedAd(day, now));
            Assert.IsTrue(economy.CanOfferRewardedAd(day + 1, now));
            Assert.AreEqual(EconomyConfig.DailyAdLimit, economy.AdsRemainingToday(day + 1));
        }

        // ---------------------------------------------------------------- saving

        [Test]
        public void Schema2_RoundTripsEverything()
        {
            var store = new MemoryStore();
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save, store);
            LevelData level = Level(1);
            economy.AwardLevel(level, level.MinimumTaps());
            economy.GrantProduct("ff_starter");
            economy.Equip("theme.candy");
            economy.Equip("parcel.gift");
            economy.ClaimDaily(77);
            economy.RegisterAdWatched(77, 10);
            int coins = economy.Coins;

            SaveService again;
            PlayerEconomy restored = NewEconomy(out again, store);

            Assert.AreEqual(coins, restored.Coins);
            Assert.AreEqual(3, again.Data.StarsFor(1));
            Assert.IsTrue(restored.IsOwned("parcel.gift"));
            Assert.AreEqual("theme.candy", again.Data.Theme);
            Assert.AreEqual("parcel.gift", again.Data.Parcel);
            Assert.AreEqual(77, again.Data.LastDailyDay);
            Assert.AreEqual(1, again.Data.DailyStreak);
            Assert.AreEqual(EconomyConfig.DailyAdLimit - 1, restored.AdsRemainingToday(77));
        }

        [Test]
        public void OldSchema1Save_StillLoads_WithEmptyEconomy()
        {
            var store = new MemoryStore();
            store.SetString(SaveService.Key, "v=1;unlocked=5;last=4;sound=0;volume=1;completed=1,2,3,4");
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save, store);

            Assert.AreEqual(5, save.Data.HighestUnlocked);
            Assert.IsFalse(save.Data.SoundOn);
            Assert.AreEqual(0, economy.Coins);
            Assert.AreEqual(ShopCatalog.DefaultTheme, save.Data.Theme);
        }

        [Test]
        public void EquippedItemThatIsNotOwned_FallsBackToDefault()
        {
            var store = new MemoryStore();
            store.SetString(SaveService.Key, "v=2;unlocked=1;coins=-50;theme=theme.gold;parcel=parcel.gold;owned=;stars=1:9,2:2");
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save, store);

            Assert.AreEqual(ShopCatalog.DefaultTheme, save.Data.Theme);
            Assert.AreEqual(ShopCatalog.DefaultParcel, save.Data.Parcel);
            Assert.AreEqual(0, economy.Coins); // never negative
            Assert.AreEqual(0, save.Data.StarsFor(1)); // 9 stars is not valid
        }

        [Test]
        public void ResetLevelProgress_KeepsCoinsPurchasesAndSettings()
        {
            SaveService save;
            PlayerEconomy economy = NewEconomy(out save);
            LevelData level = Level(1);
            economy.AwardLevel(level, level.MinimumTaps());
            economy.GrantProduct("ff_starter");
            economy.Equip("theme.candy");
            save.Data.SoundOn = false;
            int coins = economy.Coins;

            save.ResetLevelProgress();

            Assert.IsFalse(save.Data.IsCompleted(1));
            Assert.IsFalse(save.Data.IsUnlocked(2));
            Assert.AreEqual(0, save.Data.StarsFor(1));
            Assert.AreEqual(coins, economy.Coins);
            Assert.IsTrue(economy.IsOwned("theme.candy"));
            Assert.AreEqual("theme.candy", save.Data.Theme);
            Assert.IsFalse(save.Data.SoundOn);
        }

        [Test]
        public void Catalog_HasConsistentItems()
        {
            var ids = new System.Collections.Generic.HashSet<string>();
            foreach (ShopItem item in ShopCatalog.All)
            {
                Assert.IsTrue(ids.Add(item.Id), "duplicate id " + item.Id);
                bool realMoney = item.ProductId != null;
                Assert.AreEqual(realMoney, item.CoinPrice < 0, item.Id);
                if (realMoney) Assert.Greater(item.CoinsGranted, 0, item.Id);
                foreach (string granted in item.ItemsGranted) Assert.IsNotNull(ShopCatalog.Find(granted), granted);
            }
            Assert.IsNotNull(ShopCatalog.Find(ShopCatalog.DefaultTheme));
            Assert.IsNotNull(ShopCatalog.Find(ShopCatalog.DefaultParcel));
        }
    }
}
