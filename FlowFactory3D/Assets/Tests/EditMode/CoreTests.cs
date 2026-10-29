using System.Collections.Generic;
using FlowFactory.Core;
using NUnit.Framework;

namespace FlowFactory.Tests
{
    public class RouteValidatorTests
    {
        private static LevelData Level(int number)
        {
            return LevelCatalog.BuildAll()[number - 1];
        }

        [Test]
        public void ValidPath_ReachesTarget()
        {
            LevelData level = Level(1);
            RouteResult result = RouteValidator.Validate(level, level.solution);

            Assert.IsTrue(result.Success);
            Assert.AreEqual(FailureReason.None, result.Reason);
            // source (1,2) -> corner (1,1) -> target (2,1)
            CollectionAssert.AreEqual(
                new[] { new GridPoint(1, 2), new GridPoint(1, 1), new GridPoint(2, 1) },
                result.Path);
        }

        [Test]
        public void InitialState_IsNotSolved_ForEveryLevel()
        {
            foreach (LevelData level in LevelCatalog.BuildAll())
            {
                Assert.IsFalse(RouteValidator.Validate(level, level.InitialRotations()).Success, "level " + level.id);
            }
        }

        [Test]
        public void BlockedPath_FailsAtBlockedCell()
        {
            LevelData level = Level(1);
            level.tiles[level.IndexOf(1, 1)] = new TileSpec(TileKind.Block, 0, false);

            RouteResult result = RouteValidator.Validate(level, level.solution);

            Assert.IsFalse(result.Success);
            Assert.AreEqual(FailureReason.BlockedCell, result.Reason);
            Assert.AreEqual(new GridPoint(1, 1), result.FailCell);
        }

        [Test]
        public void MissingConnection_EmptyCellAhead_Fails()
        {
            LevelData level = Level(1);
            level.tiles[level.IndexOf(1, 1)] = new TileSpec(TileKind.Empty, 0, false);

            RouteResult result = RouteValidator.Validate(level, level.solution);

            Assert.IsFalse(result.Success);
            Assert.AreEqual(FailureReason.EmptyCell, result.Reason);
            Assert.AreEqual(new GridPoint(1, 1), result.FailCell);
            Assert.AreEqual(Direction.North, result.FailDirection);
            CollectionAssert.AreEqual(new[] { new GridPoint(1, 2) }, result.Path);
        }

        [Test]
        public void WrongConnection_BeltFacingAway_Fails()
        {
            LevelData level = Level(1);
            int[] rotations = level.InitialRotations(); // corner still at N+E: no opening on the south side

            RouteResult result = RouteValidator.Validate(level, rotations);

            Assert.IsFalse(result.Success);
            Assert.AreEqual(FailureReason.WrongConnection, result.Reason);
            Assert.AreEqual(new GridPoint(1, 1), result.FailCell);
        }

        [Test]
        public void LeavingTheBoard_Fails()
        {
            // Source opens to the north at the top row of a board: the parcel leaves immediately.
            var level = new LevelData
            {
                id = 99, width = 2, height = 2,
                tiles = new[]
                {
                    new TileSpec(TileKind.Source, 0, false), new TileSpec(TileKind.Empty, 0, false),
                    new TileSpec(TileKind.Empty, 0, false), new TileSpec(TileKind.Target, 0, false)
                },
                solution = new int[4]
            };

            RouteResult result = RouteValidator.Validate(level, level.InitialRotations());

            Assert.AreEqual(FailureReason.OffBoard, result.Reason);
            Assert.AreEqual(new GridPoint(0, 0), result.FailCell);
        }

        [Test]
        public void StepLimit_StopsRunawayRoutes()
        {
            LevelData level = Level(9); // a long snake
            RouteResult result = RouteValidator.Validate(level, level.solution, 3);

            Assert.IsFalse(result.Success);
            Assert.AreEqual(FailureReason.StepLimit, result.Reason);
        }

        [Test]
        public void Conveyor_ExitIsTheOtherOpening()
        {
            Direction exit;
            Assert.IsTrue(TileGeometry.TryGetExit(TileKind.Corner, 1, Direction.East, out exit)); // E+S
            Assert.AreEqual(Direction.South, exit);
            Assert.IsTrue(TileGeometry.TryGetExit(TileKind.Straight, 1, Direction.West, out exit)); // E+W
            Assert.AreEqual(Direction.East, exit);
            Assert.IsFalse(TileGeometry.TryGetExit(TileKind.Straight, 1, Direction.North, out exit));
        }
    }

    public class LevelCatalogTests
    {
        [Test]
        public void Has12ValidLevels_WithKnownSolutions()
        {
            IList<LevelData> levels = LevelCatalog.BuildAll();
            Assert.AreEqual(12, levels.Count);
            for (int i = 0; i < levels.Count; i++)
            {
                Assert.AreEqual(i + 1, levels[i].id);
                CollectionAssert.IsEmpty(LevelValidator.Validate(levels[i]), "level " + (i + 1));
                Assert.GreaterOrEqual(levels[i].MinimumTaps(), 1, "level " + (i + 1));
            }
        }

        [Test]
        public void BoardSizes_Are4x4Early_And5x5Later()
        {
            IList<LevelData> levels = LevelCatalog.BuildAll();
            for (int i = 0; i < 4; i++) Assert.AreEqual(4, levels[i].width, "level " + (i + 1));
            for (int i = 4; i < 12; i++) Assert.AreEqual(5, levels[i].width, "level " + (i + 1));
            foreach (LevelData level in levels) Assert.AreEqual(level.width, level.height);
        }

        [Test]
        public void OnlyFirstTwoLevels_AreTutorials()
        {
            IList<LevelData> levels = LevelCatalog.BuildAll();
            for (int i = 0; i < levels.Count; i++) Assert.AreEqual(i < 2, levels[i].isTutorial);
        }

        [Test]
        public void LevelOne_NeedsExactlyOneTap()
        {
            Assert.AreEqual(1, LevelCatalog.BuildAll()[0].MinimumTaps());
        }

        [Test]
        public void Difficulty_IsNonDecreasingInRotatableTiles_Roughly()
        {
            IList<LevelData> levels = LevelCatalog.BuildAll();
            Assert.Less(levels[0].RotatableCount, levels[4].RotatableCount);
            Assert.Less(levels[4].RotatableCount, levels[10].RotatableCount);
        }
    }

    public class LevelManagerTests
    {
        private static LevelManager Loaded(int number)
        {
            var manager = new LevelManager();
            manager.Load(LevelCatalog.BuildAll()[number - 1]);
            return manager;
        }

        [Test]
        public void Tap_RotatesExactlyOneTileOnce()
        {
            LevelManager manager = Loaded(1);
            int rotations = 0;
            manager.TileRotated += (x, y) => rotations++;
            int index = manager.Level.IndexOf(1, 1);
            int before = manager.Rotations[index];

            Assert.IsTrue(manager.TryRotate(1, 1));

            Assert.AreEqual(1, rotations);
            Assert.AreEqual((before + 1) & 3, manager.Rotations[index]);
            for (int i = 0; i < manager.Rotations.Length; i++)
            {
                if (i != index) Assert.AreEqual(manager.Level.tiles[i].rotation, manager.Rotations[i]);
            }
        }

        [Test]
        public void Tap_OnFixedOrEmptyTile_DoesNothing()
        {
            LevelManager manager = Loaded(1);
            Assert.IsFalse(manager.TryRotate(1, 2)); // source
            Assert.IsFalse(manager.TryRotate(0, 0)); // empty
            Assert.IsFalse(manager.TryRotate(-1, 0));
            Assert.AreEqual(0, manager.TapCount);
        }

        [Test]
        public void ValidRun_EndsInSuccess()
        {
            LevelManager manager = Loaded(1);
            manager.TryRotate(1, 1);

            RouteResult result = manager.Run();
            Assert.IsTrue(result.Success);
            Assert.AreEqual(LevelState.Running, manager.State);

            manager.CompleteRun();
            Assert.AreEqual(LevelState.Success, manager.State);
        }

        [Test]
        public void InvalidRun_FailsFriendly_AndReturnsToEditing()
        {
            LevelManager manager = Loaded(1);

            RouteResult result = manager.Run();
            Assert.IsFalse(result.Success);
            manager.CompleteRun();
            Assert.AreEqual(LevelState.Failure, manager.State);

            manager.ReturnToEditing();
            Assert.AreEqual(LevelState.Idle, manager.State);
            Assert.IsTrue(manager.TryRotate(1, 1)); // still editable, no penalty
            Assert.AreEqual(1, manager.Attempts);
        }

        [Test]
        public void SecondRun_WhileRunning_IsIgnored()
        {
            LevelManager manager = Loaded(1);
            int changes = 0;
            manager.StateChanged += s => changes++;

            Assert.IsNotNull(manager.Run());
            Assert.IsNull(manager.Run());

            Assert.AreEqual(1, manager.Attempts);
            Assert.AreEqual(1, changes);
        }

        [Test]
        public void Rotate_WhileRunning_IsIgnored()
        {
            LevelManager manager = Loaded(1);
            manager.Run();
            Assert.IsFalse(manager.TryRotate(1, 1));
        }

        [Test]
        public void EveryLevel_IsSolvableByTapping_InMinimumTaps()
        {
            foreach (LevelData level in LevelCatalog.BuildAll())
            {
                var manager = new LevelManager();
                manager.Load(level);

                for (int i = 0; i < level.tiles.Length; i++)
                {
                    TileSpec tile = level.tiles[i];
                    if (!tile.rotatable) continue;
                    int x = i % level.width;
                    int y = i / level.width;
                    while (TileGeometry.Openings(tile.kind, manager.Rotations[i]) != TileGeometry.Openings(tile.kind, level.solution[i]))
                    {
                        Assert.IsTrue(manager.TryRotate(x, y));
                    }
                }

                Assert.AreEqual(level.MinimumTaps(), manager.TapCount, "level " + level.id);
                RouteResult result = manager.Run();
                Assert.IsTrue(result.Success, "level " + level.id);
                manager.CompleteRun();
                Assert.AreEqual(LevelState.Success, manager.State, "level " + level.id);
            }
        }

        [Test]
        public void Reset_RestoresAllRotations_FromAnyState()
        {
            LevelManager manager = Loaded(5);
            int[] initial = (int[])manager.Rotations.Clone();
            manager.TryRotate(1, 1);
            manager.TryRotate(2, 1);
            manager.TryRotate(2, 1);
            CollectionAssert.AreNotEqual(initial, manager.Rotations);

            manager.Run();
            manager.ResetLevel();

            CollectionAssert.AreEqual(initial, manager.Rotations);
            Assert.AreEqual(LevelState.Idle, manager.State);
        }
    }

    public class SaveServiceTests
    {
        [Test]
        public void NewGame_OnlyFirstLevelUnlocked()
        {
            var save = new SaveService(new MemoryStore(), 12);
            Assert.IsTrue(save.Data.IsUnlocked(1));
            Assert.IsFalse(save.Data.IsUnlocked(2));
        }

        [Test]
        public void CompletingLevel_UnlocksTheNext_ButNotBeyond()
        {
            var save = new SaveService(new MemoryStore(), 12);
            save.CompleteLevel(1);
            Assert.IsTrue(save.Data.IsUnlocked(2));
            Assert.IsFalse(save.Data.IsUnlocked(3));
            Assert.IsTrue(save.Data.IsCompleted(1));

            save.CompleteLevel(2);
            Assert.IsTrue(save.Data.IsUnlocked(3));
        }

        [Test]
        public void CompletingLastLevel_DoesNotUnlockLevel13()
        {
            var save = new SaveService(new MemoryStore(), 12);
            for (int i = 1; i <= 12; i++) save.CompleteLevel(i);
            Assert.IsFalse(save.Data.IsUnlocked(13));
            Assert.AreEqual(12, save.Data.HighestUnlocked);
        }

        [Test]
        public void SaveAndLoad_RoundTrips_AfterRestart()
        {
            var store = new MemoryStore();
            var first = new SaveService(store, 12);
            first.CompleteLevel(1);
            first.CompleteLevel(2);
            first.SetLastLevel(3);
            first.Data.SoundOn = false;
            first.Data.VolumeStep = 1;
            first.Save();

            var second = new SaveService(store, 12); // "app restart": new service over the same storage

            Assert.AreEqual(3, second.Data.HighestUnlocked);
            Assert.AreEqual(3, second.Data.LastLevel);
            Assert.IsTrue(second.Data.IsCompleted(1));
            Assert.IsTrue(second.Data.IsCompleted(2));
            Assert.IsFalse(second.Data.IsCompleted(3));
            Assert.IsFalse(second.Data.SoundOn);
            Assert.AreEqual(1, second.Data.VolumeStep);
        }

        [Test]
        public void DamagedOrNewerSave_FallsBackToDefaults()
        {
            foreach (string text in new[] { "garbage", "v=1;unlocked", "v=99;unlocked=7", "v=1;unlocked=abc;completed=x,y", "" })
            {
                var store = new MemoryStore();
                store.SetString(SaveService.Key, text);
                var save = new SaveService(store, 12);
                Assert.GreaterOrEqual(save.Data.HighestUnlocked, 1, text);
                Assert.LessOrEqual(save.Data.HighestUnlocked, 12, text);
            }
        }

        [Test]
        public void OutOfRangeValues_AreClamped()
        {
            var store = new MemoryStore();
            store.SetString(SaveService.Key, "v=1;unlocked=500;last=-4;sound=1;volume=9;completed=1,2,77");
            var save = new SaveService(store, 12);
            Assert.AreEqual(12, save.Data.HighestUnlocked);
            Assert.AreEqual(1, save.Data.LastLevel);
            Assert.AreEqual(2, save.Data.VolumeStep);
            Assert.IsFalse(save.Data.IsCompleted(77));
        }

        [Test]
        public void ResetAll_ReturnsToFirstLevel()
        {
            var store = new MemoryStore();
            var save = new SaveService(store, 12);
            save.CompleteLevel(1);
            save.ResetAll();
            Assert.IsFalse(save.Data.IsUnlocked(2));
            Assert.IsFalse(new SaveService(store, 12).Data.IsUnlocked(2));
        }
    }
}
