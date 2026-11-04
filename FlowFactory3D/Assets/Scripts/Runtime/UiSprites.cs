using UnityEngine;

namespace FlowFactory
{
    /// <summary>Sprites drawn in code: a nine-sliceable rounded rectangle and a play triangle.</summary>
    public static class UiSprites
    {
        private const int Size = 64;
        private static Sprite rounded;
        private static Sprite triangle;

        public static Sprite Rounded
        {
            get
            {
                if (rounded == null)
                {
                    Texture2D texture = NewTexture("FF_Rounded");
                    const float radius = 22f;
                    var pixels = new Color[Size * Size];
                    for (int y = 0; y < Size; y++)
                    {
                        for (int x = 0; x < Size; x++)
                        {
                            // Distance to the rounded-rectangle outline (negative inside), anti-aliased over one pixel.
                            float dx = Mathf.Abs(x + 0.5f - Size * 0.5f) - (Size * 0.5f - radius);
                            float dy = Mathf.Abs(y + 0.5f - Size * 0.5f) - (Size * 0.5f - radius);
                            float outside = new Vector2(Mathf.Max(dx, 0f), Mathf.Max(dy, 0f)).magnitude + Mathf.Min(Mathf.Max(dx, dy), 0f) - radius;
                            pixels[y * Size + x] = new Color(1f, 1f, 1f, Mathf.Clamp01(0.5f - outside));
                        }
                    }
                    texture.SetPixels(pixels);
                    texture.Apply();
                    rounded = Sprite.Create(texture, new Rect(0, 0, Size, Size), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect, new Vector4(24f, 24f, 24f, 24f));
                }
                return rounded;
            }
        }

        public static Sprite Triangle
        {
            get
            {
                if (triangle == null)
                {
                    Texture2D texture = NewTexture("FF_Triangle");
                    var a = new Vector2(16f, 8f);
                    var b = new Vector2(16f, 56f);
                    var c = new Vector2(56f, 32f);
                    var pixels = new Color[Size * Size];
                    for (int y = 0; y < Size; y++)
                    {
                        for (int x = 0; x < Size; x++)
                        {
                            var p = new Vector2(x + 0.5f, y + 0.5f);
                            float d = Mathf.Min(Edge(a, b, c, p), Mathf.Min(Edge(b, c, a, p), Edge(c, a, b, p)));
                            pixels[y * Size + x] = new Color(1f, 1f, 1f, Mathf.Clamp01(d + 0.5f));
                        }
                    }
                    texture.SetPixels(pixels);
                    texture.Apply();
                    triangle = Sprite.Create(texture, new Rect(0, 0, Size, Size), new Vector2(0.5f, 0.5f), 100f);
                }
                return triangle;
            }
        }

        /// <summary>Signed distance of p to the edge a-b, positive on the side of the third corner.</summary>
        private static float Edge(Vector2 a, Vector2 b, Vector2 inside, Vector2 p)
        {
            Vector2 ab = b - a;
            Vector2 normal = new Vector2(-ab.y, ab.x).normalized;
            if (Vector2.Dot(normal, inside - a) < 0f) normal = -normal;
            return Vector2.Dot(normal, p - a);
        }

        private static Texture2D NewTexture(string name)
        {
            return new Texture2D(Size, Size, TextureFormat.RGBA32, false)
            {
                name = name,
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear
            };
        }
    }
}
