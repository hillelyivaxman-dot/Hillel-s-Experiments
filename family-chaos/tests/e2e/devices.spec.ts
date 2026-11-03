import { devices, expect, test, type Page } from '@playwright/test';
import { CATALOG } from '../../shared/catalog';
import { HTTP, padProblems, waitPlaying } from './util';

// Website-only check across screen sizes. These run in Chromium with each device's viewport,
// touch, pixel ratio and user agent — this is NOT a real Safari/WebKit engine (see docs/BROWSERS.md).

const PHONES: [string, object][] = [
  ['iPhone SE', devices['iPhone SE']],
  ['iPhone 13', devices['iPhone 13']],
  ['iPhone 13 landscape', devices['iPhone 13 landscape']],
  ['Pixel 7', devices['Pixel 7']],
  ['Galaxy S25 Ultra (approx.)', { viewport: { width: 412, height: 891 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' }],
  ['Galaxy landscape', { viewport: { width: 891, height: 412 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36' }],
];

const EDGE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';

/** Every control is on screen, big enough to hit, not overlapping, and the page doesn't scroll sideways. */
async function layoutProblems(p: Page) {
  return p.evaluate(() => {
    const vw = innerWidth, vh = innerHeight, out: string[] = [];
    if (document.documentElement.scrollWidth > vw + 1) out.push(`horizontal scroll ${document.documentElement.scrollWidth}>${vw}`);
    const btns = [...document.querySelectorAll<HTMLElement>('.pad-btn')].map((e) => [e.dataset.btn, e.getBoundingClientRect()] as const);
    const zones = [...document.querySelectorAll<HTMLElement>('.stick-zone')].map((e) => e.getBoundingClientRect());
    for (const [k, r] of btns) {
      if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) out.push(`button ${k} off-screen`);
      if (Math.min(r.width, r.height) < 56) out.push(`button ${k} too small (${Math.round(r.width)}x${Math.round(r.height)})`);
    }
    for (const z of zones) if (z.width < 120 || z.height < 120) out.push('stick zone too small');
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i][1], b = btns[j][1];
      if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) out.push(`buttons ${btns[i][0]}/${btns[j][0]} overlap`);
    }
    return out;
  });
}

test('the site needs no install: no PWA manifest, no service worker, no install prompt', async ({ page }) => {
  for (const path of ['/', '/host', '/join', '/account']) {
    await page.goto(`${HTTP}${path}`);
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
    expect(await page.evaluate(async () => (navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0))).toBe(0);
  }
  const res = await page.request.get(`${HTTP}/manifest.webmanifest`);
  expect(await res.text()).not.toContain('"start_url"'); // SPA fallback only, not a manifest
});

test('host screen fits TV/PC sizes (QR, code and start button visible without scrolling), Edge UA', async ({ browser }) => {
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 3840, height: 2160 }]) {
    const ctx = await browser.newContext({ viewport: vp, userAgent: EDGE_UA, locale: 'he-IL' });
    const h = await ctx.newPage();
    await h.goto(`${HTTP}/host`);
    for (const sel of ['.qr-frame img', '[data-testid="room-code"]', '[data-testid="start-btn"]']) {
      const box = await h.locator(sel).boundingBox();
      expect(box, `${sel} @${vp.width}x${vp.height}`).not.toBeNull();
      expect(box!.y + box!.height, `${sel} below the fold @${vp.width}x${vp.height}`).toBeLessThanOrEqual(vp.height + 1);
    }
    expect(await h.evaluate(() => document.documentElement.dir)).toBe('rtl');
    await ctx.close();
  }
});

test('every phone gets the right controller for every game, laid out on screen', async ({ browser }) => {
  test.setTimeout(1_500_000); // every game x 6 phone profiles
  const hctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'en-US' });
  const h = await hctx.newPage();
  await h.goto(`${HTTP}/host`);
  const code = (await h.getByTestId('room-code').innerText()).replace(/\s/g, '');
  const phones: { name: string; p: Page }[] = [];
  for (const [name, d] of PHONES) {
    const ctx = await browser.newContext({ ...d, locale: 'en-US' });
    const p = await ctx.newPage();
    await p.goto(`${HTTP}/join/${code}`);
    expect(await layoutProblems(p), `${name} join form`).toEqual([]);
    await p.locator('input[name="name"]').fill(name.slice(0, 14));
    await p.getByTestId('join-btn').click();
    await expect(p.getByTestId('ready-btn')).toBeVisible();
    expect(await layoutProblems(p), `${name} lobby`).toEqual([]);
    phones.push({ name, p });
  }

  const only = process.env.DEV_GAMES?.split(',');
  for (const meta of CATALOG.filter((g) => g.status === 'playable' && (!only || only.includes(g.id)))) {
    await h.locator(`.lobby__games [data-game="${meta.id}"]`).click();
    await h.getByTestId('start-btn').click();
    await waitPlaying(h);
    for (const [idx, { name, p }] of phones.entries()) {
      const where = `${meta.id} on ${name}`;
      if (idx >= meta.maxPlayers) { await expect(p.locator('.pad'), where).toHaveCount(0); continue; } // spectating phone: no controller
      await expect(p.locator('.pad'), where).toBeVisible();
      const c = meta.controller;
      if (c.kind === 'stick' || c.kind === 'wheel') {
        if (c.kind === 'wheel') { await expect(p.locator('.arrow-btn'), where).toHaveCount(2); } // racing: two big steering arrows (default mode)
        else await expect(p.locator('.stick-zone'), where).toHaveCount(1);
        await expect(p.locator('.pad-btn'), where).toHaveCount(c.buttons.length);
        for (const b of c.buttons) await expect(p.locator(`[data-btn="${b.key}"]`), where).toHaveText(b.label.en);
      } else if (c.kind === 'choices') {
        await expect(p.locator('.pad-btn'), where).toHaveCount(c.count);
      } else if (c.kind === 'tap') {
        await expect(p.locator('.stick-zone'), where).toHaveCount(0);
        await expect(p.locator('.pad-btn--huge'), where).toHaveText(c.button.label.en);
      }
      expect(await padProblems(p), where).toEqual([]);
    }
    await h.getByRole('button', { name: /End round/ }).click();
    await h.getByTestId('lobby-btn').click();
    await expect(h.getByTestId('start-btn')).toBeVisible();
  }
});
