using System.Collections.Generic;
using UnityEngine;

namespace FlowFactory
{
    public enum TextureKind
    {
        None,
        Panel,
        Rollers,
        RollersH,
        Wood,
        Hazard,
        Grid,
        Blob
    }

    /// <summary>Small textures drawn in code (no image files), created once and cached.</summary>
    public static class ProceduralTextures
    {
        private const int Size = 64;
        private static readonly Dictionary<TextureKind, Texture2D> Cache = new Dictionary<TextureKind, Texture2D>();

        public static Texture2D Get(TextureKind kind)
        {
            if (kind == TextureKind.None)
            {
                return null;
            }
            Texture2D texture;
            if (Cache.TryGetValue(kind, out texture) && texture != null)
            {
                return texture;
            }

            texture = new Texture2D(Size, Size, TextureFormat.RGBA32, true)
            {
                name = "FF_" + kind,
                wrapMode = TextureWrapMode.Repeat,
                filterMode = FilterMode.Bilinear,
                anisoLevel = 2
            };
            var pixels = new Color[Size * Size];
            for (int y = 0; y < Size; y++)
            {
                for (int x = 0; x < Size; x++)
                {
                    float u = (x + 0.5f) / Size;
                    float v = (y + 0.5f) / Size;
                    pixels[y * Size + x] = Sample(kind, x, y, u, v);
                }
            }
            texture.SetPixels(pixels);
            texture.Apply(true);
            Cache[kind] = texture;
            return texture;
        }

        private static Color Gray(float v)
        {
            return new Color(v, v, v, 1f);
        }

        /// <summary>Deterministic pseudo noise in 0..1 so textures look the same on every run.</summary>
        private static float Noise(int x, int y, int seed)
        {
            unchecked
            {
                uint h = (uint)(x * 374761393 + y * 668265263 + seed * 144665);
                h = (h ^ (h >> 13)) * 1274126177u;
                return ((h ^ (h >> 16)) & 1023u) / 1023f;
            }
        }

        private static Color Sample(TextureKind kind, int x, int y, float u, float v)
        {
            switch (kind)
            {
                case TextureKind.Panel:
                {
                    // Metal floor plate: bevelled edge, inner groove, four rivets, light speckle.
                    float edge = Mathf.Min(Mathf.Min(u, 1f - u), Mathf.Min(v, 1f - v));
                    float value = 0.96f + (Noise(x, y, 1) - 0.5f) * 0.05f;
                    if (edge < 0.04f) value = 0.62f;
                    else if (edge < 0.08f) value = 1.0f;
                    else if (edge < 0.11f) value = 0.80f;
                    float rivet = Mathf.Min(Vector2.Distance(new Vector2(u, v), new Vector2(0.2f, 0.2f)),
                        Mathf.Min(Vector2.Distance(new Vector2(u, v), new Vector2(0.8f, 0.2f)),
                        Mathf.Min(Vector2.Distance(new Vector2(u, v), new Vector2(0.2f, 0.8f)),
                                  Vector2.Distance(new Vector2(u, v), new Vector2(0.8f, 0.8f)))));
                    if (rivet < 0.045f) value *= 0.72f;
                    return Gray(value);
                }
                case TextureKind.Rollers:
                case TextureKind.RollersH:
                {
                    // Belt surface: transverse rollers with a bright ridge and a dark gap.
                    // Rollers varies along v, RollersH along u (for belts that run along the other axis).
                    float t = Mathf.Repeat((kind == TextureKind.Rollers ? v : u) * 4f, 1f);
                    float value = t < 0.12f ? 0.55f : 0.78f + 0.22f * Mathf.Sin(t * Mathf.PI);
                    return Gray(value + (Noise(x, y, 2) - 0.5f) * 0.04f);
                }
                case TextureKind.Wood:
                {
                    // Vertical planks with grain.
                    float plank = Mathf.Repeat(u * 3f, 1f);
                    float value = plank < 0.06f ? 0.50f : 0.86f + (Noise(x / 2, y * 3, 3) - 0.5f) * 0.18f;
                    return Gray(value);
                }
                case TextureKind.Hazard:
                {
                    // Orange and graphite diagonal warning stripes (colours baked in).
                    bool orange = Mathf.Repeat((u + v) * 4f, 1f) < 0.5f;
                    return orange ? new Color(1f, 0.62f, 0.14f, 1f) : new Color(0.16f, 0.18f, 0.22f, 1f);
                }
                case TextureKind.Grid:
                {
                    // Factory floor: faint tiles with joints.
                    float edge = Mathf.Min(Mathf.Min(u, 1f - u), Mathf.Min(v, 1f - v));
                    float value = edge < 0.02f ? 0.78f : 0.94f + (Noise(x, y, 4) - 0.5f) * 0.08f;
                    return Gray(value);
                }
                case TextureKind.Blob:
                {
                    // Radial falloff in the alpha channel: a soft round contact shadow.
                    float d = Mathf.Clamp01(Vector2.Distance(new Vector2(u, v), new Vector2(0.5f, 0.5f)) * 2f);
                    float alpha = Mathf.Pow(1f - d, 1.6f);
                    return new Color(1f, 1f, 1f, alpha);
                }
            }
            return Color.white;
        }
    }
}
