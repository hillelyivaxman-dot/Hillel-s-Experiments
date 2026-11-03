import { useState } from 'react';
import { store } from '../net';
import type { SizePref } from './layout';

export interface PadSettings {
  size: SizePref; // button size S / M / L
  mirrored: boolean; // left-handed: stick on the right
}

const KEY = 'fc.pad';
const DEFAULTS: PadSettings = { size: 'm', mirrored: false };

function load(): PadSettings {
  try {
    const v = JSON.parse(store.get(KEY) ?? '{}');
    return {
      size: v.size === 's' || v.size === 'l' ? v.size : 'm',
      mirrored: v.mirrored === true,
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
