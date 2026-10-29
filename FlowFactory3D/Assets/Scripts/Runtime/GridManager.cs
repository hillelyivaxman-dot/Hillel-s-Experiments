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

        public void Build(LevelData data, int[] rotations)
        {
            Clear();
            level = data;
            root = new GameObject("Board").transform;
            root.SetParent(transform, false);

            tiles = new ConveyorTile[data.CellCount];
            floors = new MeshRenderer[data.CellCount];

            Primitives.Create(PrimitiveType.Cube, root,
                new Vector3(0f, -0.28f, 0f), new Vector3(data.width + 0.5f, 0.4f, data.height + 0.5f), Palette.Slab, "Slab");

            for (int y = 0; y < data.height; y++)
            {
                for (int x = 0; x < data.width; x++)
                {
                    int i = data.IndexOf(x, y);
                    Vector3 center = CellCenter(x, y);
                    Color floor = (x + y) % 2 == 0 ? Palette.FloorLight : Palette.FloorDark;
                    GameObject cell = Primitives.Create(PrimitiveType.Cube, root, center + Vector3.down * 0.04f, new Vector3(0.96f, 0.08f, 0.96f), floor, "Floor");
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
