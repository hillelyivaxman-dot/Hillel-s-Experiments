using UnityEngine;

namespace FlowFactory
{
    /// <summary>Keeps a full-stretch RectTransform inside Screen.safeArea (notches, camera cut-outs, gesture bars).</summary>
    [RequireComponent(typeof(RectTransform))]
    public sealed class SafeAreaFitter : MonoBehaviour
    {
        private Rect lastSafeArea;
        private Vector2Int lastScreen;

        private void OnEnable()
        {
            Apply();
        }

        private void Update()
        {
            if (Screen.safeArea != lastSafeArea || lastScreen.x != Screen.width || lastScreen.y != Screen.height)
            {
                Apply();
            }
        }

        private void Apply()
        {
            Rect safe = Screen.safeArea;
            lastSafeArea = safe;
            lastScreen = new Vector2Int(Screen.width, Screen.height);
            if (Screen.width <= 0 || Screen.height <= 0)
            {
                return;
            }

            var rect = (RectTransform)transform;
            rect.anchorMin = new Vector2(safe.xMin / Screen.width, safe.yMin / Screen.height);
            rect.anchorMax = new Vector2(safe.xMax / Screen.width, safe.yMax / Screen.height);
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
        }
    }
}
