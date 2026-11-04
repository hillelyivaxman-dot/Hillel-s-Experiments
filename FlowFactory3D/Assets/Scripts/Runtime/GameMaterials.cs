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

        /// <summary>Soft contact shadow material (alpha blended). Falls back to a plain dark material if unsupported.</summary>
        public static Material GetBlobShadow()
        {
            Material material;
            if (Cache.TryGetValue("blob", out material) && material != null)
            {
                return material;
            }

            Shader blob = Resources.Load<Shader>("Shaders/FlowFactoryBlob");
            if (blob != null && blob.isSupported)
            {
                material = new Material(blob) { name = "FF_Blob" };
                material.SetColor("_Color", new Color(0f, 0f, 0f, 0.42f));
                material.SetTexture("_MainTex", ProceduralTextures.Get(TextureKind.Blob));
            }
            else
            {
                material = null; // callers skip the shadow when there is no blend shader
            }
            Cache["blob"] = material;
            return material;
        }

        /// <summary>Re-reads the ground colours after the theme changed.</summary>
        public static void RefreshGround()
        {
            Material material;
            if (Cache.TryGetValue("ground", out material) && material != null && material.HasProperty("_Inner"))
            {
                material.SetColor("_Inner", Palette.GroundInner);
                material.SetColor("_Outer", Palette.GroundOuter);
            }
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

        private static bool? meshesReadable;
        private static Vector2? topUvSigns;

        /// <summary>
        /// True when the built-in primitive meshes can be read on the CPU (needed to merge meshes at runtime).
        /// If not, the game simply keeps one object per part.
        /// </summary>
        public static bool MeshesReadable
        {
            get
            {
                if (!meshesReadable.HasValue)
                {
                    meshesReadable = GetMesh(PrimitiveType.Cube).isReadable && GetMesh(PrimitiveType.Cylinder).isReadable && GetMesh(PrimitiveType.Sphere).isReadable;
                }
                return meshesReadable.Value;
            }
        }

        /// <summary>
        /// Direction in which the cube's top-face texture coordinates grow: x = sign of du/dx, y = sign of dv/dz.
        /// Measured from the mesh so scrolling belts always move the right way; (1, 1) if the mesh is unreadable.
        /// </summary>
        public static Vector2 CubeTopUvSigns
        {
            get
            {
                if (!topUvSigns.HasValue)
                {
                    Vector2 result = Vector2.one;
                    Mesh cube = GetMesh(PrimitiveType.Cube);
                    if (cube.isReadable)
                    {
                        Vector3[] vertices = cube.vertices;
                        Vector3[] normals = cube.normals;
                        Vector2[] uvs = cube.uv;
                        int minX = -1, maxX = -1, minZ = -1, maxZ = -1;
                        for (int i = 0; i < vertices.Length && i < normals.Length && i < uvs.Length; i++)
                        {
                            if (normals[i].y < 0.9f) continue;
                            if (minX < 0 || vertices[i].x < vertices[minX].x) minX = i;
                            if (maxX < 0 || vertices[i].x > vertices[maxX].x) maxX = i;
                            if (minZ < 0 || vertices[i].z < vertices[minZ].z) minZ = i;
                            if (maxZ < 0 || vertices[i].z > vertices[maxZ].z) maxZ = i;
                        }
                        if (minX >= 0)
                        {
                            float du = uvs[maxX].x - uvs[minX].x;
                            float dv = uvs[maxZ].y - uvs[minZ].y;
                            result = new Vector2(du < 0f ? -1f : 1f, dv < 0f ? -1f : 1f);
                        }
                    }
                    topUvSigns = result;
                }
                return topUvSigns.Value;
            }
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
        public static Color GroundInner = new Color(0.24f, 0.40f, 0.46f);
        public static Color GroundOuter = new Color(0.04f, 0.09f, 0.12f);
        public static Color FloorLight = new Color(0.97f, 0.93f, 0.84f);
        public static Color FloorDark = new Color(0.88f, 0.83f, 0.73f);
        public static Color Slab = new Color(0.10f, 0.25f, 0.31f);
        public static Color SlabBase = new Color(0.07f, 0.17f, 0.22f);
        public static readonly Color Frame = new Color(0.17f, 0.19f, 0.23f);
        public static readonly Color BeltFixed = new Color(0.36f, 0.38f, 0.43f);
        public static Color BeltRotatable = new Color(0.10f, 0.58f, 0.78f);
        public static readonly Color RailFixed = new Color(0.62f, 0.64f, 0.68f);
        public static Color RailRotatable = new Color(1.00f, 0.80f, 0.20f);
        public static readonly Color Knob = new Color(1.00f, 0.50f, 0.15f);
        public static readonly Color KnobHandle = new Color(1.00f, 0.95f, 0.85f);
        public static readonly Color Source = new Color(0.92f, 0.38f, 0.30f);
        public static readonly Color SourceStripe = new Color(0.98f, 0.92f, 0.85f);
        public static readonly Color Target = new Color(0.20f, 0.72f, 0.58f);
        public static readonly Color TargetWall = new Color(0.55f, 0.92f, 0.80f);
        public static readonly Color TargetGlow = new Color(1.00f, 0.86f, 0.30f);
        public static readonly Color Crate = new Color(0.78f, 0.55f, 0.32f);
        public static readonly Color CrateFrame = new Color(0.42f, 0.28f, 0.16f);
        public static Color Parcel = new Color(0.96f, 0.64f, 0.18f);
        public static Color ParcelTape = new Color(0.98f, 0.92f, 0.78f);
        public static readonly Color ParcelLabel = new Color(0.99f, 0.99f, 0.97f);
        public static readonly Color FlashFail = new Color(0.92f, 0.22f, 0.22f);
        public static readonly Color FlashOk = new Color(0.30f, 0.90f, 0.45f);
        public static readonly Color Hint = new Color(1.00f, 0.92f, 0.25f);
        public static Color Lamp = new Color(1.00f, 0.88f, 0.45f);
        public static readonly Color Barrel = new Color(0.85f, 0.32f, 0.28f);
        public static readonly Color BarrelTeal = new Color(0.16f, 0.55f, 0.62f);
        public static readonly Color Metal = new Color(0.55f, 0.60f, 0.66f);
    }
}
