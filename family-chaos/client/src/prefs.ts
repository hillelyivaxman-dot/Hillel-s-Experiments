import { store } from './net';

// Per-viewer preferences (sound on/off, reduced animations). Stored locally only.
export const prefs = {
  sound: store.get('fc.sound') !== '0',
  reducedMotion:
    store.get('fc.motion') === 'reduced' ||
    (store.get('fc.motion') === null && typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches),
};

export function setSound(on: boolean) {
  prefs.sound = on;
  store.set('fc.sound', on ? '1' : '0');
}

export function setReducedMotion(r: boolean) {
  prefs.reducedMotion = r;
  store.set('fc.motion', r ? 'reduced' : 'full');
  document.documentElement.dataset.motion = r ? 'reduced' : 'full';
}
