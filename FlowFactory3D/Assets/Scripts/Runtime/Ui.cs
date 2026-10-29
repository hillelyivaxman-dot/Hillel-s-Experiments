using UnityEngine;
using UnityEngine.Events;
using UnityEngine.UI;

namespace FlowFactory
{
    /// <summary>Tiny helpers for building uGUI by code. Layout is in a 1080x1920 reference space.</summary>
    public static class Ui
    {
        public static readonly Color Panel = new Color(0.13f, 0.17f, 0.27f, 0.96f);
        public static readonly Color Primary = new Color(0.20f, 0.65f, 0.40f);
        public static readonly Color Secondary = new Color(0.25f, 0.34f, 0.55f);
        public static readonly Color Danger = new Color(0.75f, 0.28f, 0.28f);
        public static readonly Color Disabled = new Color(0.22f, 0.25f, 0.32f);
        public static readonly Color TextColor = new Color(0.96f, 0.97f, 1f);
        public static readonly Color TextDim = new Color(0.70f, 0.76f, 0.88f);

        private static Font font;

        public static Font DefaultFont
        {
            get
            {
                if (font == null)
                {
                    font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                }
                if (font == null)
                {
                    font = Font.CreateDynamicFontFromOSFont("Arial", 32);
                }
                return font;
            }
        }

        public static RectTransform NewRect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rect = (RectTransform)go.transform;
            rect.SetParent(parent, false);
            return rect;
        }

        public static void Stretch(RectTransform rect)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
        }

        /// <summary>Anchors to a point of the parent (0-1) and sets a pixel size and offset from that point.</summary>
        public static void Place(RectTransform rect, Vector2 anchor, Vector2 size, Vector2 offset)
        {
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.sizeDelta = size;
            rect.anchoredPosition = offset;
        }

        /// <summary>Like Place but the pivot stays centred (offset is from the anchor to the rect's centre).</summary>
        public static void PlaceCentered(RectTransform rect, Vector2 anchor, Vector2 size, Vector2 offset)
        {
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.sizeDelta = size;
            rect.anchoredPosition = offset;
        }

        public static Image NewImage(string name, Transform parent, Color color)
        {
            RectTransform rect = NewRect(name, parent);
            var image = rect.gameObject.AddComponent<Image>();
            image.color = color;
            image.raycastTarget = false;
            return image;
        }

        public static Text NewLabel(string name, Transform parent, string text, int size, Color color, TextAnchor anchor = TextAnchor.MiddleCenter, FontStyle style = FontStyle.Bold)
        {
            RectTransform rect = NewRect(name, parent);
            var label = rect.gameObject.AddComponent<Text>();
            label.font = DefaultFont;
            label.text = text;
            label.fontSize = size;
            label.fontStyle = style;
            label.color = color;
            label.alignment = anchor;
            label.horizontalOverflow = HorizontalWrapMode.Wrap;
            label.verticalOverflow = VerticalWrapMode.Truncate;
            label.resizeTextForBestFit = true;
            label.resizeTextMinSize = Mathf.Max(18, size / 2);
            label.resizeTextMaxSize = size;
            label.raycastTarget = false;
            return label;
        }

        public static Button NewButton(string name, Transform parent, string text, Color fill, int fontSize, UnityAction onClick)
        {
            RectTransform rect = NewRect(name, parent);
            var image = rect.gameObject.AddComponent<Image>();
            image.color = fill;
            var button = rect.gameObject.AddComponent<Button>();
            button.targetGraphic = image;

            ColorBlock colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1.1f, 1.1f, 1.1f);
            colors.pressedColor = new Color(0.78f, 0.78f, 0.78f);
            colors.disabledColor = new Color(0.6f, 0.6f, 0.6f);
            button.colors = colors;

            Text label = NewLabel("Label", rect, text, fontSize, TextColor);
            Stretch(label.rectTransform);
            label.rectTransform.offsetMin = new Vector2(12f, 8f);
            label.rectTransform.offsetMax = new Vector2(-12f, -8f);

            if (onClick != null) button.onClick.AddListener(onClick);
            return button;
        }

        public static void SetText(Button button, string text)
        {
            button.GetComponentInChildren<Text>().text = text;
        }

        public static void SetFill(Button button, Color fill)
        {
            ((Image)button.targetGraphic).color = fill;
        }
    }
}
