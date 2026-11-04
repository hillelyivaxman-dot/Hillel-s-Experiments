using System;
using FlowFactory.Core;

namespace FlowFactory
{
    /// <summary>
    /// TEST rewarded ad: shows a fake countdown screen. No SDK, no network. Replace with a real
    /// IRewardedAdService (for example LevelPlay) once the developer has ad accounts and a privacy review.
    /// </summary>
    public sealed class SimulatedAdService : IRewardedAdService
    {
        private readonly MonetizationUi ui;

        public SimulatedAdService(MonetizationUi ui)
        {
            this.ui = ui;
        }

        public bool IsReady
        {
            get { return true; }
        }

        public void Show(Action<bool> onCompleted)
        {
            ui.ShowTestAd(onCompleted);
        }
    }

    /// <summary>
    /// TEST store: asks for confirmation in a dialog that says no real money is involved, then reports success.
    /// Replace with a real IStoreService (for example Unity IAP) with the developer's own store products.
    /// </summary>
    public sealed class SimulatedStoreService : IStoreService
    {
        private readonly MonetizationUi ui;

        public SimulatedStoreService(MonetizationUi ui)
        {
            this.ui = ui;
        }

        public bool IsReady
        {
            get { return true; }
        }

        public string PriceFor(string productId)
        {
            ShopItem item = ShopCatalog.FindByProduct(productId);
            return item != null ? item.DisplayPrice : null;
        }

        public void Purchase(string productId, Action<bool> onCompleted)
        {
            ShopItem item = ShopCatalog.FindByProduct(productId);
            if (item == null)
            {
                onCompleted(false);
                return;
            }
            ui.ShowModal("TEST PURCHASE", item.Name + " for " + item.DisplayPrice + "\n(simulated: no real money is charged)",
                "BUY", () => onCompleted(true), "CANCEL", () => onCompleted(false));
        }
    }
}
