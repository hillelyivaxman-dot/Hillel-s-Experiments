// Small compatibility layer so the site runs in current Chrome, Edge, Firefox and Safari (iOS 14+),
// with no app, plug-in or PWA install.

/** Features the site really needs. Everything else degrades gracefully (vibration, wake lock, clipboard…). */
export function isSupported(): boolean {
  return typeof WebSocket !== 'undefined' && typeof window.PointerEvent !== 'undefined' &&
    typeof CanvasRenderingContext2D !== 'undefined' && typeof Promise !== 'undefined';
}

export function installCompat() {
  // CanvasRenderingContext2D.roundRect: Safari < 16, Firefox < 112.
  const proto = CanvasRenderingContext2D.prototype as CanvasRenderingContext2D & { roundRect?: unknown };
  if (typeof proto.roundRect !== 'function') {
    proto.roundRect = function roundRect(this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radii?: number | DOMPointInit | (number | DOMPointInit)[]) {
      const first = Array.isArray(radii) ? radii[0] : radii;
      const r0 = typeof first === 'number' ? first : first?.x ?? 0;
      const r = Math.max(0, Math.min(r0, Math.abs(w) / 2, Math.abs(h) / 2));
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
    } as CanvasRenderingContext2D['roundRect'];
  }
  // iOS Safari ignores user-scalable=no; block pinch-zoom gestures so two-finger play doesn't zoom the page.
  for (const ev of ['gesturestart', 'gesturechange']) {
    document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  }
}

type WakeNav = Navigator & { wakeLock?: { request(t: 'screen'): Promise<unknown> } };
let wakeWanted = false;
/** Keep a phone controller's screen on (Chrome/Edge Android, Safari 16.4+). The browser drops the
 *  lock whenever the tab is hidden, so it is requested again when the page becomes visible. */
export function keepScreenOn() {
  const nav = navigator as WakeNav;
  if (!nav.wakeLock) return;
  const req = () => nav.wakeLock!.request('screen').catch(() => {});
  if (!wakeWanted) {
    wakeWanted = true;
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') req(); });
  }
  req();
}
