import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { networkInterfaces } from 'node:os';

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

export async function newPhone(browser: Browser, url: string, name: string): Promise<{ p: Page; ctx: BrowserContext; sockets: string[] }> {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, hasTouch: true, isMobile: true, locale: 'en-US', ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const sockets: string[] = [];
  p.on('websocket', (ws) => sockets.push(ws.url()));
  await p.goto(url);
  await p.locator('input[name="name"]').fill(name);
  await p.getByTestId('join-btn').click();
  await expect(p.getByTestId('ready-btn')).toBeVisible({ timeout: 15_000 });
  return { p, ctx, sockets };
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
