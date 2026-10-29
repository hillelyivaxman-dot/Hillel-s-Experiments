using UnityEngine;

namespace FlowFactory
{
    /// <summary>Small FPS read-out for device testing. Only exists in the editor and development builds.</summary>
    public sealed class FpsCounter : MonoBehaviour
    {
        public static bool Available
        {
            get { return Debug.isDebugBuild || Application.isEditor; }
        }

        public bool Visible = true;

        private float smoothed = 30f;
        private float worstFrame;
        private float windowStart;
        private float shown;
        private GUIStyle style;

        private void Update()
        {
            float dt = Time.unscaledDeltaTime;
            if (dt <= 0f) return;
            smoothed = Mathf.Lerp(smoothed, 1f / dt, 0.1f);
            worstFrame = Mathf.Max(worstFrame, dt);
            if (Time.unscaledTime - windowStart > 1f)
            {
                windowStart = Time.unscaledTime;
                shown = worstFrame * 1000f;
                worstFrame = 0f;
            }
        }

        private void OnGUI()
        {
            if (!Available || !Visible) return;
            if (style == null)
            {
                style = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.UpperRight, fontStyle = FontStyle.Bold };
                style.normal.textColor = Color.yellow;
            }
            style.fontSize = Mathf.Max(18, Screen.height / 70);
            Rect safe = Screen.safeArea;
            var rect = new Rect(safe.xMax - 320f, Screen.height - safe.yMax + 4f, 316f, style.fontSize * 2.4f);
            GUI.Label(rect, smoothed.ToString("0") + " FPS\nworst " + shown.ToString("0") + " ms", style);
        }
    }
}
