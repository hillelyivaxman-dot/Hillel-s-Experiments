using System;
using FlowFactory.Core;
using UnityEngine;

namespace FlowFactory
{
    /// <summary>
    /// Connects the economy rules (PlayerEconomy) with the money UI and the ad/store services.
    /// Principles it enforces: every ad is an optional extra the player taps (never during a puzzle, never
    /// required to progress), real-money items are cosmetics and coin packs only, and there are no countdown
    /// pressure timers or limited-time pop-ups.
    /// </summary>
    public sealed class MonetizationController
    {
        private readonly PlayerEconomy economy;
        private readonly MonetizationUi view;
        private readonly GameUIController ui;
        private readonly IRewardedAdService ads;
        private readonly IStoreService store;
        private readonly LocalTelemetry telemetry;
        private readonly AudioService audio;
        private ShopTab tab = ShopTab.Coins;

        /// <summary>Raised after a theme or parcel skin was equipped, so the 3D scene can refresh.</summary>
        public event Action AppearanceChanged;
        public event Action ShopClosed;

        public MonetizationController(PlayerEconomy economy, MonetizationUi view, GameUIController ui, IRewardedAdService ads,
            IStoreService store, LocalTelemetry telemetry, AudioService audio)
        {
            this.economy = economy;
            this.view = view;
            this.ui = ui;
            this.ads = ads;
            this.store = store;
            this.telemetry = telemetry;
            this.audio = audio;

            view.AnyButton += () => audio.Play(Sfx.Click);
            view.ShopBack += CloseShop;
            view.TabChanged += t => { tab = t; RefreshShop(); };
            view.ItemClicked += OnItemClicked;
            view.ProductClicked += OnProductClicked;
            view.FreeCoinsClicked += OnFreeCoins;
            RefreshCoins();
        }

        private static int Today
        {
            get { return PlayerEconomy.DayNumber(DateTime.Now); }
        }

        private static double Now
        {
            get { return Time.realtimeSinceStartup; }
        }

        public bool OverlayOpen
        {
            get { return view.BlockingOverlayOpen || view.ShopOpen; }
        }

        public void ApplyEquipped()
        {
            ThemeCatalog.Apply(economy.Data.Theme, economy.Data.Parcel);
        }

        private void RefreshCoins()
        {
            ui.SetCoins(economy.Coins);
            view.SetCoins(economy.Coins);
        }

        // ---------------------------------------------------------------- shop

        public void OpenShop(ShopTab startTab = ShopTab.Coins)
        {
            tab = startTab;
            telemetry.Log("shop_open", "tab=" + tab);
            view.ShowShop();
            RefreshShop();
        }

        private void CloseShop()
        {
            view.HideShop();
            RefreshCoins();
            if (ShopClosed != null) ShopClosed();
        }

        private void RefreshShop()
        {
            view.RefreshShop(economy, tab, economy.AdsRemainingToday(Today), economy.CanOfferRewardedAd(Today, Now));
            RefreshCoins();
        }

        private void OnItemClicked(string itemId)
        {
            ShopItem item = ShopCatalog.Find(itemId);
            if (item == null) return;

            if (economy.IsOwned(itemId))
            {
                if (economy.Equip(itemId)) AppearanceApplied();
            }
            else if (economy.Coins < item.CoinPrice)
            {
                view.ShowModal("NOT ENOUGH COINS", item.Name + " costs " + item.CoinPrice + ". You have " + economy.Coins + ".\nEarn coins by playing levels, from the daily gift, or get a coin pack.",
                    "GET COINS", () => { tab = ShopTab.Coins; RefreshShop(); }, "CLOSE", null);
            }
            else if (economy.TryBuyWithCoins(itemId))
            {
                telemetry.Log("item_bought", "item=" + itemId + " price=" + item.CoinPrice);
                audio.Play(Sfx.Coin);
                economy.Equip(itemId);
                AppearanceApplied();
            }
            RefreshShop();
        }

        private void AppearanceApplied()
        {
            ApplyEquipped();
            if (AppearanceChanged != null) AppearanceChanged();
        }

        private void OnProductClicked(string productId)
        {
            if (!economy.CanBuyProduct(productId)) return;
            telemetry.Log("purchase_started", "product=" + productId + " test=1");
            store.Purchase(productId, ok =>
            {
                if (ok && economy.GrantProduct(productId))
                {
                    telemetry.Log("purchase_completed", "product=" + productId + " test=1");
                    audio.Play(Sfx.Success);
                    ShopItem item = ShopCatalog.FindByProduct(productId);
                    if (item != null && item.ItemsGranted.Length > 0)
                    {
                        foreach (string granted in item.ItemsGranted) economy.Equip(granted);
                        AppearanceApplied();
                    }
                    ui.ShowToast("Thank you! (test purchase)", 2f);
                }
                RefreshShop();
            });
        }

        private void OnFreeCoins()
        {
            if (!economy.CanOfferRewardedAd(Today, Now))
            {
                view.ShowModal("COME BACK LATER", economy.AdsRemainingToday(Today) <= 0
                    ? "That is all the free coins for today. Tomorrow there are more!"
                    : "Please wait a moment before the next one.", "OK", null);
                return;
            }
            ShowAd("shop", () =>
            {
                economy.AddCoins(EconomyConfig.FreeCoinsAdReward);
                audio.Play(Sfx.Coin);
                RefreshShop();
            });
        }

        // ---------------------------------------------------------------- rewarded ad flow

        private void ShowAd(string placement, Action onReward)
        {
            telemetry.Log("ad_offered", "placement=" + placement + " test=1");
            ads.Show(rewarded =>
            {
                if (rewarded)
                {
                    economy.RegisterAdWatched(Today, Now);
                    telemetry.Log("ad_completed", "placement=" + placement + " test=1");
                    onReward();
                }
                else
                {
                    telemetry.Log("ad_skipped", "placement=" + placement);
                }
            });
        }

        public bool CanOfferAd()
        {
            return economy.CanOfferRewardedAd(Today, Now);
        }

        /// <summary>The success card's optional "double the coins" button.</summary>
        public void OfferDoubleCoins(int coins, Action<int> onDoubled)
        {
            if (coins <= 0 || !CanOfferAd()) return;
            ShowAd("double_coins", () =>
            {
                economy.AddCoins(coins);
                audio.Play(Sfx.Coin);
                RefreshCoins();
                onDoubled(coins);
            });
        }

        // ---------------------------------------------------------------- hints

        /// <summary>
        /// A hint costs coins, or one optional test ad when the player has too few. Nothing is charged
        /// when there is nothing to hint at.
        /// </summary>
        public void RequestHint(bool hintAvailable, Action showHint)
        {
            if (!hintAvailable)
            {
                ui.ShowToast("Everything looks right. Press RUN!", 2f);
                return;
            }

            if (economy.TrySpend(EconomyConfig.HintCost))
            {
                telemetry.Log("hint_used", "paid=coins");
                RefreshCoins();
                showHint();
                return;
            }

            if (CanOfferAd())
            {
                view.ShowModal("NEED A HINT?", "A hint costs " + EconomyConfig.HintCost + " coins and you have " + economy.Coins + ".\nWatch a short test ad for a free hint?",
                    "WATCH AD", () => ShowAd("hint", () =>
                    {
                        telemetry.Log("hint_used", "paid=ad");
                        showHint();
                    }), "NO THANKS", null);
            }
            else
            {
                view.ShowModal("NOT ENOUGH COINS", "A hint costs " + EconomyConfig.HintCost + " coins.\nYou earn coins by finishing levels and with the daily gift.",
                    "SHOP", () => OpenShop(), "CLOSE", null);
            }
        }

        // ---------------------------------------------------------------- daily gift and nudges

        public bool DailyAvailable
        {
            get { return economy.DailyAvailable(Today); }
        }

        public void ShowDailyGift()
        {
            if (!DailyAvailable) return;
            int streak = economy.NextStreak(Today);
            int coins = economy.NextDailyReward(Today);
            int day = (streak - 1) % EconomyConfig.DailyRewards.Length + 1;
            view.ShowModal("DAILY GIFT", "Day " + day + " of " + EconomyConfig.DailyRewards.Length + "\n+" + coins + " coins\nCome back tomorrow for more!",
                "CLAIM", () =>
                {
                    int granted = economy.ClaimDaily(Today);
                    telemetry.Log("daily_claimed", "streak=" + streak + " coins=" + granted);
                    audio.Play(Sfx.Coin);
                    RefreshCoins();
                    ui.SetShopBadge(HasShopNews());
                });
        }

        /// <summary>A gentle reminder after a level when the player can already afford something new.</summary>
        public string ShopNudge()
        {
            ShopItem best = AffordableCosmetic();
            return best == null ? null : "You can afford " + best.Name + " in the shop!";
        }

        public bool HasShopNews()
        {
            return DailyAvailable || AffordableCosmetic() != null;
        }

        private ShopItem AffordableCosmetic()
        {
            ShopItem best = null;
            foreach (ShopItem item in ShopCatalog.All)
            {
                if ((item.Kind != ItemKind.Theme && item.Kind != ItemKind.Parcel) || item.CoinPrice <= 0 || economy.IsOwned(item.Id)) continue;
                if (economy.Coins >= item.CoinPrice && (best == null || item.CoinPrice < best.CoinPrice)) best = item;
            }
            return best;
        }

        public void RefreshBadges()
        {
            RefreshCoins();
            ui.SetShopBadge(HasShopNews());
        }
    }
}
