// Original synthesized sound effects (WebAudio, no audio files / no licensing issues).
import { prefs } from './prefs';

let ac: AudioContext | null = null;
let master: GainNode | null = null;

function ctx() {
  if (!prefs.sound) return null;
  if (!ac) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.35;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

export function unlockAudio() {
  ctx();
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.5, slide = 0, delay = 0) {
  const a = ctx();
  if (!a || !master) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol = 0.5, lp = 1200) {
  const a = ctx();
  if (!a || !master) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lp;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

let lastBump = 0;

export const sfx = {
  click: () => tone(660, 0.06, 'triangle', 0.3),
  join: () => { tone(523, 0.1, 'square', 0.25); tone(784, 0.14, 'square', 0.25, 0, 0.08); },
  tick: () => tone(440, 0.12, 'square', 0.3),
  go: () => { tone(880, 0.35, 'square', 0.35, 200); },
  bump: () => {
    const n = performance.now();
    if (n - lastBump < 70) return;
    lastBump = n;
    tone(140, 0.12, 'sine', 0.6, -60);
  },
  dash: () => tone(300, 0.15, 'sawtooth', 0.2, 500),
  fall: () => tone(600, 0.6, 'triangle', 0.35, -520),
  power: () => { tone(660, 0.08, 'square', 0.25); tone(990, 0.08, 'square', 0.25, 0, 0.07); tone(1320, 0.12, 'square', 0.25, 0, 0.14); },
  coin: () => { tone(988, 0.07, 'square', 0.22); tone(1319, 0.18, 'square', 0.22, 0, 0.06); },
  boost: () => noise(0.4, 0.35, 2400),
  boom: () => { noise(0.9, 0.9, 700); tone(80, 0.6, 'sine', 0.7, -40); },
  pass: () => tone(500, 0.1, 'triangle', 0.4, 300),
  bad: () => tone(160, 0.3, 'sawtooth', 0.3, -60),
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.5 : 0.14, 'square', 0.25, 0, i * 0.12)),
};
