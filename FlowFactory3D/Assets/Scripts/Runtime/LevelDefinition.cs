using FlowFactory.Core;
using UnityEngine;

namespace FlowFactory
{
    /// <summary>
    /// Editable level asset. One generic game scene loads these; levels are data, never duplicated scenes.
    /// Generate the 12 assets with the menu Flow Factory > Generate Level Assets.
    /// </summary>
    [CreateAssetMenu(fileName = "Level_00", menuName = "Flow Factory/Level Definition")]
    public sealed class LevelDefinition : ScriptableObject
    {
        public int levelId = 1;
        public string title = "New Level";
        [TextArea] public string hint;
        public bool isTutorial;
        [Range(2, 5)] public int width = 4;
        [Range(2, 5)] public int height = 4;
        [Tooltip("Row-major, top (north) row first: index = y * width + x")]
        public TileSpec[] tiles = new TileSpec[0];
        [Tooltip("Known solution: one rotation (0-3) per cell")]
        public int[] solution = new int[0];

        public LevelData ToLevelData()
        {
            return new LevelData
            {
                id = levelId,
                title = title,
                hint = hint,
                isTutorial = isTutorial,
                width = width,
                height = height,
                tiles = (TileSpec[])tiles.Clone(),
                solution = (int[])solution.Clone()
            };
        }

        public void CopyFrom(LevelData data)
        {
            levelId = data.id;
            title = data.title;
            hint = data.hint;
            isTutorial = data.isTutorial;
            width = data.width;
            height = data.height;
            tiles = (TileSpec[])data.tiles.Clone();
            solution = (int[])data.solution.Clone();
        }
    }
}
