namespace FlowFactory.Core
{
    public enum TileKind
    {
        Empty = 0,
        Straight = 1,
        Corner = 2,
        Source = 3,
        Target = 4,
        /// <summary>Decorative, impassable crate.</summary>
        Block = 5
    }

    /// <summary>The initial state of one board cell as authored in a level.</summary>
    [System.Serializable]
    public struct TileSpec
    {
        public TileKind kind;
        /// <summary>Clockwise quarter turns (0-3) applied to the tile's base connectors.</summary>
        public int rotation;
        /// <summary>Whether the player may rotate this tile.</summary>
        public bool rotatable;

        public TileSpec(TileKind kind, int rotation, bool rotatable)
        {
            this.kind = kind;
            this.rotation = rotation;
            this.rotatable = rotatable;
        }
    }

    /// <summary>Connector geometry of every tile kind.</summary>
    public static class TileGeometry
    {
        /// <summary>
        /// Bit mask of open sides (see <see cref="DirectionExtensions.Bit"/>) for a tile.
        /// Base orientation (rotation 0): Straight N+S, Corner N+E, Source N, Target N.
        /// </summary>
        public static int Openings(TileKind kind, int rotation)
        {
            int baseMask;
            switch (kind)
            {
                case TileKind.Straight:
                    baseMask = Direction.North.Bit() | Direction.South.Bit();
                    break;
                case TileKind.Corner:
                    baseMask = Direction.North.Bit() | Direction.East.Bit();
                    break;
                case TileKind.Source:
                case TileKind.Target:
                    baseMask = Direction.North.Bit();
                    break;
                default:
                    return 0;
            }

            int result = 0;
            for (int d = 0; d < 4; d++)
            {
                if ((baseMask & (1 << d)) != 0)
                {
                    result |= ((Direction)d).Rotate(rotation).Bit();
                }
            }
            return result;
        }

        public static bool IsOpen(TileKind kind, int rotation, Direction side)
        {
            return (Openings(kind, rotation) & side.Bit()) != 0;
        }

        public static bool IsConveyor(TileKind kind)
        {
            return kind == TileKind.Straight || kind == TileKind.Corner;
        }

        /// <summary>
        /// For a conveyor entered through <paramref name="entrySide"/>, finds the side it leaves through.
        /// Returns false if the tile is not open on the entry side.
        /// </summary>
        public static bool TryGetExit(TileKind kind, int rotation, Direction entrySide, out Direction exit)
        {
            exit = entrySide;
            if (!IsConveyor(kind) || !IsOpen(kind, rotation, entrySide))
            {
                return false;
            }

            int rest = Openings(kind, rotation) & ~entrySide.Bit();
            for (int d = 0; d < 4; d++)
            {
                if ((rest & (1 << d)) != 0)
                {
                    exit = (Direction)d;
                    return true;
                }
            }
            return false;
        }

        /// <summary>The single open side of a Source or Target.</summary>
        public static Direction TerminalSide(int rotation)
        {
            return Direction.North.Rotate(rotation);
        }
    }
}
