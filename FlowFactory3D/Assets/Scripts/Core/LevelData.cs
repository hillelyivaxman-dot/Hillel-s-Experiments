using System;
using System.Collections.Generic;

namespace FlowFactory.Core
{
    /// <summary>
    /// Authoring data for one level. Pure data: no view or Unity types, so it is shared by the
    /// ScriptableObject, the catalog, the tests and the route validator.
    /// Cells are stored row-major: index = y * width + x, y = 0 is the top (north) row.
    /// </summary>
    [Serializable]
    public class LevelData
    {
        public int id;
        public string title;
        public string hint;
        public bool isTutorial;
        public int width;
        public int height;
        public TileSpec[] tiles;
        /// <summary>Known solution: one rotation (0-3) per cell. Only rotatable cells matter.</summary>
        public int[] solution;

        public int CellCount
        {
            get { return width * height; }
        }

        public bool InBounds(int x, int y)
        {
            return x >= 0 && y >= 0 && x < width && y < height;
        }

        public int IndexOf(int x, int y)
        {
            return y * width + x;
        }

        public TileSpec GetTile(int x, int y)
        {
            return tiles[IndexOf(x, y)];
        }

        public bool TryFind(TileKind kind, out GridPoint point)
        {
            for (int i = 0; i < tiles.Length; i++)
            {
                if (tiles[i].kind == kind)
                {
                    point = new GridPoint(i % width, i / width);
                    return true;
                }
            }
            point = default(GridPoint);
            return false;
        }

        public int[] InitialRotations()
        {
            var result = new int[tiles.Length];
            for (int i = 0; i < tiles.Length; i++)
            {
                result[i] = tiles[i].rotation;
            }
            return result;
        }

        public int RotatableCount
        {
            get
            {
                int count = 0;
                for (int i = 0; i < tiles.Length; i++)
                {
                    if (tiles[i].rotatable) count++;
                }
                return count;
            }
        }

        /// <summary>
        /// Minimum number of taps to reach the known solution's connections from the initial state
        /// (a straight only needs a 180 degree-equivalent orientation).
        /// </summary>
        public int MinimumTaps()
        {
            int taps = 0;
            for (int i = 0; i < tiles.Length; i++)
            {
                TileSpec t = tiles[i];
                if (!t.rotatable) continue;
                for (int n = 0; n < 4; n++)
                {
                    int r = (t.rotation + n) & 3;
                    if (TileGeometry.Openings(t.kind, r) == TileGeometry.Openings(t.kind, solution[i]))
                    {
                        taps += n;
                        break;
                    }
                }
            }
            return taps;
        }
    }

    /// <summary>Structural checks used by the editor tool and the unit tests.</summary>
    public static class LevelValidator
    {
        public const int MaxBoardSize = 5;

        /// <summary>Returns an empty list when the level is well formed and its solution works.</summary>
        public static List<string> Validate(LevelData level)
        {
            var errors = new List<string>();
            if (level == null)
            {
                errors.Add("level is null");
                return errors;
            }

            string name = "Level " + level.id;
            if (level.width < 2 || level.height < 2 || level.width > MaxBoardSize || level.height > MaxBoardSize)
            {
                errors.Add(name + ": board size " + level.width + "x" + level.height + " out of range");
                return errors;
            }

            int count = level.width * level.height;
            if (level.tiles == null || level.tiles.Length != count)
            {
                errors.Add(name + ": tiles array must have " + count + " entries");
                return errors;
            }
            if (level.solution == null || level.solution.Length != count)
            {
                errors.Add(name + ": solution array must have " + count + " entries");
                return errors;
            }

            int sources = 0;
            int targets = 0;
            for (int i = 0; i < count; i++)
            {
                TileSpec t = level.tiles[i];
                if (t.rotation < 0 || t.rotation > 3) errors.Add(name + ": tile " + i + " has invalid rotation");
                if (level.solution[i] < 0 || level.solution[i] > 3) errors.Add(name + ": solution " + i + " has invalid rotation");
                if (t.kind == TileKind.Source) sources++;
                if (t.kind == TileKind.Target) targets++;
                if (t.rotatable && !TileGeometry.IsConveyor(t.kind)) errors.Add(name + ": only conveyors may be rotatable (tile " + i + ")");
                if (!t.rotatable && level.solution[i] != t.rotation) errors.Add(name + ": solution changes fixed tile " + i);
            }
            if (sources != 1) errors.Add(name + ": needs exactly one source, found " + sources);
            if (targets != 1) errors.Add(name + ": needs exactly one target, found " + targets);
            if (errors.Count > 0) return errors;

            RouteResult solved = RouteValidator.Validate(level, level.solution);
            if (!solved.Success) errors.Add(name + ": known solution does not work (" + solved.Reason + ")");

            RouteResult initial = RouteValidator.Validate(level, level.InitialRotations());
            if (initial.Success) errors.Add(name + ": level is already solved in its initial state");

            return errors;
        }
    }
}
