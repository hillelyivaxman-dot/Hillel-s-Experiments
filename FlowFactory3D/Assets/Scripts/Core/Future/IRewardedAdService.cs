using System;

namespace FlowFactory.Core
{
    /// <summary>
    /// Rewarded ads. The game talks only to this interface. The project ships with a clearly labelled TEST
    /// implementation (a fake 3-second screen, no SDK, no network); a real one (for example Unity LevelPlay) must
    /// use the developer's own ad accounts, Test Ads while developing, and a privacy/age-policy review.
    /// Rules the game follows: ads are always optional extras the player taps, never shown during a puzzle and
    /// never required to progress.
    /// </summary>
    public interface IRewardedAdService
    {
        bool IsReady { get; }

        /// <summary>Shows a rewarded ad the player asked for; reports whether the reward was earned.</summary>
        void Show(Action<bool> onCompleted);
    }
}
