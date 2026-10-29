using System;

namespace FlowFactory.Core
{
    public enum LevelState
    {
        /// <summary>The player is editing belts.</summary>
        Idle,
        /// <summary>A parcel is travelling; input is locked.</summary>
        Running,
        Success,
        /// <summary>The last run failed; the view is showing why. Call <see cref="LevelManager.ReturnToEditing"/> afterwards.</summary>
        Failure
    }

    /// <summary>
    /// Game state of the level being played: current rotations and the Idle/Running/Success/Failure
    /// state machine. Pure logic; the view reacts to its events.
    /// </summary>
    public sealed class LevelManager
    {
        public LevelData Level { get; private set; }
        public int[] Rotations { get; private set; }
        public LevelState State { get; private set; }
        public RouteResult LastResult { get; private set; }
        /// <summary>Number of times Run was pressed on this level since it was loaded.</summary>
        public int Attempts { get; private set; }
        public int TapCount { get; private set; }

        public event Action<int, int> TileRotated;
        public event Action<LevelState> StateChanged;
        public event Action LevelReset;

        public void Load(LevelData level)
        {
            Level = level;
            Rotations = level.InitialRotations();
            Attempts = 0;
            TapCount = 0;
            LastResult = null;
            SetState(LevelState.Idle);
        }

        /// <summary>Rotates one tile by 90 degrees clockwise. Only possible while editing.</summary>
        public bool TryRotate(int x, int y)
        {
            if (State != LevelState.Idle || Level == null || !Level.InBounds(x, y))
            {
                return false;
            }

            int index = Level.IndexOf(x, y);
            if (!Level.tiles[index].rotatable)
            {
                return false;
            }

            Rotations[index] = (Rotations[index] + 1) & 3;
            TapCount++;
            if (TileRotated != null) TileRotated(x, y);
            return true;
        }

        /// <summary>
        /// Starts a run. Ignored (returns null) unless the level is idle, so a double press can never
        /// launch two parcels.
        /// </summary>
        public RouteResult Run()
        {
            if (State != LevelState.Idle || Level == null)
            {
                return null;
            }

            Attempts++;
            LastResult = RouteValidator.Validate(Level, Rotations);
            SetState(LevelState.Running);
            return LastResult;
        }

        /// <summary>Called by the view when the parcel animation has ended.</summary>
        public void CompleteRun()
        {
            if (State != LevelState.Running)
            {
                return;
            }
            SetState(LastResult != null && LastResult.Success ? LevelState.Success : LevelState.Failure);
        }

        public void ReturnToEditing()
        {
            if (State == LevelState.Failure)
            {
                SetState(LevelState.Idle);
            }
        }

        /// <summary>Restores every tile to its starting rotation and goes back to editing, from any state.</summary>
        public void ResetLevel()
        {
            if (Level == null)
            {
                return;
            }
            Rotations = Level.InitialRotations();
            LastResult = null;
            SetState(LevelState.Idle);
            if (LevelReset != null) LevelReset();
        }

        private void SetState(LevelState state)
        {
            State = state;
            if (StateChanged != null) StateChanged(state);
        }
    }
}
