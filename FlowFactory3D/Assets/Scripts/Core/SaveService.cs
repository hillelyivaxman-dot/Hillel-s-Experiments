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
        /// <summary>1 = levels and settings, 2 = adds coins, stars, shop items, daily reward and ad counters.</summary>
        public const int SchemaVersion = 2;

        public int HighestUnlocked = 1;
        public int LastLevel = 1;
        public bool SoundOn = true;
        /// <summary>0 = quiet, 1 = medium, 2 = full.</summary>
        public int VolumeStep = 2;
        public readonly SortedSet<int> Completed = new SortedSet<int>();

        public int Coins;
        /// <summary>Best star rating (1-3) per completed level.</summary>
        public readonly SortedDictionary<int, int> Stars = new SortedDictionary<int, int>();
        /// <summary>Ids of owned shop items (free items are always owned, see ShopCatalog).</summary>
        public readonly SortedSet<string> Owned = new SortedSet<string>(StringComparer.Ordinal);
        public string Theme = ShopCatalog.DefaultTheme;
        public string Parcel = ShopCatalog.DefaultParcel;
        public int DailyStreak;
        /// <summary>Day number (see PlayerEconomy.DayNumber) of the last claimed daily gift; 0 = never.</summary>
        public int LastDailyDay;
        public int AdsDay;
        public int AdsToday;

        public bool IsUnlocked(int levelId)
        {
            return levelId >= 1 && levelId <= HighestUnlocked;
        }

        public bool IsCompleted(int levelId)
        {
            return Completed.Contains(levelId);
        }

        public int StarsFor(int levelId)
        {
            int stars;
            return Stars.TryGetValue(levelId, out stars) ? stars : 0;
        }

        public int TotalStars
        {
            get
            {
                int total = 0;
                foreach (int value in Stars.Values) total += value;
                return total;
            }
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
            sb.Append(";coins=").Append(Coins);
            var stars = new List<string>();
            foreach (KeyValuePair<int, int> pair in Stars) stars.Add(pair.Key + ":" + pair.Value);
            sb.Append(";stars=").Append(string.Join(",", stars));
            sb.Append(";owned=").Append(string.Join(",", Owned));
            sb.Append(";theme=").Append(Theme);
            sb.Append(";parcel=").Append(Parcel);
            sb.Append(";streak=").Append(DailyStreak);
            sb.Append(";daily=").Append(LastDailyDay);
            sb.Append(";adsday=").Append(AdsDay);
            sb.Append(";ads=").Append(AdsToday);
            return sb.ToString();
        }

        /// <summary>
        /// Parses saved text (schema 1 or 2). Returns null if the text is empty, damaged or written by a newer
        /// schema, in which case the caller starts from defaults instead of crashing.
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

            string list;
            if (map.TryGetValue("completed", out list) && list.Length > 0)
            {
                foreach (string item in list.Split(','))
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

            // Schema 2 fields; a schema 1 save simply has none of them.
            if (TryInt(map, "coins", out value)) data.Coins = Math.Max(0, value);
            if (map.TryGetValue("stars", out list) && list.Length > 0)
            {
                foreach (string item in list.Split(','))
                {
                    string[] pair = item.Split(':');
                    int id, stars;
                    if (pair.Length == 2 && int.TryParse(pair[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out id) &&
                        int.TryParse(pair[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out stars) &&
                        id >= 1 && id <= levelCount && stars >= 1 && stars <= 3)
                    {
                        data.Stars[id] = stars;
                    }
                }
            }
            if (map.TryGetValue("owned", out list) && list.Length > 0)
            {
                foreach (string item in list.Split(','))
                {
                    if (item.Length > 0) data.Owned.Add(item);
                }
            }
            string equipped;
            if (map.TryGetValue("theme", out equipped) && ShopCatalog.Find(equipped) != null && ShopCatalog.Find(equipped).Kind == ItemKind.Theme)
            {
                data.Theme = equipped;
            }
            if (map.TryGetValue("parcel", out equipped) && ShopCatalog.Find(equipped) != null && ShopCatalog.Find(equipped).Kind == ItemKind.Parcel)
            {
                data.Parcel = equipped;
            }
            // You can only wear what you own.
            if (!ShopCatalog.IsOwned(data.Owned, data.Theme)) data.Theme = ShopCatalog.DefaultTheme;
            if (!ShopCatalog.IsOwned(data.Owned, data.Parcel)) data.Parcel = ShopCatalog.DefaultParcel;
            if (TryInt(map, "streak", out value)) data.DailyStreak = Math.Max(0, value);
            if (TryInt(map, "daily", out value)) data.LastDailyDay = Math.Max(0, value);
            if (TryInt(map, "adsday", out value)) data.AdsDay = Math.Max(0, value);
            if (TryInt(map, "ads", out value)) data.AdsToday = Math.Max(0, value);
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

        public int LevelCount
        {
            get { return levelCount; }
        }

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

        /// <summary>Starts the levels over (unlocks and stars) but keeps coins, purchases and settings.</summary>
        public void ResetLevelProgress()
        {
            Data.Completed.Clear();
            Data.Stars.Clear();
            Data.HighestUnlocked = 1;
            Data.LastLevel = 1;
            Save();
        }

        public void ResetAll()
        {
            store.DeleteKey(Key);
            Data = new ProgressData();
        }
    }
}
