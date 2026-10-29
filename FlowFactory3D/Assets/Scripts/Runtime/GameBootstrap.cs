using UnityEngine;

namespace FlowFactory
{
    /// <summary>
    /// Starts the game in whatever scene is open, so pressing Play works even in an empty project scene.
    /// The generic game "scene" is built at runtime from level data; there is one app object, not 12 scenes.
    /// </summary>
    public static class GameBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Start()
        {
            if (Object.FindFirstObjectByType<FlowFactoryApp>() != null)
            {
                return;
            }
            new GameObject("FlowFactoryApp").AddComponent<FlowFactoryApp>();
        }
    }
}
