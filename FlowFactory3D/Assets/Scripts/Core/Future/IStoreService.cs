using System;

namespace FlowFactory.Core
{
    /// <summary>
    /// Real-money purchases. The game talks only to this interface. The project ships with a clearly labelled
    /// TEST implementation (no money, no store); a real one (for example Unity IAP) must be written against
    /// the developer's own store accounts, product ids and privacy setup before any release.
    /// </summary>
    public interface IStoreService
    {
        bool IsReady { get; }

        /// <summary>Localized price text for a product, or null if unknown.</summary>
        string PriceFor(string productId);

        /// <summary>Starts a purchase the player asked for; reports whether it completed.</summary>
        void Purchase(string productId, Action<bool> onCompleted);
    }
}
