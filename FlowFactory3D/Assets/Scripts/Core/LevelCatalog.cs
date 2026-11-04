using System;
using System.Collections.Generic;

namespace FlowFactory.Core
{
    /// <summary>
    /// Authoring source for the 36 levels (3 worlds of 12), written as ASCII grids of the SOLVED board.
    /// The editor tool turns these into LevelDefinition assets; the game falls back to them if no
    /// assets were generated. Cells are separated by spaces:
    ///   .            empty cell                 #            decorative block
    ///   S^ S&gt; Sv S&lt;  source, open side         T^ T&gt; Tv T&lt;  target, open side
    ///   H V          straight, solved orientation (H = east-west, V = north-south)
    ///   NE ES SW WN  corner, the two open sides in the solved board
    ///   Lower case (h v ne es sw wn) = fixed tile the player cannot rotate.
    ///   A suffix ":n" on a rotatable tile = taps needed from the start (n = 1..3 quarter turns).
    /// Rows are listed north to south.
    /// </summary>
    public static class LevelCatalog
    {
        private sealed class Spec
        {
            public string Title;
            public string Hint;
            public bool Tutorial;
            public string[] Rows;

            public Spec(string title, string hint, bool tutorial, params string[] rows)
            {
                Title = title;
                Hint = hint;
                Tutorial = tutorial;
                Rows = rows;
            }
        }

        private static readonly Spec[] Specs =
        {
            new Spec("First Turn", "Tap the belt to turn it, then press RUN.", true,
                ". . . .",
                ". ES:1 T< .",
                ". S^ . .",
                ". . . ."),

            new Spec("Two Belts", "Turn both belts so the parcel can pass.", true,
                ". . . .",
                ". . Tv .",
                "S> H:1 WN:2 .",
                ". . . ."),

            new Spec("Around the Corner", "Not every belt needs turning.", false,
                "S> h H:1 SW:1",
                ". . . v",
                ". # . T^",
                ". . . ."),

            new Spec("Look Twice", "Some belts only look useful.", false,
                ". SW:1 NE:2 .",
                "ES:1 H:1 SW:1 H:1",
                "V:1 NE:2 V:1 .",
                "S^ . T^ #"),

            new Spec("Three Turns", "Follow the belt with your eyes first.", false,
                ". # . . .",
                "S> H:1 SW:1 . .",
                ". NE:2 V:1 SW:1 Tv",
                ". . NE:1 H:1 WN:1",
                "# . . . ."),

            new Spec("Sideways", "Straight belts can face the wrong way, too.", false,
                ". . . . .",
                ". . . Tv .",
                ". # . v .",
                ". NE:1 SW:2 v #",
                "S> H:1 H:1 wn ."),

            new Spec("Dead End", "Crates block the way. Find another one.", false,
                ". . . # .",
                ". . ES:1 H:1 T<",
                "# SW:2 V:1 NE:1 .",
                "S> H:1 WN:1 . .",
                ". . . . #"),

            new Spec("Staircase", "Corners and straights are not the same.", false,
                "S> SW:1 . . .",
                ". NE:2 SW:1 H:1 .",
                ". V:1 NE:1 SW:2 .",
                ". . . NE:3 T<",
                ". . . . ."),

            new Spec("Snake", "A long way around.", false,
                "S> H:1 H:1 SW:1 .",
                ". . . V:1 .",
                ". ES:1 H:1 WN:3 .",
                ". NE:2 H:1 H:1 SW:1",
                ". . . . T^"),

            new Spec("Backwards", "Start on the right, end on the left.", false,
                ". . ES:1 H:1 S<",
                ". Tv V:1 . .",
                ". v NE:1 H:1 SW:2",
                ". v . . V:1",
                ". NE:2 H:1 H:1 WN:1"),

            new Spec("Full House", "Lots of belts. Only one way through.", false,
                "NE:1 H:1 SW:2 V:1 ES:3",
                "SW:1 NE:2 ES:1 SW:1 H:1",
                "S> H:1 WN:1 V:1 SW:2",
                "NE:2 SW:1 ES:2 WN:1 V:1",
                "H:1 ES:1 NE:1 H:1 T<"),

            new Spec("Factory Awakens", "Wake the factory!", false,
                "S> H:1 H:1 H:1 SW:1",
                "# . H:1 . V:1",
                ". ES:1 T< . V:1",
                ". V:1 . # V:1",
                ". NE:2 H:1 H:1 WN:1"),

            // ---- World 2 (13-24) and World 3 (25-36): generated once with Tools/LevelGen/gen_levels.py and
            // committed as static data. Longer routes, more turns, more decoys and crates.
            new Spec("Overtime", "Trace the route from the source first.", false,
                ". . . # .",
                ". . . Tv .",
                ". S> sw v #",
                ". es WN:1 V:1 ES",
                ". NE:3 H:1 WN:2 ."),

            new Spec("Night Shift", "Count the turns before you tap.", false,
                ". # . # SW:1",
                "# v . . .",
                "H:1 wn . ES:3 Sv",
                "v es SW:3 ES:3 WN:3",
                "ne T^ NE:3 WN:3 SW:1"),

            new Spec("Loading Bay", "Belts that are already right can be left alone.", false,
                ". # . NE:2 WN:3",
                ". V v . .",
                "ES:1 SW:1 ES:1 SW:2 .",
                "S^ NE:3 WN:2 NE:2 T<",
                "# . . . ."),

            new Spec("Conveyor Maze", "Crates never move. Plan around them.", false,
                "es S< ES:3 Tv #",
                "NE:3 h SW:3 V:1 .",
                ". NE:3 NE:3 WN:2 #",
                ". wn # H:1 .",
                ". . . H V:1"),

            new Spec("Fast Lane", "Some belts only look useful.", false,
                ". . # . .",
                ". V:1 ES:2 SW:1 V",
                "V:1 . V:1 NE:3 SW",
                ". . ne SW:1 V:1",
                ". sw S> WN:3 T^"),

            new Spec("Sorting Hall", "Work backwards from the target.", false,
                ". ES:1 # # .",
                "WN:3 SW:3 V . .",
                "ES:1 T< ES:1 SW:2 Sv",
                "NE:1 SW:2 V NE:2 WN:1",
                ". NE:1 WN:3 . ."),

            new Spec("Detour", "A long way round can be the only way.", false,
                "ES:1 H:1 h S< es",
                "V:1 . ES:3 SW:1 .",
                "NE:1 SW:2 . . .",
                "T> WN:2 . # .",
                ". . V:1 . ."),

            new Spec("Zig Zag", "Fix the corners, then the straights.", false,
                "ne ES:1 SW:2 # .",
                "es WN:3 V:1 . .",
                "V:1 NE V:1 ES:3 .",
                "T^ v NE:2 H:1 S<",
                ". . . V V:1"),

            new Spec("Packing Line", "Trace the route from the source first.", false,
                "WN:3 V:1 es SW:2 Tv",
                ". H V:1 V:1 v",
                ". S> wn V:1 V:1",
                "v SW:3 . NE:3 WN:2",
                "NE:3 ES . SW H"),

            new Spec("Mixed Up", "Count the turns before you tap.", false,
                ". ES # # V",
                "h . V ES:1 SW:2",
                ". . . T^ V:1",
                ". . ES:1 S< V:1",
                "v wn NE:3 H WN:2"),

            new Spec("Tight Squeeze", "Belts that are already right can be left alone.", false,
                "ES:2 SW:3 wn SW #",
                "V:1 v S> SW:1 .",
                "T^ V:1 . V h",
                "sw NE:1 H:1 WN:1 .",
                ". . # # ."),

            new Spec("Grand Opening", "Crates never move. Plan around them.", false,
                "h ES:3 H:1 S< .",
                "ES:1 WN:3 . ES:3 H",
                "NE:2 SW:2 V . WN:3",
                "es v WN ES:2 SW:2",
                "WN:1 NE:3 H:1 WN:3 T^"),

            new Spec("Second Wind", "Some belts only look useful.", false,
                "WN . # ES S<",
                "H:1 NE:2 H:1 v .",
                "T> H SW:1 NE:2 sw",
                ". NE:3 ne sw V:1",
                "V:1 es h NE:3 WN:1"),

            new Spec("Rush Order", "Work backwards from the target.", false,
                "ES:3 SW:2 ES:1 SW:1 SW:1",
                "V NE:2 WN:2 NE:2 SW:2",
                "V:1 H . S> WN",
                "NE:2 T< sw H .",
                "NE:1 . . H:1 H"),

            new Spec("Back Alley", "A long way round can be the only way.", false,
                "v . . ES SW:2",
                "ES . . V:1 S^",
                "ES:3 T< H:1 V:1 NE:1",
                "NE:1 SW:2 V V:1 H:1",
                "SW NE:2 H:1 WN:1 ."),

            new Spec("Crossroads", "Fix the corners, then the straights.", false,
                "h ES:2 V ES:3 SW:3",
                "Tv . S> WN:3 v",
                "NE:1 H:1 H:1 SW:3 V:1",
                "H:1 . H:1 NE:3 WN:2",
                ". # ES . #"),

            new Spec("Spiral Stairs", "Trace the route from the source first.", false,
                "# ne . h .",
                "H:1 H:1 ES:2 SW:1 V",
                "ES:3 H:1 WN NE SW:1",
                "V:1 Tv H ES:3 WN:3",
                "S^ NE:1 H:1 WN:1 ."),

            new Spec("Long Haul", "Count the turns before you tap.", false,
                "H WN:3 V:1 SW:3 WN:1",
                "es S< WN . V",
                "NE:3 H:1 SW:3 SW:1 .",
                "ES:2 H:1 WN Tv ES",
                "NE:1 H:1 H:1 WN V:1"),

            new Spec("Hidden Path", "Belts that are already right can be left alone.", false,
                "ES:3 SW:1 SW:3 . .",
                "V:1 V:1 ES:2 H:1 SW:2",
                "T^ NE:2 WN:2 NE:3 V:1",
                "# . H:1 . S^",
                ". # ne SW:3 ."),

            new Spec("Clockwork", "Crates never move. Plan around them.", false,
                "Sv ne ES:3 h SW:2",
                "V:1 # V:1 ES:1 WN:2",
                "V:1 ES:1 WN:2 V:1 NE:2",
                "NE:3 WN:2 NE:2 NE:1 T<",
                "NE:3 SW:1 V SW ."),

            new Spec("Double Back", "Some belts only look useful.", false,
                "ES:3 SW:2 ES SW:2 Sv",
                "v NE:1 WN NE:2 WN",
                "V:1 . es NE:2 wn",
                "v v V V:1 SW:1",
                "NE H:1 T< WN:2 V"),

            new Spec("Foreman's Test", "Work backwards from the target.", false,
                "SW:2 ES:2 SW:3 ES:1 SW:3",
                "ES:1 WN NE WN:3 V",
                "NE:3 SW:2 NE:3 V V:1",
                "S> WN:3 . ES T^",
                "# H:1 H:1 V:1 ."),

            new Spec("Master Plan", "A long way round can be the only way.", false,
                "SW:2 ES:2 ES:1 SW:3 ES:2",
                ". . V:1 NE:2 SW:3",
                "V ES:3 V T> WN:1",
                "NE WN V:1 ES:3 SW",
                "sw SW:3 NE:3 WN:1 S^"),

            new Spec("Factory Legend", "Fix the corners, then the straights.", false,
                "NE NE:3 H:1 . Tv",
                "ES:3 SW H WN:2 V:1",
                "V:1 S^ V:1 V:1 V:1",
                "NE:2 H:1 SW:3 ES:1 WN:3",
                "V h NE WN:3 ES"),
        };

        public static int Count
        {
            get { return Specs.Length; }
        }

        public static IList<LevelData> BuildAll()
        {
            var result = new List<LevelData>(Specs.Length);
            for (int i = 0; i < Specs.Length; i++)
            {
                result.Add(Parse(i + 1, Specs[i]));
            }
            return result;
        }

        private static LevelData Parse(int id, Spec spec)
        {
            int height = spec.Rows.Length;
            string[][] cells = new string[height][];
            int width = 0;
            for (int y = 0; y < height; y++)
            {
                cells[y] = spec.Rows[y].Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                if (y == 0) width = cells[y].Length;
                else if (cells[y].Length != width) throw new FormatException("Level " + id + " row " + y + " has the wrong width");
            }

            var level = new LevelData
            {
                id = id,
                title = spec.Title,
                hint = spec.Hint,
                isTutorial = spec.Tutorial,
                width = width,
                height = height,
                tiles = new TileSpec[width * height],
                solution = new int[width * height]
            };

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    int solved;
                    int taps;
                    TileSpec tile = ParseCell(id, cells[y][x], out solved, out taps);
                    int i = y * width + x;
                    level.solution[i] = solved;
                    tile.rotation = tile.rotatable ? ((solved - taps) % 4 + 4) % 4 : solved;
                    level.tiles[i] = tile;
                }
            }
            return level;
        }

        private static TileSpec ParseCell(int levelId, string token, out int solvedRotation, out int taps)
        {
            taps = 0;
            string body = token;
            int colon = token.IndexOf(':');
            if (colon >= 0)
            {
                body = token.Substring(0, colon);
                taps = int.Parse(token.Substring(colon + 1));
            }

            bool rotatable = body.Length > 0 && !char.IsLower(body[0]) && body[0] != '.' && body[0] != '#';
            string key = body.ToUpperInvariant();
            solvedRotation = 0;

            switch (key)
            {
                case ".": return new TileSpec(TileKind.Empty, 0, false);
                case "#": return new TileSpec(TileKind.Block, 0, false);
                case "V": return new TileSpec(TileKind.Straight, 0, rotatable);
                case "H": solvedRotation = 1; return new TileSpec(TileKind.Straight, 1, rotatable);
                case "NE": return new TileSpec(TileKind.Corner, 0, rotatable);
                case "ES": solvedRotation = 1; return new TileSpec(TileKind.Corner, 1, rotatable);
                case "SW": solvedRotation = 2; return new TileSpec(TileKind.Corner, 2, rotatable);
                case "WN": solvedRotation = 3; return new TileSpec(TileKind.Corner, 3, rotatable);
            }

            if (key.Length == 2 && (key[0] == 'S' || key[0] == 'T') && "^><V".IndexOf(key[1]) >= 0)
            {
                // Source and target are written with their open side as an arrow.
                string arrow = body.Substring(1);
                Direction side = arrow == "^" ? Direction.North : arrow == ">" ? Direction.East : arrow == "v" ? Direction.South : Direction.West;
                solvedRotation = (int)side;
                return new TileSpec(key[0] == 'S' ? TileKind.Source : TileKind.Target, solvedRotation, false);
            }

            throw new FormatException("Level " + levelId + ": unknown cell '" + token + "'");
        }
    }
}
