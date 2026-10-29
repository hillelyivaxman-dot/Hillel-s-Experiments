using System.Collections.Generic;
using UnityEngine;

namespace FlowFactory
{
    /// <summary>Colour materials, one shared instance per colour.</summary>
    public static class GameMaterials
    {
        private static Shader shader;
        private static readonly Dictionary<int, Material> Cache = new Dictionary<int, Material>();

        public static Material Get(Color color)
        {
            int key = Color32ToInt(color);
            Material material;
            if (Cache.TryGetValue(key, out material) && material != null)
            {
                return material;
            }

            material = new Material(FindShader()) { name = "FF_" + key.ToString("X8") };
            material.color = color;
            if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
            Cache[key] = material;
            return material;
        }

        private static int Color32ToInt(Color color)
        {
            Color32 c = color;
            return (c.r << 24) | (c.g << 16) | (c.b << 8) | c.a;
        }

        private static Shader FindShader()
        {
            if (shader != null)
            {
                return shader;
            }

            shader = Resources.Load<Shader>("Shaders/FlowFactoryToon");
            if (shader == null || !shader.isSupported)
            {
                string[] fallbacks = { "Universal Render Pipeline/Unlit", "Unlit/Color", "Standard", "Sprites/Default" };
                for (int i = 0; i < fallbacks.Length && (shader == null || !shader.isSupported); i++)
                {
                    shader = Shader.Find(fallbacks[i]);
                }
            }
            return shader;
        }
    }

    /// <summary>Builds simple renderer-only primitives (no colliders, no physics).</summary>
    public static class Primitives
    {
        private static readonly Dictionary<PrimitiveType, Mesh> Meshes = new Dictionary<PrimitiveType, Mesh>();

        public static GameObject Create(PrimitiveType type, Transform parent, Vector3 localPosition, Vector3 localScale, Color color, string name = null)
        {
            var go = new GameObject(name ?? type.ToString());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPosition;
            go.transform.localScale = localScale;
            go.AddComponent<MeshFilter>().sharedMesh = GetMesh(type);
            var meshRenderer = go.AddComponent<MeshRenderer>();
            meshRenderer.sharedMaterial = GameMaterials.Get(color);
            meshRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            meshRenderer.receiveShadows = false;
            return go;
        }

        private static Mesh GetMesh(PrimitiveType type)
        {
            Mesh mesh;
            if (Meshes.TryGetValue(type, out mesh) && mesh != null)
            {
                return mesh;
            }

            GameObject temp = GameObject.CreatePrimitive(type);
            mesh = temp.GetComponent<MeshFilter>().sharedMesh;
            Object.Destroy(temp);
            Meshes[type] = mesh;
            return mesh;
        }
    }

    public static class Palette
    {
        public static readonly Color Background = new Color(0.09f, 0.12f, 0.19f);
        public static readonly Color FloorLight = new Color(0.80f, 0.83f, 0.89f);
        public static readonly Color FloorDark = new Color(0.70f, 0.74f, 0.82f);
        public static readonly Color Slab = new Color(0.17f, 0.20f, 0.28f);
        public static readonly Color BeltFixed = new Color(0.30f, 0.32f, 0.37f);
        public static readonly Color BeltRotatable = new Color(0.16f, 0.45f, 0.80f);
        public static readonly Color RailFixed = new Color(0.50f, 0.52f, 0.57f);
        public static readonly Color RailRotatable = new Color(0.97f, 0.77f, 0.15f);
        public static readonly Color Knob = new Color(1.00f, 0.55f, 0.12f);
        public static readonly Color Source = new Color(0.20f, 0.72f, 0.42f);
        public static readonly Color Target = new Color(0.25f, 0.55f, 0.95f);
        public static readonly Color Crate = new Color(0.58f, 0.40f, 0.24f);
        public static readonly Color CrateBand = new Color(0.40f, 0.27f, 0.16f);
        public static readonly Color Parcel = new Color(0.96f, 0.64f, 0.18f);
        public static readonly Color ParcelTape = new Color(0.98f, 0.92f, 0.78f);
        public static readonly Color FlashFail = new Color(0.92f, 0.22f, 0.22f);
        public static readonly Color FlashOk = new Color(0.30f, 0.90f, 0.45f);
        public static readonly Color Hint = new Color(1.00f, 0.92f, 0.25f);
    }
}
