import { useState } from 'react';
import { store } from '../net';
import type { SizePref } from './layout';

export interface PadSettings {
  size: SizePref; // button size S / M / L
  mirrored: boolean; // left-handed: stick on the right
  steer: 'wheel' | 'arrows' | 'tilt'; // racing games: how to steer
  tiltInvert: boolean;
  cam: 'cockpit' | 'bumper' | 'chase'; // Kart Chaos personal 3D view
  gas: 'auto' | 'manual'; // racing: accelerate by itself, or only while GAS is held
  sens: number; // steering sensitivity multiplier (0.6 .. 1.5)
}

const KEY = 'fc.pad';
const DEFAULTS: PadSettings = { size: 'm', mirrored: false, steer: 'arrows', tiltInvert: false, cam: 'chase', gas: 'auto', sens: 1 };

function load(): PadSettings {
  try {
    const v = JSON.parse(store.get(KEY) ?? '{}');
    return {
      size: v.size === 's' || v.size === 'l' ? v.size : 'm',
      mirrored: v.mirrored === true,
      steer: v.steer === 'wheel' || v.steer === 'tilt' ? v.steer : 'arrows',
      tiltInvert: v.tiltInvert === true,
      cam: v.cam === 'cockpit' || v.cam === 'bumper' ? v.cam : 'chase',
      gas: v.gas === 'manual' ? 'manual' : 'auto',
      sens: typeof v.sens === 'number' ? Math.max(0.6, Math.min(1.5, v.sens)) : 1,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Per-device controller preferences (stored only on this phone). */
export function usePadSettings(): [PadSettings, (p: Partial<PadSettings>) => void] {
  const [s, setS] = useState(load);
  const update = (p: Partial<PadSettings>) => {
    const next = { ...s, ...p };
    store.set(KEY, JSON.stringify(next));
    setS(next);
  };
  return [s, update];
}
