using System.Collections.Generic;
using FlowFactory.Core;
using UnityEngine;

namespace FlowFactory
{
    /// <summary>
    /// Creates and places the tiles of the current level and maps between grid coordinates, world
    /// positions and screen taps. World mapping: grid x -> world X, grid row y -> world -Z (north is +Z).
    /// </summary>
    public sealed class GridManager : MonoBehaviour
    {
        public const float ParcelHeight = 0.2f;

        private LevelData level;
        private ConveyorTile[] tiles;
        private MeshRenderer[] floors;
        private Transform root;
        private Transform hintMarker;
        private Vector3 hintBase;

        public LevelData Level
        {
            get { return level; }
        }

        public void Build(LevelData data, int[] rotations, bool props = true)
        {
            Clear();
            level = data;
            root = new GameObject("Board").transform;
            root.SetParent(transform, false);

            tiles = new ConveyorTile[data.CellCount];
            floors = new MeshRenderer[data.CellCount];

            BuildFrame(data, props);

            for (int y = 0; y < data.height; y++)
            {
                for (int x = 0; x < data.width; x++)
                {
                    int i = data.IndexOf(x, y);
                    Vector3 center = CellCenter(x, y);
                    Color floor = (x + y) % 2 == 0 ? Palette.FloorLight : Palette.FloorDark;
                    GameObject cell = Primitives.Create(PrimitiveType.Cube, root, center + Vector3.down * 0.04f, new Vector3(0.96f, 0.08f, 0.96f),
                        floor, TextureKind.Panel, Vector2.one, "Floor");
                    floors[i] = cell.GetComponent<MeshRenderer>();

                    TileSpec spec = data.tiles[i];
                    if (spec.kind == TileKind.Empty)
                    {
                        continue;
                    }
                    var tile = new GameObject("Tile " + x + "," + y).AddComponent<ConveyorTile>();
                    tile.transform.SetParent(root, false);
                    tile.transform.localPosition = center;
                    tile.Init(spec, rotations[i]);
                    tiles[i] = tile;
                }
            }
        }

        /// <summary>Slab, warning-stripe trim, corner lamps and a few props around the board.</summary>
        private void BuildFrame(LevelData data, bool props)
        {
            float w = data.width;
            float h = data.height;

            Primitives.Create(PrimitiveType.Cube, root, new Vector3(0f, -0.34f, 0f), new Vector3(w + 1.0f, 0.5f, h + 1.0f), Palette.SlabBase, "SlabBase");
            Primitives.Create(PrimitiveType.Cube, root, new Vector3(0f, -0.10f, 0f), new Vector3(w + 0.6f, 0.16f, h + 0.6f), Palette.Slab, "Slab");

            // Warning-stripe trim around the plates (its top sits just under the floor plates).
            float stripe = 0.3f;
            Primitives.Create(PrimitiveType.Cube, root, new Vector3(0f, -0.03f, (h + stripe) * 0.5f), new Vector3(w + 0.6f, 0.04f, stripe), Color.white, TextureKind.Hazard, new Vector2((w + 0.6f) / 1.2f, 0.25f), "TrimN");
            Primitives.Create(PrimitiveType.Cube, root, new Vector3(0f, -0.03f, -(h + stripe) * 0.5f), new Vector3(w + 0.6f, 0.04f, stripe), Color.white, TextureKind.Hazard, new Vector2((w + 0.6f) / 1.2f, 0.25f), "TrimS");
            Primitives.Create(PrimitiveType.Cube, root, new Vector3((w + stripe) * 0.5f, -0.03f, 0f), new Vector3(stripe, 0.04f, h), Color.white, TextureKind.Hazard, new Vector2(0.25f, h / 1.2f), "TrimE");
            Primitives.Create(PrimitiveType.Cube, root, new Vector3(-(w + stripe) * 0.5f, -0.03f, 0f), new Vector3(stripe, 0.04f, h), Color.white, TextureKind.Hazard, new Vector2(0.25f, h / 1.2f), "TrimW");
            Primitives.Create(PrimitiveType.Cube, root, new Vector3(0f, -0.045f, 0f), new Vector3(w, 0.05f, h), Palette.SlabBase, "Gap");

            foreach (int sx in new[] { -1, 1 })
            {
                foreach (int sz in new[] { -1, 1 })
                {
                    Vector3 corner = new Vector3(sx * (w * 0.5f + 0.32f), 0f, sz * (h * 0.5f + 0.32f));
                    Primitives.Create(PrimitiveType.Cube, root, corner + Vector3.up * 0.30f, new Vector3(0.16f, 0.62f, 0.16f), Palette.Frame, "Post");
                    Primitives.Create(PrimitiveType.Sphere, root, corner + Vector3.up * 0.70f, Vector3.one * 0.24f, Palette.Lamp, "Lamp");
                }
            }

            if (props)
            {
                BuildProps(Mathf.Max(w, h) * 0.5f * 1.4142f);
            }
        }

        /// <summary>Set dressing on the factory floor: barrels, a turning gear and a crate stack.</summary>
        private void BuildProps(float extent)
        {
            // Directions on the ground as the fixed camera sees them: forward = up the screen, right = right.
            Vector3 f = new Vector3(0.7071f, 0f, 0.7071f);
            Vector3 r = new Vector3(0.7071f, 0f, -0.7071f);
            const float ground = -0.57f;

            Vector3 barrelA = f * (extent + 0.55f) + r * 1.9f;
            Vector3 barrelB = f * (extent + 0.85f) + r * 2.6f;
            Barrel(barrelA, Palette.Barrel);
            Barrel(barrelB, Palette.BarrelTeal);

            // Gear
            var gear = new GameObject("Gear").transform;
            gear.SetParent(root, false);
            gear.localPosition = f * (extent + 0.3f) - r * 2.6f + Vector3.up * (ground + 0.08f);
            gear.gameObject.AddComponent<Spinner>().DegreesPerSecond = 20f;
            Primitives.Create(PrimitiveType.Cylinder, gear, Vector3.zero, new Vector3(1.0f, 0.05f, 1.0f), Palette.Metal, "Disc");
            Primitives.Create(PrimitiveType.Cylinder, gear, new Vector3(0f, 0.07f, 0f), new Vector3(0.30f, 0.04f, 0.30f), Palette.Frame, "Hub");
            for (int i = 0; i < 10; i++)
            {
                Quaternion q = Quaternion.Euler(0f, i * 36f, 0f);
                Primitives.Create(PrimitiveType.Cube, gear, q * new Vector3(0f, 0f, 0.55f), new Vector3(0.22f, 0.10f, 0.20f),
                    GameMaterials.Get(Palette.Metal), q, "Tooth");
            }

            // Crate stack in front, off to the left.
            Vector3 stack = -f * (extent + 0.8f) - r * 2.7f;
            Primitives.Create(PrimitiveType.Cube, root, stack + Vector3.up * (ground + 0.40f), Vector3.one * 0.8f, Palette.Crate, TextureKind.Wood, Vector2.one, "StackCrate");
            Primitives.Create(PrimitiveType.Cube, root, stack + r * 0.9f + Vector3.up * (ground + 0.28f), Vector3.one * 0.56f, Palette.Crate, TextureKind.Wood, Vector2.one, "StackCrate");
            Primitives.Create(PrimitiveType.Cube, root, stack + Vector3.up * (ground + 1.05f), Vector3.one * 0.5f, Palette.Crate, TextureKind.Wood, Vector2.one, "StackCrate");
        }

        private void Barrel(Vector3 position, Color color)
        {
            const float ground = -0.57f;
            Primitives.Create(PrimitiveType.Cylinder, root, position + Vector3.up * (ground + 0.36f), new Vector3(0.40f, 0.36f, 0.40f), GameMaterials.Get(color), Quaternion.identity, "Barrel");
            Primitives.Create(PrimitiveType.Cylinder, root, position + Vector3.up * (ground + 0.50f), new Vector3(0.42f, 0.03f, 0.42f), GameMaterials.Get(Palette.Frame), Quaternion.identity, "BarrelBand");
            Primitives.Create(PrimitiveType.Cylinder, root, position + Vector3.up * (ground + 0.22f), new Vector3(0.42f, 0.03f, 0.42f), GameMaterials.Get(Palette.Frame), Quaternion.identity, "BarrelBand");
        }

        public void Clear()
        {
            if (root != null)
            {
                Destroy(root.gameObject);
            }
            root = null;
            hintMarker = null;
            tiles = null;
            floors = null;
            level = null;
        }

        public Vector3 CellCenter(int x, int y)
        {
            return new Vector3(x - (level.width - 1) * 0.5f, 0f, -(y - (level.height - 1) * 0.5f));
        }

        public Vector3 CellCenter(GridPoint p)
        {
            return CellCenter(p.x, p.y);
        }

        public static Vector3 WorldDirection(Direction d)
        {
            return new Vector3(d.DeltaX(), 0f, -d.DeltaY());
        }

        public void SnapRotations(int[] rotations)
        {
            for (int i = 0; i < tiles.Length; i++)
            {
                if (tiles[i] != null) tiles[i].SnapTo(rotations[i]);
            }
        }

        public void RotateTile(int x, int y)
        {
            ConveyorTile tile = tiles[level.IndexOf(x, y)];
            if (tile != null) tile.RotateStep();
        }

        /// <summary>Scrolls the belt rollers along a route while the parcel travels it.</summary>
        public void StartFlow(RouteResult route, int[] rotations)
        {
            StopFlow();
            IList<GridPoint> path = route.Path;
            for (int k = 0; k < path.Count; k++)
            {
                ConveyorTile tile = tiles[level.IndexOf(path[k].x, path[k].y)];
                if (tile == null) continue;
                Direction? entry = k > 0 ? DirectionBetween(path[k - 1], path[k]).Opposite() : (Direction?)null;
                Direction? exit = k < path.Count - 1 ? DirectionBetween(path[k], path[k + 1]) : (Direction?)null;
                tile.SetFlow(entry, exit, rotations[level.IndexOf(path[k].x, path[k].y)]);
            }
        }

        public void StopFlow()
        {
            if (tiles == null) return;
            foreach (ConveyorTile tile in tiles)
            {
                if (tile != null) tile.StopFlow();
            }
        }

        private static Direction DirectionBetween(GridPoint from, GridPoint to)
        {
            if (to.x > from.x) return Direction.East;
            if (to.x < from.x) return Direction.West;
            return to.y > from.y ? Direction.South : Direction.North;
        }

        public void FlashCell(GridPoint p, Color color, float seconds)
        {
            if (level == null || !level.InBounds(p.x, p.y)) return;
            int i = level.IndexOf(p.x, p.y);
            if (tiles[i] != null)
            {
                tiles[i].Flash(color, seconds);
            }
            else
            {
                StartCoroutine(FlashFloor(floors[i], color, seconds));
            }
        }

        private System.Collections.IEnumerator FlashFloor(MeshRenderer floor, Color color, float seconds)
        {
            Material original = floor.sharedMaterial;
            floor.sharedMaterial = GameMaterials.Get(color);
            yield return new WaitForSeconds(seconds);
            if (floor != null) floor.sharedMaterial = original;
        }

        /// <summary>Converts a screen position into a cell by intersecting the tap ray with the board plane.</summary>
        public bool TryPickCell(Camera cam, Vector2 screenPosition, out GridPoint cell)
        {
            cell = default(GridPoint);
            if (level == null || cam == null) return false;

            Ray ray = cam.ScreenPointToRay(screenPosition);
            var plane = new Plane(Vector3.up, Vector3.zero);
            float distance;
            if (!plane.Raycast(ray, out distance)) return false;

            Vector3 hit = ray.GetPoint(distance);
            int x = Mathf.FloorToInt(hit.x + level.width * 0.5f);
            int y = Mathf.FloorToInt(-hit.z + level.height * 0.5f);
            if (!level.InBounds(x, y)) return false;

            cell = new GridPoint(x, y);
            return true;
        }

        /// <summary>World-space points the parcel travels through for a route, with softened corners.</summary>
        public List<Vector3> BuildWaypoints(RouteResult route)
        {
            var points = new List<Vector3>();
            Vector3 lift = Vector3.up * ParcelHeight;
            IList<GridPoint> path = route.Path;

            for (int i = 1; i < path.Count; i++)
            {
                Vector3 center = CellCenter(path[i]) + lift;
                bool hasNext = i < path.Count - 1;
                if (hasNext)
                {
                    Vector3 inDir = (CellCenter(path[i]) - CellCenter(path[i - 1])).normalized;
                    Vector3 outDir = (CellCenter(path[i + 1]) - CellCenter(path[i])).normalized;
                    if (Vector3.Dot(inDir, outDir) < 0.5f)
                    {
                        // Cut the corner a little so the turn is a smooth curve.
                        points.Add(center - inDir * 0.22f);
                        points.Add(center + outDir * 0.22f);
                        continue;
                    }
                }
                points.Add(center);
            }
            return points;
        }

        public void ShowHint(GridPoint cell)
        {
            if (level == null) return;
            if (hintMarker == null)
            {
                var marker = new GameObject("Hint").transform;
                marker.SetParent(root, false);
                Primitives.Create(PrimitiveType.Sphere, marker, Vector3.zero, Vector3.one * 0.28f, Palette.Hint, "Dot");
                Primitives.Create(PrimitiveType.Cylinder, marker, new Vector3(0f, -0.27f, 0f), new Vector3(0.06f, 0.14f, 0.06f), Palette.Hint, "Stem");
                hintMarker = marker;
            }
            hintBase = CellCenter(cell) + Vector3.up * 0.95f;
            hintMarker.position = hintBase;
            hintMarker.gameObject.SetActive(true);
        }

        public void HideHint()
        {
            if (hintMarker != null) hintMarker.gameObject.SetActive(false);
        }

        private void Update()
        {
            if (hintMarker != null && hintMarker.gameObject.activeSelf)
            {
                hintMarker.position = hintBase + Vector3.up * (Mathf.Sin(Time.time * 6f) * 0.12f);
            }
        }
    }
}
