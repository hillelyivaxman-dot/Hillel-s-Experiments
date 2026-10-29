using System.Collections.Generic;

namespace FlowFactory.Core
{
    public enum FailureReason
    {
        None = 0,
        NoSource,
        /// <summary>The parcel left the board.</summary>
        OffBoard,
        /// <summary>The next cell has no tile.</summary>
        EmptyCell,
        /// <summary>The next cell is a decorative block.</summary>
        BlockedCell,
        /// <summary>The next tile is there but its connector does not face the parcel.</summary>
        WrongConnection,
        /// <summary>The parcel came back to a state it was already in.</summary>
        Loop,
        /// <summary>Safety net: the route was longer than any sane route.</summary>
        StepLimit
    }

    public sealed class RouteResult
    {
        public bool Success;
        public FailureReason Reason;
        /// <summary>Cells the parcel travels through, from the source to the last cell it entered.</summary>
        public readonly List<GridPoint> Path = new List<GridPoint>();
        /// <summary>The cell where it went wrong: the offending neighbour, or the last cell when leaving the board.</summary>
        public GridPoint FailCell;
        /// <summary>Direction of travel when the parcel failed (towards the offending side).</summary>
        public Direction FailDirection;
    }

    /// <summary>
    /// Pure route simulation. Follows connectors from the source one cell at a time; contains no
    /// view or animation code.
    /// </summary>
    public static class RouteValidator
    {
        public static RouteResult Validate(LevelData level, int[] rotations, int maxSteps = -1)
        {
            var result = new RouteResult();
            GridPoint start;
            if (!level.TryFind(TileKind.Source, out start))
            {
                result.Reason = FailureReason.NoSource;
                return result;
            }

            if (maxSteps < 0) maxSteps = level.CellCount * 4 + 4;

            GridPoint pos = start;
            result.Path.Add(pos);
            Direction heading = TileGeometry.TerminalSide(rotations[level.IndexOf(pos.x, pos.y)]);
            var seen = new HashSet<int>();
            int steps = 0;

            while (true)
            {
                steps++;
                if (steps > maxSteps)
                {
                    return Fail(result, FailureReason.StepLimit, pos, heading);
                }

                GridPoint next = pos.Step(heading);
                if (!level.InBounds(next.x, next.y))
                {
                    return Fail(result, FailureReason.OffBoard, pos, heading);
                }

                int index = level.IndexOf(next.x, next.y);
                TileKind kind = level.tiles[index].kind;
                if (kind == TileKind.Empty)
                {
                    return Fail(result, FailureReason.EmptyCell, next, heading);
                }
                if (kind == TileKind.Block)
                {
                    return Fail(result, FailureReason.BlockedCell, next, heading);
                }

                Direction entry = heading.Opposite();
                if (!TileGeometry.IsOpen(kind, rotations[index], entry))
                {
                    return Fail(result, FailureReason.WrongConnection, next, heading);
                }
                if (kind == TileKind.Source)
                {
                    return Fail(result, FailureReason.Loop, next, heading);
                }
                if (!seen.Add(index * 4 + (int)entry))
                {
                    return Fail(result, FailureReason.Loop, next, heading);
                }

                result.Path.Add(next);
                if (kind == TileKind.Target)
                {
                    result.Success = true;
                    result.Reason = FailureReason.None;
                    return result;
                }

                TileGeometry.TryGetExit(kind, rotations[index], entry, out heading);
                pos = next;
            }
        }

        private static RouteResult Fail(RouteResult result, FailureReason reason, GridPoint cell, Direction heading)
        {
            result.Success = false;
            result.Reason = reason;
            result.FailCell = cell;
            result.FailDirection = heading;
            return result;
        }
    }
}
