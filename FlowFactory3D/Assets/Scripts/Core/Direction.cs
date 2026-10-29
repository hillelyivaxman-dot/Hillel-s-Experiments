using System;

namespace FlowFactory.Core
{
    /// <summary>Compass direction on the board. North is "up" in grid space (row - 1).</summary>
    public enum Direction
    {
        North = 0,
        East = 1,
        South = 2,
        West = 3
    }

    public static class DirectionExtensions
    {
        public static Direction Opposite(this Direction d)
        {
            return (Direction)(((int)d + 2) & 3);
        }

        /// <summary>Rotates clockwise by the given number of quarter turns (may be negative).</summary>
        public static Direction Rotate(this Direction d, int quarterTurns)
        {
            return (Direction)((((int)d + quarterTurns) % 4 + 4) % 4);
        }

        public static int DeltaX(this Direction d)
        {
            return d == Direction.East ? 1 : d == Direction.West ? -1 : 0;
        }

        public static int DeltaY(this Direction d)
        {
            return d == Direction.South ? 1 : d == Direction.North ? -1 : 0;
        }

        public static int Bit(this Direction d)
        {
            return 1 << (int)d;
        }
    }

    /// <summary>A cell coordinate. X grows to the east, Y grows to the south (row index).</summary>
    [Serializable]
    public struct GridPoint : IEquatable<GridPoint>
    {
        public int x;
        public int y;

        public GridPoint(int x, int y)
        {
            this.x = x;
            this.y = y;
        }

        public GridPoint Step(Direction d)
        {
            return new GridPoint(x + d.DeltaX(), y + d.DeltaY());
        }

        public bool Equals(GridPoint other)
        {
            return x == other.x && y == other.y;
        }

        public override bool Equals(object obj)
        {
            return obj is GridPoint other && Equals(other);
        }

        public override int GetHashCode()
        {
            return x * 397 ^ y;
        }

        public override string ToString()
        {
            return "(" + x + "," + y + ")";
        }
    }
}
