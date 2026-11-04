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

        // ------------------------------------------------------------ parts

        private GameObject Box(Vector3 position, Vector3 scale, Color color, string name, TextureKind texture = TextureKind.None, Vector2? tiling = null)
        {
            return Primitives.Create(PrimitiveType.Cube, visual, position, scale, color, texture, tiling ?? Vector2.one, name);
        }

        private GameObject Cylinder(Vector3 position, Vector3 scale, Color color, string name, Quaternion? rotation = null)
        {
            return Primitives.Create(PrimitiveType.Cylinder, visual, position, scale, GameMaterials.Get(color), rotation ?? Quaternion.identity, name);
        }

        private void BuildBelt(bool corner)
        {
            Color belt = Rotatable ? Palette.BeltRotatable : Palette.BeltFixed;
            Color rail = Rotatable ? Palette.RailRotatable : Palette.RailFixed;

            Vector3 second = corner ? Vector3.right : Vector3.back;
            // On a corner the rails facing the other arm are left out, otherwise they cross in the middle.
            AddArm(Vector3.forward, belt, rail, corner ? second : (Vector3?)null);
            AddArm(second, belt, rail, corner ? Vector3.forward : (Vector3?)null);

            if (corner)
            {
                // A round turntable where the two arms meet.
                Box(new Vector3(0f, 0.03f, 0f), new Vector3(0.58f, 0.06f, 0.58f), Palette.Frame, "Frame");
                Cylinder(new Vector3(0f, 0.09f, 0f), new Vector3(0.52f, 0.03f, 0.52f), belt, "Turntable");
                Cylinder(new Vector3(0f, 0.125f, 0f), new Vector3(0.30f, 0.01f, 0.30f), Color.Lerp(belt, Color.white, 0.25f), "TurntableCap");
            }
            if (Rotatable)
            {
                // A dial tells the player this belt can be turned.
                Cylinder(new Vector3(0f, 0.16f, 0f), new Vector3(0.22f, 0.03f, 0.22f), Palette.Knob, "Knob");
                Box(new Vector3(0f, 0.195f, 0f), new Vector3(0.16f, 0.02f, 0.05f), Palette.KnobHandle, "KnobHandle");
            }
        }

        private void AddArm(Vector3 direction, Color belt, Color rail, Vector3? skipRailToward = null)
        {
            Vector3 side = Vector3.Cross(Vector3.up, direction);
            bool alongZ = Mathf.Abs(direction.z) > 0.5f;
            Vector3 frameScale = alongZ ? new Vector3(0.58f, 0.06f, 0.54f) : new Vector3(0.54f, 0.06f, 0.58f);
            Vector3 beltScale = alongZ ? new Vector3(0.44f, 0.04f, 0.54f) : new Vector3(0.54f, 0.04f, 0.44f);
            Vector3 railScale = alongZ ? new Vector3(0.05f, 0.10f, 0.54f) : new Vector3(0.54f, 0.10f, 0.05f);

            Box(direction * 0.25f + Vector3.up * 0.03f, frameScale, Palette.Frame, "Frame");
            Box(direction * 0.25f + Vector3.up * 0.085f, beltScale, belt, "Belt", alongZ ? TextureKind.Rollers : TextureKind.RollersH);

            bool skipPositive = skipRailToward.HasValue && Vector3.Dot(side, skipRailToward.Value) > 0.5f;
            bool skipNegative = skipRailToward.HasValue && Vector3.Dot(side, skipRailToward.Value) < -0.5f;
            if (!skipPositive) Box(direction * 0.25f + side * 0.255f + Vector3.up * 0.10f, railScale, rail, "Rail");
            if (!skipNegative) Box(direction * 0.25f - side * 0.255f + Vector3.up * 0.10f, railScale, rail, "Rail");

            // A roller at the tile edge, so neighbouring belts look connected.
            Quaternion axis = alongZ ? Quaternion.Euler(0f, 0f, 90f) : Quaternion.Euler(90f, 0f, 0f);
            Cylinder(direction * 0.47f + Vector3.up * 0.085f, new Vector3(0.10f, 0.22f, 0.10f), Palette.Metal, "Roller", axis);
        }

        private void BuildSource()
        {
            Box(new Vector3(0f, 0.04f, 0f), new Vector3(0.86f, 0.08f, 0.86f), Palette.Frame, "Plinth", TextureKind.Panel);
            // Low and set back so the waiting parcel is not hidden behind the machine in the isometric view.
            Box(new Vector3(0f, 0.23f, -0.17f), new Vector3(0.68f, 0.30f, 0.44f), Palette.Source, "Machine");
            Box(new Vector3(0f, 0.30f, 0.055f), new Vector3(0.70f, 0.10f, 0.02f), Palette.SourceStripe, "Stripe");
            Cylinder(new Vector3(-0.2f, 0.50f, -0.30f), new Vector3(0.14f, 0.14f, 0.14f), Palette.Metal, "Chimney");
            Primitives.Create(PrimitiveType.Sphere, visual, new Vector3(0.2f, 0.42f, -0.28f), Vector3.one * 0.13f, Palette.Lamp, "Lamp");
            AddArm(Vector3.forward, Palette.BeltFixed, Palette.RailFixed);
        }

        private void BuildTarget()
        {
            // An open bin with a glowing drop zone: the parcel disappears into it.
            Box(new Vector3(0f, 0.04f, 0f), new Vector3(0.88f, 0.08f, 0.88f), Palette.Target, "Pad", TextureKind.Panel);
            Box(new Vector3(0f, 0.095f, 0f), new Vector3(0.46f, 0.03f, 0.46f), new Color(0.05f, 0.10f, 0.14f), "Hole");
            Cylinder(new Vector3(0f, 0.115f, 0f), new Vector3(0.34f, 0.01f, 0.34f), Palette.TargetGlow, "Glow");
            Color wall = Palette.TargetWall;
            Box(new Vector3(0f, 0.19f, -0.31f), new Vector3(0.66f, 0.22f, 0.06f), wall, "WallS");
            Box(new Vector3(-0.31f, 0.19f, 0f), new Vector3(0.06f, 0.22f, 0.56f), wall, "WallW");
            Box(new Vector3(0.31f, 0.19f, 0f), new Vector3(0.06f, 0.22f, 0.56f), wall, "WallE");
            Box(new Vector3(0f, 0.15f, 0.31f), new Vector3(0.66f, 0.10f, 0.06f), wall, "WallN");
            Cylinder(new Vector3(-0.34f, 0.36f, -0.34f), new Vector3(0.03f, 0.17f, 0.03f), Palette.Metal, "Pole");
            Box(new Vector3(-0.26f, 0.47f, -0.34f), new Vector3(0.16f, 0.10f, 0.02f), Palette.Knob, "Flag");
        }

        private void BuildCrate()
        {
            Box(new Vector3(0f, 0.31f, 0f), new Vector3(0.68f, 0.56f, 0.68f), Palette.Crate, "Crate", TextureKind.Wood);
            Color frame = Palette.CrateFrame;
            foreach (float sx in new[] { -0.35f, 0.35f })
            {
                foreach (float sz in new[] { -0.35f, 0.35f })
                {
                    Box(new Vector3(sx, 0.31f, sz), new Vector3(0.08f, 0.62f, 0.08f), frame, "Post");
                }
            }
            Box(new Vector3(0f, 0.60f, 0f), new Vector3(0.74f, 0.05f, 0.74f), frame, "Lid");
            Box(new Vector3(0f, 0.03f, 0f), new Vector3(0.74f, 0.06f, 0.74f), frame, "Foot");
        }
    }
}
