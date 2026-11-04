using System;
using System.Collections.Generic;

namespace FlowFactory.Core
{
    /// <summary>All tunable numbers of the economy in one place.</summary>
    public static class EconomyConfig
    {
        public const int HintCost = 15;
        public const int FreeCoinsAdReward = 30;
        public const int DailyAdLimit = 5;
        public const int AdCooldownSeconds = 30;
        public static readonly int[] DailyRewards = { 20, 25, 30, 40, 50, 60, 100 };
    }

    public enum ItemKind
    {
        Theme,
        Parcel,
        /// <summary>Real-money coin pack.</summary>
        CoinPack,
        /// <summary>One-time real-money bundle of coins and cosmetics.</summary>
        Bundle
    }

    public sealed class ShopItem
    {
        public string Id;
        public ItemKind Kind;
        public string Name;
        public string Description;
        /// <summary>Price in coins; 0 with no ProductId = free from the start. -1 = not sold for coins.</summary>
        public int CoinPrice;
        /// <summary>Store product id for real-money items, otherwise null.</summary>
        public string ProductId;
        /// <summary>Price text shown for real-money items (the store reports the real localized price).</summary>
        public string DisplayPrice;
        public int CoinsGranted;
        public string[] ItemsGranted = new string[0];
        public string Badge;
    }

    public static class ShopCatalog
    {
        public const string DefaultTheme = "theme.classic";
        public const string DefaultParcel = "parcel.box";

        private static readonly List<ShopItem> Items = new List<ShopItem>
        {
            new ShopItem { Id = "theme.classic", Kind = ItemKind.Theme, Name = "Classic", Description = "Warm cream plates on teal.", CoinPrice = 0 },
            new ShopItem { Id = "theme.candy", Kind = ItemKind.Theme, Name = "Candy", Description = "Pink and mint sweets factory.", CoinPrice = 150 },
            new ShopItem { Id = "theme.midnight", Kind = ItemKind.Theme, Name = "Midnight", Description = "Dark plates with neon belts.", CoinPrice = 250 },
            new ShopItem { Id = "theme.gold", Kind = ItemKind.Theme, Name = "Golden Age", Description = "Brass and marble luxury.", CoinPrice = 500, Badge = "RARE" },

            new ShopItem { Id = "parcel.box", Kind = ItemKind.Parcel, Name = "Classic Box", Description = "The original delivery.", CoinPrice = 0 },
            new ShopItem { Id = "parcel.gift", Kind = ItemKind.Parcel, Name = "Gift Box", Description = "Red wrapping, gold ribbon.", CoinPrice = 120 },
            new ShopItem { Id = "parcel.ocean", Kind = ItemKind.Parcel, Name = "Ocean Box", Description = "Cool blue crate.", CoinPrice = 120 },
            new ShopItem { Id = "parcel.gold", Kind = ItemKind.Parcel, Name = "Golden Parcel", Description = "Shiny and proud.", CoinPrice = 300, Badge = "RARE" },

            new ShopItem { Id = "coins.small", Kind = ItemKind.CoinPack, Name = "Pile of Coins", Description = "500 coins", CoinPrice = -1,
                ProductId = "ff_coins_500", DisplayPrice = "$0.99", CoinsGranted = 500 },
            new ShopItem { Id = "coins.big", Kind = ItemKind.CoinPack, Name = "Crate of Coins", Description = "1500 coins + 300 bonus", CoinPrice = -1,
                ProductId = "ff_coins_1500", DisplayPrice = "$2.99", CoinsGranted = 1800, Badge = "BEST VALUE" },
            new ShopItem { Id = "bundle.starter", Kind = ItemKind.Bundle, Name = "Starter Pack", Description = "1000 coins + Candy theme + Gift Box", CoinPrice = -1,
                ProductId = "ff_starter", DisplayPrice = "$1.99", CoinsGranted = 1000, ItemsGranted = new[] { "theme.candy", "parcel.gift" }, Badge = "ONE TIME" },
        };

        public static IList<ShopItem> All
        {
            get { return Items; }
        }

        public static ShopItem Find(string id)
        {
            foreach (ShopItem item in Items)
            {
                if (item.Id == id) return item;
            }
            return null;
        }

        public static ShopItem FindByProduct(string productId)
        {
            foreach (ShopItem item in Items)
            {
                if (item.ProductId == productId) return item;
            }
            return null;
        }

        public static IList<ShopItem> OfKind(ItemKind kind)
        {
            var result = new List<ShopItem>();
            foreach (ShopItem item in Items)
            {
                if (item.Kind == kind) result.Add(item);
            }
            return result;
        }

        /// <summary>Free items count as owned; everything else must be in the owned set.</summary>
        public static bool IsOwned(ICollection<string> owned, string id)
        {
            ShopItem item = Find(id);
            if (item == null) return false;
            if (item.CoinPrice == 0 && item.ProductId == null) return true;
            return owned.Contains(id);
        }
    }

    public static class StarRating
    {
        /// <summary>3 stars for the minimum number of taps, 2 for a few extra, otherwise 1. Time never matters.</summary>
        public static int Calculate(int taps, int minimumTaps)
        {
            if (taps <= minimumTaps) return 3;
            if (taps <= minimumTaps + Math.Max(2, minimumTaps / 2)) return 2;
            return 1;
        }
    }

    public struct LevelReward
    {
        public int Stars;
        public int Coins;
        public bool FirstClear;
        public bool ImprovedStars;
    }

    /// <summary>
    /// Coins, stars, shop and ad rules on top of the saved progress. Pure logic: no Unity types and no clock
    /// (callers pass the day number and a time in seconds), so every rule is unit-testable.
    /// Design rules: nothing here ever blocks progress; coins buy cosmetics and optional hints only.
    /// </summary>
    public sealed class PlayerEconomy
    {
        private readonly SaveService save;
        private double lastAdTime = -1e9;

        public PlayerEconomy(SaveService save)
        {
            this.save = save;
        }

        public ProgressData Data
        {
            get { return save.Data; }
        }

        public int Coins
        {
            get { return save.Data.Coins; }
        }

        /// <summary>Whole days since 2024-01-01 (local date); stable across the day, easy to compare.</summary>
        public static int DayNumber(DateTime localNow)
        {
            return (int)(localNow.Date - new DateTime(2024, 1, 1)).TotalDays + 1;
        }

        // ------------------------------------------------------------ levels

        public LevelReward AwardLevel(LevelData level, int taps)
        {
            ProgressData data = save.Data;
            bool first = !data.IsCompleted(level.id);
            int stars = StarRating.Calculate(taps, level.MinimumTaps());
            int previousBest = data.StarsFor(level.id);
            bool improved = stars > previousBest;

            int coins;
            if (first) coins = 10 + 5 * stars + 10 + level.id / 6;
            else if (improved) coins = 5 + 5 * (stars - previousBest);
            else coins = 5;

            if (improved) data.Stars[level.id] = stars;
            data.MarkCompleted(level.id, SaveLevelCount);
            data.Coins += coins;
            save.Save();
            return new LevelReward { Stars = stars, Coins = coins, FirstClear = first, ImprovedStars = improved };
        }

        private int SaveLevelCount
        {
            get { return save.LevelCount; }
        }

        // ------------------------------------------------------------ coins

        public void AddCoins(int amount)
        {
            if (amount <= 0) return;
            save.Data.Coins += amount;
            save.Save();
        }

        public bool TrySpend(int amount)
        {
            if (amount < 0 || save.Data.Coins < amount) return false;
            save.Data.Coins -= amount;
            save.Save();
            return true;
        }

        // ------------------------------------------------------------ shop

        public bool IsOwned(string itemId)
        {
            return ShopCatalog.IsOwned(save.Data.Owned, itemId);
        }

        public bool IsEquipped(string itemId)
        {
            return save.Data.Theme == itemId || save.Data.Parcel == itemId;
        }

        /// <summary>Buys a coin-priced cosmetic. Fails (nothing changes) when unknown, already owned or too expensive.</summary>
        public bool TryBuyWithCoins(string itemId)
        {
            ShopItem item = ShopCatalog.Find(itemId);
            if (item == null || item.CoinPrice <= 0 || IsOwned(itemId)) return false;
            if (!TrySpend(item.CoinPrice)) return false;
            save.Data.Owned.Add(itemId);
            save.Save();
            return true;
        }

        public bool Equip(string itemId)
        {
            ShopItem item = ShopCatalog.Find(itemId);
            if (item == null || !IsOwned(itemId)) return false;
            if (item.Kind == ItemKind.Theme) save.Data.Theme = itemId;
            else if (item.Kind == ItemKind.Parcel) save.Data.Parcel = itemId;
            else return false;
            save.Save();
            return true;
        }

        /// <summary>Whether a real-money product can still be bought (one-time bundles only once).</summary>
        public bool CanBuyProduct(string productId)
        {
            ShopItem item = ShopCatalog.FindByProduct(productId);
            if (item == null) return false;
            return item.Kind != ItemKind.Bundle || !save.Data.Owned.Contains(item.Id);
        }

        /// <summary>Called after the store confirmed a purchase. Grants coins and items; returns false if unknown or repeated.</summary>
        public bool GrantProduct(string productId)
        {
            ShopItem item = ShopCatalog.FindByProduct(productId);
            if (item == null || !CanBuyProduct(productId)) return false;

            save.Data.Coins += item.CoinsGranted;
            foreach (string granted in item.ItemsGranted) save.Data.Owned.Add(granted);
            if (item.Kind == ItemKind.Bundle) save.Data.Owned.Add(item.Id);
            save.Save();
            return true;
        }

        // ------------------------------------------------------------ daily gift

        public bool DailyAvailable(int today)
        {
            return save.Data.LastDailyDay != today;
        }

        /// <summary>The coins the gift for the current streak would give (day 1-7, then it starts over).</summary>
        public int NextDailyReward(int today)
        {
            int streak = NextStreak(today);
            return EconomyConfig.DailyRewards[(streak - 1) % EconomyConfig.DailyRewards.Length];
        }

        public int NextStreak(int today)
        {
            ProgressData data = save.Data;
            return data.LastDailyDay == today - 1 ? data.DailyStreak + 1 : 1;
        }

        /// <summary>Claims today's gift. Returns the coins granted, or 0 if it was already claimed today.</summary>
        public int ClaimDaily(int today)
        {
            if (!DailyAvailable(today)) return 0;
            int streak = NextStreak(today);
            int coins = EconomyConfig.DailyRewards[(streak - 1) % EconomyConfig.DailyRewards.Length];
            save.Data.DailyStreak = streak;
            save.Data.LastDailyDay = today;
            save.Data.Coins += coins;
            save.Save();
            return coins;
        }

        // ------------------------------------------------------------ rewarded ads (optional extras only)

        public int AdsRemainingToday(int today)
        {
            ProgressData data = save.Data;
            int used = data.AdsDay == today ? data.AdsToday : 0;
            return Math.Max(0, EconomyConfig.DailyAdLimit - used);
        }

        /// <summary>A rewarded ad may be offered when today's cap and the cooldown allow it.</summary>
        public bool CanOfferRewardedAd(int today, double nowSeconds)
        {
            return AdsRemainingToday(today) > 0 && nowSeconds - lastAdTime >= EconomyConfig.AdCooldownSeconds;
        }

        public void RegisterAdWatched(int today, double nowSeconds)
        {
            ProgressData data = save.Data;
            if (data.AdsDay != today)
            {
                data.AdsDay = today;
                data.AdsToday = 0;
            }
            data.AdsToday++;
            lastAdTime = nowSeconds;
            save.Save();
        }
    }
}
