using System;

namespace FlowFactory.Core
{
    /// <summary>
    /// Planning placeholder for a later version. Version 0.1 contains NO ad SDK and no implementation of
    /// this interface; any rewarded ad must be optional, shown only after a level, and never required to progress.
    /// </summary>
    public interface IRewardedAdService
    {
        bool IsReady { get; }

        /// <summary>Shows a rewarded ad the player asked for; reports whether the reward was earned.</summary>
        void Show(Action<bool> onCompleted);
    }
}
