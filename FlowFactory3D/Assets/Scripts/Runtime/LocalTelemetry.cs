using System;
using System.IO;
using UnityEngine;

namespace FlowFactory
{
    /// <summary>
    /// Local test log only: appends events to telemetry.log in the app's data folder (and the Console in
    /// debug builds). No network, no account, no device or personal identifiers; the session id is random
    /// and only exists for the current run.
    /// Events: session_start, tutorial_start, tutorial_complete, level_start, level_success, level_retry, session_end.
    /// </summary>
    public sealed class LocalTelemetry
    {
        private readonly string sessionId = Guid.NewGuid().ToString("N").Substring(0, 8);
        private readonly string path;
        private bool sessionEnded;

        public LocalTelemetry()
        {
            path = Path.Combine(Application.persistentDataPath, "telemetry.log");
        }

        public string FilePath
        {
            get { return path; }
        }

        /// <summary>Allows another session_end after the app was resumed from the background.</summary>
        public void Reopen()
        {
            sessionEnded = false;
        }

        public void Log(string name, string details = "")
        {
            if (name == "session_end")
            {
                if (sessionEnded) return;
                sessionEnded = true;
            }

            string line = DateTime.UtcNow.ToString("o") + "\t" + sessionId + "\t" + name + "\t" + details;
            if (Debug.isDebugBuild)
            {
                Debug.Log("[telemetry] " + name + " " + details);
            }

            try
            {
                File.AppendAllText(path, line + Environment.NewLine);
            }
            catch (Exception e)
            {
                Debug.LogWarning("[FlowFactory] Could not write telemetry: " + e.Message);
            }
        }
    }
}
