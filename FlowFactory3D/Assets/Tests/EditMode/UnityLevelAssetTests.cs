using System.Collections.Generic;
using FlowFactory.Core;
using NUnit.Framework;
using UnityEngine;

namespace FlowFactory.Tests
{
    /// <summary>Tests that need Unity types (ScriptableObject, Resources). Run them in the Test Runner, EditMode tab.</summary>
    public class UnityLevelAssetTests
    {
        [Test]
        public void LevelDefinition_RoundTripsLevelData()
        {
            LevelData data = LevelCatalog.BuildAll()[4];
            var definition = ScriptableObject.CreateInstance<LevelDefinition>();
            try
            {
                definition.CopyFrom(data);
                LevelData back = definition.ToLevelData();

                Assert.AreEqual(data.id, back.id);
                Assert.AreEqual(data.width, back.width);
                Assert.AreEqual(data.height, back.height);
                CollectionAssert.AreEqual(data.tiles, back.tiles);
                CollectionAssert.AreEqual(data.solution, back.solution);
                CollectionAssert.IsEmpty(LevelValidator.Validate(back));
            }
            finally
            {
                Object.DestroyImmediate(definition);
            }
        }

        [Test]
        public void Repository_ProvidesTwelveValidLevels()
        {
            IList<LevelData> levels = LevelRepository.LoadAll();
            Assert.AreEqual(12, levels.Count);
            for (int i = 0; i < levels.Count; i++)
            {
                Assert.AreEqual(i + 1, levels[i].id);
                CollectionAssert.IsEmpty(LevelValidator.Validate(levels[i]), "level " + (i + 1));
            }
        }

        [Test]
        public void GeneratedAssets_MatchTheCatalog_WhenPresent()
        {
            LevelDefinition[] assets = Resources.LoadAll<LevelDefinition>(LevelRepository.ResourcesFolder);
            if (assets.Length == 0)
            {
                Assert.Ignore("No level assets yet: run the menu Flow Factory > Generate Level Assets.");
            }

            Assert.AreEqual(12, assets.Length);
            foreach (LevelDefinition asset in assets)
            {
                CollectionAssert.IsEmpty(LevelValidator.Validate(asset.ToLevelData()), asset.name);
            }
        }
    }
}
