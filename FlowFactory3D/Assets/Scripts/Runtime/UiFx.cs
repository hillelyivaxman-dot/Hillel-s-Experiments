using System.Collections;
using UnityEngine;
using UnityEngine.EventSystems;

namespace FlowFactory
{
    /// <summary>Squashes a button a little while it is pressed and lets it spring back.</summary>
    public sealed class ButtonJuice : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
    {
        private const float PressedScale = 0.93f;

        private RectTransform rect;
        private float current = 1f;
        private float target = 1f;
        private float velocity;

        private void Awake()
        {
            rect = (RectTransform)transform;
        }

        private void OnDisable()
        {
            current = target = 1f;
            velocity = 0f;
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            target = PressedScale;
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            target = 1f;
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            target = 1f;
        }

        private void Update()
        {
            if (Mathf.Approximately(current, target) && Mathf.Abs(velocity) < 0.001f)
            {
                return;
            }

            // A damped spring: quick squash, small overshoot on release.
            float dt = Mathf.Min(Time.unscaledDeltaTime, 0.05f);
            velocity += (target - current) * 320f * dt;
            velocity *= Mathf.Exp(-14f * dt);
            current += velocity * dt;
            if (Mathf.Abs(target - current) < 0.002f && Mathf.Abs(velocity) < 0.02f)
            {
                current = target;
                velocity = 0f;
            }
            rect.localScale = new Vector3(current, current, 1f);
        }
    }

    /// <summary>Fades a screen in (and optionally pops it up slightly) each time it is shown.</summary>
    [RequireComponent(typeof(CanvasGroup))]
    public sealed class ScreenFx : MonoBehaviour
    {
        public bool Pop;

        private CanvasGroup group;

        private void Awake()
        {
            group = GetComponent<CanvasGroup>();
        }

        private void OnEnable()
        {
            if (group == null) group = GetComponent<CanvasGroup>();
            StartCoroutine(Play());
        }

        private IEnumerator Play()
        {
            const float seconds = 0.22f;
            var rect = (RectTransform)transform;
            for (float t = 0f; t < seconds; t += Time.unscaledDeltaTime)
            {
                float k = Mathf.SmoothStep(0f, 1f, t / seconds);
                group.alpha = k;
                if (Pop)
                {
                    float s = 0.92f + 0.08f * k + 0.03f * Mathf.Sin(k * Mathf.PI);
                    rect.localScale = new Vector3(s, s, 1f);
                }
                yield return null;
            }
            group.alpha = 1f;
            rect.localScale = Vector3.one;
        }
    }
}
