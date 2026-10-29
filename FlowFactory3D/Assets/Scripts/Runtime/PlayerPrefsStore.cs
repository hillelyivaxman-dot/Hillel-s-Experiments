using FlowFactory.Core;
using UnityEngine;

namespace FlowFactory
{
    public sealed class PlayerPrefsStore : IKeyValueStore
    {
        public bool TryGetString(string key, out string value)
        {
            if (PlayerPrefs.HasKey(key))
            {
                value = PlayerPrefs.GetString(key);
                return true;
            }
            value = null;
            return false;
        }

        public void SetString(string key, string value)
        {
            PlayerPrefs.SetString(key, value);
        }

        public void DeleteKey(string key)
        {
            PlayerPrefs.DeleteKey(key);
        }

        public void Flush()
        {
            PlayerPrefs.Save();
        }
    }
}
