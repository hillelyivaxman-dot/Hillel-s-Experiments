using UnityEngine;

namespace FlowFactory
{
    public struct ThemeColors
    {
        public Color FloorLight, FloorDark, Slab, SlabBase, BeltRotatable, RailRotatable, GroundInner, GroundOuter, Lamp;
    }

    public struct ParcelColors
    {
        public Color Box, Tape;
    }

    /// <summary>Cosmetic looks sold in the shop. Themes recolour the board; parcel skins recolour the parcel.</summary>
    public static class ThemeCatalog
    {
        public static ThemeColors Theme(string id)
        {
            switch (id)
            {
                case "theme.candy":
                    return new ThemeColors
                    {
                        FloorLight = new Color(1.00f, 0.91f, 0.94f), FloorDark = new Color(0.96f, 0.80f, 0.87f),
                        Slab = new Color(0.78f, 0.35f, 0.55f), SlabBase = new Color(0.52f, 0.20f, 0.38f),
                        BeltRotatable = new Color(0.20f, 0.74f, 0.62f), RailRotatable = new Color(1.00f, 0.55f, 0.75f),
                        GroundInner = new Color(0.58f, 0.34f, 0.52f), GroundOuter = new Color(0.20f, 0.09f, 0.20f),
                        Lamp = new Color(1.00f, 0.80f, 0.90f)
                    };
                case "theme.midnight":
                    return new ThemeColors
                    {
                        FloorLight = new Color(0.34f, 0.38f, 0.52f), FloorDark = new Color(0.26f, 0.29f, 0.42f),
                        Slab = new Color(0.08f, 0.09f, 0.17f), SlabBase = new Color(0.04f, 0.05f, 0.11f),
                        BeltRotatable = new Color(0.10f, 0.78f, 0.98f), RailRotatable = new Color(0.95f, 0.25f, 0.85f),
                        GroundInner = new Color(0.14f, 0.16f, 0.32f), GroundOuter = new Color(0.02f, 0.02f, 0.07f),
                        Lamp = new Color(0.50f, 0.95f, 1.00f)
                    };
                case "theme.gold":
                    return new ThemeColors
                    {
                        FloorLight = new Color(0.96f, 0.93f, 0.86f), FloorDark = new Color(0.85f, 0.81f, 0.72f),
                        Slab = new Color(0.62f, 0.46f, 0.15f), SlabBase = new Color(0.36f, 0.26f, 0.08f),
                        BeltRotatable = new Color(0.68f, 0.16f, 0.22f), RailRotatable = new Color(1.00f, 0.86f, 0.38f),
                        GroundInner = new Color(0.38f, 0.30f, 0.19f), GroundOuter = new Color(0.08f, 0.06f, 0.04f),
                        Lamp = new Color(1.00f, 0.90f, 0.50f)
                    };
                default: // theme.classic
                    return new ThemeColors
                    {
                        FloorLight = new Color(0.97f, 0.93f, 0.84f), FloorDark = new Color(0.88f, 0.83f, 0.73f),
                        Slab = new Color(0.10f, 0.25f, 0.31f), SlabBase = new Color(0.07f, 0.17f, 0.22f),
                        BeltRotatable = new Color(0.10f, 0.58f, 0.78f), RailRotatable = new Color(1.00f, 0.80f, 0.20f),
                        GroundInner = new Color(0.24f, 0.40f, 0.46f), GroundOuter = new Color(0.04f, 0.09f, 0.12f),
                        Lamp = new Color(1.00f, 0.88f, 0.45f)
                    };
            }
        }

        public static ParcelColors Parcel(string id)
        {
            switch (id)
            {
                case "parcel.gift": return new ParcelColors { Box = new Color(0.86f, 0.16f, 0.22f), Tape = new Color(1.00f, 0.82f, 0.30f) };
                case "parcel.ocean": return new ParcelColors { Box = new Color(0.20f, 0.55f, 0.88f), Tape = new Color(0.95f, 0.98f, 1.00f) };
                case "parcel.gold": return new ParcelColors { Box = new Color(0.98f, 0.80f, 0.25f), Tape = new Color(1.00f, 0.96f, 0.72f) };
                default: return new ParcelColors { Box = new Color(0.96f, 0.64f, 0.18f), Tape = new Color(0.98f, 0.92f, 0.78f) };
            }
        }

        /// <summary>Copies a theme and a parcel skin into the shared palette. Boards built afterwards use them.</summary>
        public static void Apply(string themeId, string parcelId)
        {
            ThemeColors t = Theme(themeId);
            Palette.FloorLight = t.FloorLight;
            Palette.FloorDark = t.FloorDark;
            Palette.Slab = t.Slab;
            Palette.SlabBase = t.SlabBase;
            Palette.BeltRotatable = t.BeltRotatable;
            Palette.RailRotatable = t.RailRotatable;
            Palette.GroundInner = t.GroundInner;
            Palette.GroundOuter = t.GroundOuter;
            Palette.Lamp = t.Lamp;

            ParcelColors p = Parcel(parcelId);
            Palette.Parcel = p.Box;
            Palette.ParcelTape = p.Tape;

            GameMaterials.RefreshGround();
        }
    }
}
