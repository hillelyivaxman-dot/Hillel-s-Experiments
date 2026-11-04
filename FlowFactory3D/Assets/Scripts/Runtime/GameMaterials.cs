using System.Collections.Generic;
using UnityEngine;

namespace FlowFactory
{
    /// <summary>Colour (and optionally textured) materials, one shared instance per combination.</summary>
    public static class GameMaterials
    {
        private static Shader shader;
        private static Shader groundShader;
        private static readonly Dictionary<string, Material> Cache = new Dictionary<string, Material>();

        public static Material Get(Color color)
        {
            return Get(color, TextureKind.None, Vector2.one);
        }

        public static Material Get(Color color, TextureKind texture, Vector2 tiling)
        {
            Color32 c = color;
            string key = c.r + "," + c.g + "," + c.b + "," + texture + "," + tiling.x.ToString("0.##") + "," + tiling.y.ToString("0.##");
            Material material;
            if (Cache.TryGetValue(key, out material) && material != null)
            {
                return material;
            }

            material = new Material(FindShader()) { name = "FF_" + key };
            material.color = color;
            if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
            Texture2D tex = ProceduralTextures.Get(texture);
            if (tex != null && material.HasProperty("_MainTex"))
            {
                material.mainTexture = tex;
                material.mainTextureScale = tiling;
            }
            Cache[key] = material;
            return material;
        }

        /// <summary>The factory floor material (tiled texture with a bright centre and dark edges).</summary>
        public static Material GetGround()
        {
            Material material;
            if (Cache.TryGetValue("ground", out material) && material != null)
            {
                return material;
            }

            if (groundShader == null)
            {
                groundShader = Resources.Load<Shader>("Shaders/FlowFactoryGround");
            }
            if (groundShader != null && groundShader.isSupported)
            {
                material = new Material(groundShader) { name = "FF_Ground" };
                material.SetColor("_Inner", Palette.GroundInner);
                material.SetColor("_Outer", Palette.GroundOuter);
                material.SetFloat("_Radius", 11f);
                material.SetTexture("_MainTex", ProceduralTextures.Get(TextureKind.Grid));
            }
            else
            {
                material = Get(Palette.GroundInner);
            }
            Cache["ground"] = material;
            return material;
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
            return Create(type, parent, localPosition, localScale, GameMaterials.Get(color), Quaternion.identity, name);
        }

        public static GameObject Create(PrimitiveType type, Transform parent, Vector3 localPosition, Vector3 localScale, Color color,
            TextureKind texture, Vector2 tiling, string name = null)
        {
            return Create(type, parent, localPosition, localScale, GameMaterials.Get(color, texture, tiling), Quaternion.identity, name);
        }

        public static GameObject Create(PrimitiveType type, Transform parent, Vector3 localPosition, Vector3 localScale, Material material,
            Quaternion rotation, string name = null)
        {
            var go = new GameObject(name ?? type.ToString());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPosition;
            go.transform.localRotation = rotation;
            go.transform.localScale = localScale;
            go.AddComponent<MeshFilter>().sharedMesh = GetMesh(type);
            var meshRenderer = go.AddComponent<MeshRenderer>();
            meshRenderer.sharedMaterial = material;
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
        // Warm "toy factory" palette: cream floor plates on a teal slab, coral machines, amber parcels.
        public static readonly Color Background = new Color(0.05f, 0.10f, 0.14f);
        public static readonly Color GroundInner = new Color(0.24f, 0.40f, 0.46f);
        public static readonly Color GroundOuter = new Color(0.04f, 0.09f, 0.12f);
        public static readonly Color FloorLight = new Color(0.97f, 0.93f, 0.84f);
        public static readonly Color FloorDark = new Color(0.88f, 0.83f, 0.73f);
        public static readonly Color Slab = new Color(0.10f, 0.25f, 0.31f);
        public static readonly Color SlabBase = new Color(0.07f, 0.17f, 0.22f);
        public static readonly Color Frame = new Color(0.17f, 0.19f, 0.23f);
        public static readonly Color BeltFixed = new Color(0.36f, 0.38f, 0.43f);
        public static readonly Color BeltRotatable = new Color(0.10f, 0.58f, 0.78f);
        public static readonly Color RailFixed = new Color(0.62f, 0.64f, 0.68f);
        public static readonly Color RailRotatable = new Color(1.00f, 0.80f, 0.20f);
        public static readonly Color Knob = new Color(1.00f, 0.50f, 0.15f);
        public static readonly Color KnobHandle = new Color(1.00f, 0.95f, 0.85f);
        public static readonly Color Source = new Color(0.92f, 0.38f, 0.30f);
        public static readonly Color SourceStripe = new Color(0.98f, 0.92f, 0.85f);
        public static readonly Color Target = new Color(0.20f, 0.72f, 0.58f);
        public static readonly Color TargetWall = new Color(0.55f, 0.92f, 0.80f);
        public static readonly Color TargetGlow = new Color(1.00f, 0.86f, 0.30f);
        public static readonly Color Crate = new Color(0.78f, 0.55f, 0.32f);
        public static readonly Color CrateFrame = new Color(0.42f, 0.28f, 0.16f);
        public static readonly Color Parcel = new Color(0.96f, 0.64f, 0.18f);
        public static readonly Color ParcelTape = new Color(0.98f, 0.92f, 0.78f);
        public static readonly Color ParcelLabel = new Color(0.99f, 0.99f, 0.97f);
        public static readonly Color FlashFail = new Color(0.92f, 0.22f, 0.22f);
        public static readonly Color FlashOk = new Color(0.30f, 0.90f, 0.45f);
        public static readonly Color Hint = new Color(1.00f, 0.92f, 0.25f);
        public static readonly Color Lamp = new Color(1.00f, 0.88f, 0.45f);
        public static readonly Color Barrel = new Color(0.85f, 0.32f, 0.28f);
        public static readonly Color BarrelTeal = new Color(0.16f, 0.55f, 0.62f);
        public static readonly Color Metal = new Color(0.55f, 0.60f, 0.66f);
    }
}
