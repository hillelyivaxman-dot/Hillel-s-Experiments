import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { networkInterfaces } from 'node:os';

// Every context a test opens is closed after the test. Otherwise dozens of hidden host screens keep rendering
// at full speed for the rest of the run, the machine lags, and timing-based assertions become flaky.
const opened: BrowserContext[] = [];
const patched = new WeakSet<Browser>();
test.beforeEach(({ browser }) => {
  if (patched.has(browser)) return;
  patched.add(browser);
  const orig = browser.newContext.bind(browser);
  browser.newContext = (async (...args: Parameters<Browser['newContext']>) => {
    const c = await orig(...args);
    opened.push(c);
    return c;
  }) as Browser['newContext'];
});
test.afterEach(async () => {
  await Promise.all(opened.splice(0).map((c) => c.close().catch(() => {})));
});

export const HTTP = 'http://localhost:8790';
export const HTTPS = 'https://localhost:8443'; // TLS proxy with +50 ms latency each way (see playwright.config.ts)

export function lanIp(): string | null {
  for (const list of Object.values(networkInterfaces())) for (const i of list ?? []) if (i.family === 'IPv4' && !i.internal) return i.address;
  return null;
}

export async function newHost(browser: Browser, base = HTTP) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'en-US', ignoreHTTPSErrors: true });
  const h = await ctx.newPage();
  const errors: string[] = [];
  const sockets: string[] = [];
  h.on('pageerror', (e) => errors.push(String(e)));
  h.on('websocket', (ws) => sockets.push(ws.url()));
  await h.goto(`${base}/host`);
  await expect(h.getByTestId('room-code')).toBeVisible({ timeout: 15_000 });
  const code = (await h.getByTestId('room-code').innerText()).replace(/\s/g, '');
  return { h, ctx, code, errors, sockets };
}

export interface SentInput { x: number; y: number; b: number }

export async function newPhone(browser: Browser, url: string, name: string, opts: object = {}): Promise<{ p: Page; ctx: BrowserContext; sockets: string[]; inputs: SentInput[] }> {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, hasTouch: true, isMobile: true, locale: 'en-US', ignoreHTTPSErrors: true, ...opts });
  const p = await ctx.newPage();
  const sockets: string[] = [];
  const inputs: SentInput[] = []; // every controller message the phone actually sent
  p.on('websocket', (ws) => {
    sockets.push(ws.url());
    ws.on('framesent', (f) => {
      try {
        const m = JSON.parse(String(f.payload));
        if (m.t === 'input') inputs.push({ x: m.x, y: m.y, b: m.b });
      } catch { /* ignore */ }
    });
  });
  await p.goto(url);
  await p.locator('input[name="name"]').fill(name);
  await p.getByTestId('join-btn').click();
  await expect(p.getByTestId('ready-btn')).toBeVisible({ timeout: 15_000 });
  return { p, ctx, sockets, inputs };
}

export const frame = (h: Page) => h.evaluate(() => (window as any).__fcFrame);

export async function waitPlaying(h: Page) {
  await expect(h.locator('.overlay--countdown')).toBeVisible({ timeout: 10_000 }).catch(() => {});
  await expect(h.locator('.overlay--countdown')).toBeHidden({ timeout: 10_000 });
  await expect.poll(async () => (await frame(h))?.t ?? 0, { timeout: 10_000 }).toBeGreaterThan(0.2);
}

/** Player id of the phone (from its last 'joined' handshake is not exposed, so match by name on host state). */
export async function playerIds(h: Page): Promise<Record<string, string>> {
  return h.evaluate(() => {
    const out: Record<string, string> = {};
    document.querySelectorAll<HTMLElement>('[data-player][data-pid]').forEach((el) => { out[el.dataset.player!] = el.dataset.pid!; });
    return out;
  });
}

export function delta(f0: any, f1: any, key: string, id: string) {
  const a = f0[key].find((e: any) => e.id === id), b = f1[key].find((e: any) => e.id === id);
  return { dx: b.x - a.x, dy: b.y - a.y, da: (b.a ?? 0) - (a.a ?? 0), d: Math.hypot(b.x - a.x, b.y - a.y) };
}

/** Every pad button is on screen, >= 56px, not overlapping, and really tappable (nothing covers its centre). */
export async function padProblems(p: Page) {
  return p.evaluate(() => {
    const vw = innerWidth, vh = innerHeight, out: string[] = [];
    if (document.documentElement.scrollWidth > vw + 1) out.push(`horizontal scroll ${document.documentElement.scrollWidth}>${vw}`);
    if (document.documentElement.scrollHeight > vh + 1 && document.querySelector('.phone-game')) out.push('vertical scroll on controller');
    const btns = [...document.querySelectorAll<HTMLElement>('.pad-btn')];
    if (document.querySelector('.pad--stick') && !document.querySelector('.stick-zone')) out.push('stick missing');
    for (const e of btns) {
      const r = e.getBoundingClientRect(), k = e.dataset.btn;
      if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) out.push(`button ${k} off-screen`);
      if (Math.min(r.width, r.height) < 56) out.push(`button ${k} too small (${Math.round(r.width)})`);
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || !e.contains(hit)) out.push(`button ${k} covered by ${hit?.className || hit?.tagName}`);
    }
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i].getBoundingClientRect(), b = btns[j].getBoundingClientRect();
      const rect = btns[i].closest('.pad__choices') && btns[j].closest('.pad__choices'); // grid of rectangles (trivia / puzzle / board): compare rectangles, not circles
      if (rect) {
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`buttons ${btns[i].dataset.btn}/${btns[j].dataset.btn} overlap`);
        continue;
      }
      const d = Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2);
      if (d < (a.width + b.width) / 2 - 1) out.push(`buttons ${btns[i].dataset.btn}/${btns[j].dataset.btn} overlap`);
    }
    return out;
  });
}

/** Geometry of the steering wheel on a phone page: `at(deg)` = a point on the rim, clockwise from the top. */
export async function wheelAt(p: Page) {
  const b = (await p.locator('.wheel-zone').boundingBox())!;
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2, R = Math.min(b.width, b.height) * 0.32;
  return { cx, cy, R, at: (deg: number) => ({ x: cx + R * Math.sin((deg * Math.PI) / 180), y: cy - R * Math.cos((deg * Math.PI) / 180) }) };
}
