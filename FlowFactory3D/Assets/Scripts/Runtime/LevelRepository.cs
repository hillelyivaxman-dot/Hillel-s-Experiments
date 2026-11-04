using System;
using System.Collections.Generic;
using FlowFactory.Core;
using UnityEngine;

namespace FlowFactory
{
    /// <summary>Loads the level list: LevelDefinition assets from Resources/Levels, or the built-in catalog.</summary>
    public static class LevelRepository
    {
        public const string ResourcesFolder = "Levels";

        public static IList<LevelData> LoadAll()
        {
            LevelDefinition[] assets = Resources.LoadAll<LevelDefinition>(ResourcesFolder);
            if (assets.Length > 0)
            {
                Array.Sort(assets, (a, b) => a.levelId.CompareTo(b.levelId));
                var list = new List<LevelData>(assets.Length);
                bool valid = true;
                for (int i = 0; i < assets.Length; i++)
                {
                    LevelData data = assets[i].ToLevelData();
                    List<string> errors = LevelValidator.Validate(data);
                    if (errors.Count > 0 || data.id != i + 1)
                    {
                        valid = false;
                        Debug.LogError("[FlowFactory] Level asset '" + assets[i].name + "' is invalid: " +
                                       (errors.Count > 0 ? string.Join("; ", errors) : "ids must be 1..N without gaps"));
                        break;
                    }
                    list.Add(data);
                }
                if (valid && list.Count == LevelCatalog.Count)
                {
                    return list;
                }
                if (valid)
                {
                    Debug.LogWarning("[FlowFactory] Only " + list.Count + " of " + LevelCatalog.Count + " level assets exist. " +
                                     "Run Flow Factory > Generate Level Assets (create missing). Using the built-in catalog for now.");
                }
                Debug.LogWarning("[FlowFactory] Using the built-in level catalog instead of the assets.");
            }
            return LevelCatalog.BuildAll();
        }
    }
}
