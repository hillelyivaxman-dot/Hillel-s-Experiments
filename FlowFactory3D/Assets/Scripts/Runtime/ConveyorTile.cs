using System.Collections;
using System.Collections.Generic;
using FlowFactory.Core;
using UnityEngine;

namespace FlowFactory
{
    /// <summary>
    /// The 3D look of one board tile, built from primitives. Pure presentation: whether a route works is
    /// decided by RouteValidator from the rotation data, never from this object.
    /// Local layout at rotation 0: straight runs north-south, corner opens north and east,
    /// source and target open to the north.
    /// </summary>
    public sealed class ConveyorTile : MonoBehaviour
    {
        private const float TurnSeconds = 0.14f;

        public TileKind Kind { get; private set; }
        public bool Rotatable { get; private set; }

        private Transform visual;
        private readonly List<MeshRenderer> renderers = new List<MeshRenderer>();
        private readonly List<Material> originals = new List<Material>();
        private float currentAngle;
        private float targetAngle;
        private float pulse;
        private Coroutine flashRoutine;

        public void Init(TileSpec spec, int rotation)
        {
            Kind = spec.kind;
            Rotatable = spec.rotatable;

            visual = new GameObject("Visual").transform;
            visual.SetParent(transform, false);

            switch (spec.kind)
            {
                case TileKind.Straight:
                    BuildBelt(false);
                    break;
                case TileKind.Corner:
                    BuildBelt(true);
                    break;
                case TileKind.Source:
                    BuildSource();
                    break;
                case TileKind.Target:
                    BuildTarget();
                    break;
                case TileKind.Block:
                    BuildCrate();
                    break;
            }

            foreach (MeshRenderer r in visual.GetComponentsInChildren<MeshRenderer>())
            {
                renderers.Add(r);
                originals.Add(r.sharedMaterial);
            }
            SnapTo(rotation);
        }

        /// <summary>Starts a smooth 90 degree clockwise turn.</summary>
        public void RotateStep()
        {
            targetAngle += 90f;
            pulse = 1f;
        }

        public void SnapTo(int rotation)
        {
            currentAngle = targetAngle = rotation * 90f;
            pulse = 0f;
            Apply();
        }

        public void Flash(Color color, float seconds)
        {
            if (flashRoutine != null) StopCoroutine(flashRoutine);
            flashRoutine = StartCoroutine(FlashRoutine(color, seconds));
        }

        private IEnumerator FlashRoutine(Color color, float seconds)
        {
            Material flash = GameMaterials.Get(color);
            for (int i = 0; i < renderers.Count; i++) renderers[i].sharedMaterial = flash;
            yield return new WaitForSeconds(seconds);
            for (int i = 0; i < renderers.Count; i++) renderers[i].sharedMaterial = originals[i];
            flashRoutine = null;
        }

        private void Update()
        {
            bool turning = !Mathf.Approximately(currentAngle, targetAngle);
            if (!turning && pulse <= 0f)
            {
                return;
            }

            currentAngle = Mathf.MoveTowards(currentAngle, targetAngle, 90f / TurnSeconds * Time.deltaTime);
            pulse = Mathf.Max(0f, pulse - Time.deltaTime / 0.25f);
            Apply();
        }

        private void Apply()
        {
            visual.localRotation = Quaternion.Euler(0f, currentAngle, 0f);
            float scale = 1f + 0.10f * Mathf.Sin(pulse * Mathf.PI);
            visual.localScale = new Vector3(scale, 1f, scale);
        }

        private void BuildBelt(bool corner)
        {
            Color belt = Rotatable ? Palette.BeltRotatable : Palette.BeltFixed;
            Color rail = Rotatable ? Palette.RailRotatable : Palette.RailFixed;

            AddArm(Vector3.forward, belt, rail);
            AddArm(corner ? Vector3.right : Vector3.back, belt, rail);
            if (corner)
            {
                Primitives.Create(PrimitiveType.Cube, visual, new Vector3(0f, 0.07f, 0f), new Vector3(0.48f, 0.08f, 0.48f), belt, "Joint");
            }
            if (Rotatable)
            {
                // A knob tells the player this belt can be turned.
                Primitives.Create(PrimitiveType.Cylinder, visual, new Vector3(0f, 0.15f, 0f), new Vector3(0.20f, 0.03f, 0.20f), Palette.Knob, "Knob");
            }
        }

        private void AddArm(Vector3 direction, Color belt, Color rail)
        {
            Vector3 side = Vector3.Cross(Vector3.up, direction);
            bool alongZ = Mathf.Abs(direction.z) > 0.5f;
            Vector3 beltScale = alongZ ? new Vector3(0.48f, 0.08f, 0.54f) : new Vector3(0.54f, 0.08f, 0.48f);
            Vector3 railScale = alongZ ? new Vector3(0.05f, 0.14f, 0.54f) : new Vector3(0.54f, 0.14f, 0.05f);

            Primitives.Create(PrimitiveType.Cube, visual, direction * 0.25f + Vector3.up * 0.07f, beltScale, belt, "Arm");
            Primitives.Create(PrimitiveType.Cube, visual, direction * 0.25f + side * 0.265f + Vector3.up * 0.09f, railScale, rail, "Rail");
            Primitives.Create(PrimitiveType.Cube, visual, direction * 0.25f - side * 0.265f + Vector3.up * 0.09f, railScale, rail, "Rail");
        }

        private void BuildSource()
        {
            Primitives.Create(PrimitiveType.Cube, visual, new Vector3(0f, 0.30f, -0.08f), new Vector3(0.72f, 0.52f, 0.62f), Palette.Source, "Machine");
            Primitives.Create(PrimitiveType.Cylinder, visual, new Vector3(0f, 0.62f, -0.08f), new Vector3(0.40f, 0.05f, 0.40f), new Color(0.12f, 0.45f, 0.26f), "Hatch");
            AddArm(Vector3.forward, Palette.BeltFixed, Palette.RailFixed);
        }

        private void BuildTarget()
        {
            // An open bin with a frame: the parcel disappears into it.
            Primitives.Create(PrimitiveType.Cube, visual, new Vector3(0f, 0.04f, 0f), new Vector3(0.80f, 0.08f, 0.80f), Palette.Target, "Pad");
            Primitives.Create(PrimitiveType.Cube, visual, new Vector3(0f, 0.09f, 0f), new Vector3(0.46f, 0.05f, 0.46f), new Color(0.08f, 0.14f, 0.30f), "Hole");
            Color wall = new Color(0.45f, 0.72f, 1f);
            Primitives.Create(PrimitiveType.Cube, visual, new Vector3(0f, 0.20f, -0.30f), new Vector3(0.64f, 0.28f, 0.07f), wall, "WallS");
            Primitives.Create(PrimitiveType.Cube, visual, new Vector3(-0.30f, 0.20f, 0f), new Vector3(0.07f, 0.28f, 0.54f), wall, "WallW");
            Primitives.Create(PrimitiveType.Cube, visual, new Vector3(0.30f, 0.20f, 0f), new Vector3(0.07f, 0.28f, 0.54f), wall, "WallE");
            Primitives.Create(PrimitiveType.Cube, visual, new Vector3(0f, 0.20f, 0.30f), new Vector3(0.64f, 0.12f, 0.07f), wall, "WallN");
        }

        private void BuildCrate()
        {
            Primitives.Create(PrimitiveType.Cube, visual, new Vector3(0f, 0.32f, 0f), new Vector3(0.72f, 0.62f, 0.72f), Palette.Crate, "Crate");
            Primitives.Create(PrimitiveType.Cube, visual, new Vector3(0f, 0.32f, 0f), new Vector3(0.76f, 0.12f, 0.76f), Palette.CrateBand, "Band");
            Primitives.Create(PrimitiveType.Cube, visual, new Vector3(0f, 0.32f, 0f), new Vector3(0.12f, 0.66f, 0.76f), Palette.CrateBand, "BandV");
        }
    }
}
