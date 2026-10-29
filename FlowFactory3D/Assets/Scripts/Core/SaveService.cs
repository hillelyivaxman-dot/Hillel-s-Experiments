using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace FlowFactory.Core
{
    /// <summary>Minimal string storage so progress can be tested without Unity (PlayerPrefs implements it at runtime).</summary>
    public interface IKeyValueStore
    {
        bool TryGetString(string key, out string value);
        void SetString(string key, string value);
        void DeleteKey(string key);
        void Flush();
    }

    public sealed class MemoryStore : IKeyValueStore
    {
        private readonly Dictionary<string, string> values = new Dictionary<string, string>();

        public bool TryGetString(string key, out string value)
        {
            return values.TryGetValue(key, out value);
        }

        public void SetString(string key, string value)
        {
            values[key] = value;
        }

        public void DeleteKey(string key)
        {
            values.Remove(key);
        }

        public void Flush()
        {
        }
    }

    /// <summary>Everything that persists between sessions.</summary>
    public sealed class ProgressData
    {
        public const int SchemaVersion = 1;

        public int HighestUnlocked = 1;
        public int LastLevel = 1;
        public bool SoundOn = true;
        /// <summary>0 = quiet, 1 = medium, 2 = full.</summary>
        public int VolumeStep = 2;
        public readonly SortedSet<int> Completed = new SortedSet<int>();

        public bool IsUnlocked(int levelId)
        {
            return levelId >= 1 && levelId <= HighestUnlocked;
        }

        public bool IsCompleted(int levelId)
        {
            return Completed.Contains(levelId);
        }

        /// <summary>Marks a level done and unlocks the next one (up to <paramref name="levelCount"/>).</summary>
        public void MarkCompleted(int levelId, int levelCount)
        {
            Completed.Add(levelId);
            int next = Math.Min(levelId + 1, levelCount);
            if (next > HighestUnlocked) HighestUnlocked = next;
        }

        public string Serialize()
        {
            var sb = new StringBuilder();
            sb.Append("v=").Append(SchemaVersion);
            sb.Append(";unlocked=").Append(HighestUnlocked);
            sb.Append(";last=").Append(LastLevel);
            sb.Append(";sound=").Append(SoundOn ? 1 : 0);
            sb.Append(";volume=").Append(VolumeStep);
            sb.Append(";completed=").Append(string.Join(",", Completed));
            return sb.ToString();
        }

        /// <summary>
        /// Parses saved text. Returns null if the text is empty, damaged or written by a newer schema,
        /// in which case the caller starts from defaults instead of crashing.
        /// </summary>
        public static ProgressData Parse(string text, int levelCount)
        {
            if (string.IsNullOrEmpty(text)) return null;

            var map = new Dictionary<string, string>();
            foreach (string part in text.Split(';'))
            {
                int eq = part.IndexOf('=');
                if (eq <= 0) return null;
                map[part.Substring(0, eq)] = part.Substring(eq + 1);
            }

            int version;
            if (!TryInt(map, "v", out version) || version < 1 || version > SchemaVersion) return null;

            var data = new ProgressData();
            int value;
            if (TryInt(map, "unlocked", out value)) data.HighestUnlocked = Clamp(value, 1, levelCount);
            if (TryInt(map, "last", out value)) data.LastLevel = Clamp(value, 1, levelCount);
            if (TryInt(map, "sound", out value)) data.SoundOn = value != 0;
            if (TryInt(map, "volume", out value)) data.VolumeStep = Clamp(value, 0, 2);

            string completed;
            if (map.TryGetValue("completed", out completed) && completed.Length > 0)
            {
                foreach (string item in completed.Split(','))
                {
                    int id;
                    if (int.TryParse(item, NumberStyles.Integer, CultureInfo.InvariantCulture, out id) && id >= 1 && id <= levelCount)
                    {
                        data.Completed.Add(id);
                    }
                }
            }

            // A completed level always implies the next one is unlocked.
            foreach (int id in data.Completed)
            {
                data.HighestUnlocked = Math.Max(data.HighestUnlocked, Math.Min(id + 1, levelCount));
            }
            data.LastLevel = Clamp(data.LastLevel, 1, data.HighestUnlocked);
            return data;
        }

        private static bool TryInt(Dictionary<string, string> map, string key, out int value)
        {
            value = 0;
            string text;
            return map.TryGetValue(key, out text) && int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out value);
        }

        private static int Clamp(int value, int min, int max)
        {
            return value < min ? min : value > max ? max : value;
        }
    }

    public sealed class SaveService
    {
        public const string Key = "flowfactory.progress";

        private readonly IKeyValueStore store;
        private readonly int levelCount;

        public ProgressData Data { get; private set; }

        public SaveService(IKeyValueStore store, int levelCount)
        {
            this.store = store;
            this.levelCount = levelCount;
            Load();
        }

        public void Load()
        {
            string text;
            ProgressData parsed = store.TryGetString(Key, out text) ? ProgressData.Parse(text, levelCount) : null;
            Data = parsed ?? new ProgressData();
        }

        public void Save()
        {
            store.SetString(Key, Data.Serialize());
            store.Flush();
        }

        public void CompleteLevel(int levelId)
        {
            Data.MarkCompleted(levelId, levelCount);
            Save();
        }

        public void SetLastLevel(int levelId)
        {
            Data.LastLevel = levelId;
            Save();
        }

        public void ResetAll()
        {
            store.DeleteKey(Key);
            Data = new ProgressData();
        }
    }
}
