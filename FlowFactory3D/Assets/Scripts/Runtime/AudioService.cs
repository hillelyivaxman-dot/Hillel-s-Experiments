using UnityEngine;

namespace FlowFactory
{
    public enum Sfx
    {
        Click,
        Rotate,
        Run,
        Deliver,
        Success,
        Fail,
        Coin
    }

    /// <summary>Plays short procedurally generated sounds (no audio files needed). Respects the saved settings.</summary>
    public sealed class AudioService : MonoBehaviour
    {
        private const int SampleRate = 44100;
        private static readonly float[] Volumes = { 0.25f, 0.6f, 1f };

        private AudioSource source;
        private AudioClip[] clips;

        public bool Enabled = true;
        public int VolumeStep = 2;

        private void Awake()
        {
            source = gameObject.AddComponent<AudioSource>();
            source.playOnAwake = false;
            source.spatialBlend = 0f;

            clips = new AudioClip[7];
            clips[(int)Sfx.Click] = Tone("click", 0.05f, 880f, 880f);
            clips[(int)Sfx.Rotate] = Tone("rotate", 0.07f, 520f, 640f);
            clips[(int)Sfx.Run] = Tone("run", 0.22f, 260f, 520f);
            clips[(int)Sfx.Deliver] = Tone("deliver", 0.16f, 330f, 200f);
            clips[(int)Sfx.Success] = Arpeggio("success", new[] { 523.25f, 659.25f, 783.99f, 1046.5f }, 0.11f);
            clips[(int)Sfx.Fail] = Tone("fail", 0.30f, 220f, 110f);
            clips[(int)Sfx.Coin] = Arpeggio("coin", new[] { 987.77f, 1318.5f }, 0.07f);
        }

        public void Play(Sfx sfx)
        {
            if (!Enabled || clips == null) return;
            float volume = Volumes[Mathf.Clamp(VolumeStep, 0, Volumes.Length - 1)];
            source.PlayOneShot(clips[(int)sfx], volume);
        }

        private static AudioClip Tone(string name, float seconds, float startHz, float endHz)
        {
            int count = Mathf.CeilToInt(seconds * SampleRate);
            var data = new float[count];
            float phase = 0f;
            for (int i = 0; i < count; i++)
            {
                float t = i / (float)count;
                float hz = Mathf.Lerp(startHz, endHz, t);
                phase += 2f * Mathf.PI * hz / SampleRate;
                data[i] = Mathf.Sin(phase) * Envelope(t) * 0.5f;
            }
            return MakeClip(name, data);
        }

        private static AudioClip Arpeggio(string name, float[] notes, float noteSeconds)
        {
            int perNote = Mathf.CeilToInt(noteSeconds * SampleRate);
            var data = new float[perNote * notes.Length];
            for (int n = 0; n < notes.Length; n++)
            {
                float phase = 0f;
                for (int i = 0; i < perNote; i++)
                {
                    phase += 2f * Mathf.PI * notes[n] / SampleRate;
                    data[n * perNote + i] = Mathf.Sin(phase) * Envelope(i / (float)perNote) * 0.5f;
                }
            }
            return MakeClip(name, data);
        }

        /// <summary>Short fade in and out so clips never click.</summary>
        private static float Envelope(float t)
        {
            return Mathf.Clamp01(t / 0.08f) * Mathf.Clamp01((1f - t) / 0.5f);
        }

        private static AudioClip MakeClip(string name, float[] data)
        {
            AudioClip clip = AudioClip.Create(name, data.Length, 1, SampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }
    }
}
