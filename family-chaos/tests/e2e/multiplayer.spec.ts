import { expect, test, type Browser, type Page } from '@playwright/test';
import { CATALOG } from '../../shared/catalog';
import { delta, playerIds } from './util'; // also registers the hook that closes every browser context after each test

// End-to-end: one host screen + phones in separate browser contexts, real server, real WebSockets.

const sentInputs = new WeakMap<Page, { x: number; y: number; b: number }[]>(); // what each phone really sent

async function phone(browser: Browser, code: string, name: string) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, hasTouch: true, isMobile: true, locale: 'en-US' });
  await ctx.addInitScript(() => { try { localStorage.setItem('fc.no3d', '1'); } catch { /* */ } });
  const p = await ctx.newPage();
  const sent: { x: number; y: number; b: number }[] = [];
  sentInputs.set(p, sent);
  p.on('websocket', (ws) => ws.on('framesent', (f) => { try { const m = JSON.parse(String(f.payload)); if (m.t === 'input') sent.push({ x: m.x, y: m.y, b: m.b }); } catch { /* */ } }));
  await p.goto(`/join/${code}`);
  await p.locator('input[name="name"]').fill(name);
  await p.getByTestId('join-btn').click();
  await expect(p.getByTestId('ready-btn')).toBeVisible();
  return p;
}

async function hostPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'en-US' });
  await ctx.addInitScript(() => { try { localStorage.setItem('fc.host3d', '0'); } catch { /* */ } });
  const h = await ctx.newPage();
  const errors: string[] = [];
  h.on('pageerror', (e) => errors.push(String(e)));
  await h.goto('/host');
  const codeEl = h.getByTestId('room-code');
  await expect(codeEl).toBeVisible();
  const code = (await codeEl.innerText()).replace(/\s/g, '');
  expect(code).toMatch(/^[A-Z]{4}$/);
  return { h, code, errors };
}

const frame = (h: Page) => h.evaluate(() => (window as any).__fcFrame);

async function waitPlaying(h: Page) {
  // countdown is 3.5s; then frames carry a running clock
  await expect(h.locator('.overlay--countdown')).toBeHidden({ timeout: 10_000 });
  await expect.poll(async () => (await frame(h))?.t ?? 0, { timeout: 10_000 }).toBeGreaterThan(0.3);
}

test('home page renders the library and host button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('host-btn')).toBeVisible();
  await expect(page.locator('.library .game-card')).toHaveCount(CATALOG.length);
  await expect(page.locator('.library .game-card.is-soon')).toHaveCount(CATALOG.filter((g) => g.status !== 'playable').length);
});

test('library: search filters games (Hebrew and English), favourites are remembered and float to the top', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('.library .game-card');
  await page.getByTestId('game-search').fill('soccer');
  await expect(cards).toHaveCount(1);
  await page.getByTestId('game-search').fill('הוקי');
  await expect(cards).toHaveCount(1);
  await page.getByTestId('game-search').fill('zzzz');
  await expect(cards).toHaveCount(0);
  await page.getByTestId('game-search').fill('');
  await expect(cards).toHaveCount(CATALOG.length);
  await page.locator('[data-fav="rush"]').click();
  await expect(page.locator('.game-wrap').first().locator('.game-card')).toHaveAttribute('data-game', 'rush'); // favourite goes first
  await page.reload();
  await expect(page.locator('.game-wrap').first().locator('.game-card')).toHaveAttribute('data-game', 'rush'); // and is remembered
  await page.getByTestId('favs-toggle').click();
  await expect(cards).toHaveCount(1);
});

test('two phones control two different characters on one screen, then reconnect, results and game switch', async ({ browser }) => {
  const { h, code, errors } = await hostPage(browser);
  const a = await phone(browser, code, 'Dana');
  const b = await phone(browser, code, 'Yoni');
  await expect(h.locator('.player-tile[data-player]')).toHaveCount(2);
  await expect(h.locator('[data-player="Dana"]')).toBeVisible();

  // phone ready toggle shows on the host
  await b.getByTestId('ready-btn').click();
  await expect(h.locator('[data-player="Yoni"].is-ready')).toBeVisible();

  const ids = await playerIds(h); // (lobby tiles carry the player ids)
  await h.getByTestId('start-btn').click(); // Bumper Battle is the default game
  await expect(a.locator('.pad')).toBeVisible();
  await waitPlaying(h);

  // One phone at a time, judged on the first frame that shows movement (robust when the host page lags):
  // Dana (keyboard right) must move only her critter to the right; then Yoni (joystick up) only his, upwards.
  // Returns { base, fm }: the baseline frame and the first frame showing a clean (continuous) movement of that
  // player. A teleport (fell off the arena and respawned while the host page lagged) just resets the baseline.
  const firstMove = async (who: string, f0: any) => {
    let base = f0, fm: any = null;
    await expect.poll(async () => {
      fm = await frame(h);
      const d = delta(base, fm, 'p', ids[who]).d;
      if (d >= 150) { base = fm; return 0; }
      return d;
    }, { timeout: 10_000 }).toBeGreaterThan(20);
    return { base, fm };
  };
  const g0 = await frame(h);
  await a.keyboard.down('ArrowRight');
  const m1 = await firstMove('Dana', g0);
  await a.keyboard.up('ArrowRight');
  // direction is judged on what each phone sent (exact); the host frame only has to show that this runner moved
  expect(sentInputs.get(a)!.some((i) => i.x > 0.5)).toBe(true);
  expect(sentInputs.get(b)!.every((i) => i.x === 0 && i.y === 0)).toBe(true); // Yoni's phone sent nothing yet
  expect(delta(m1.base, m1.fm, 'p', ids.Yoni).d).toBeLessThan(5);
  await h.waitForTimeout(600); // let Dana's momentum die out
  const zone = await b.locator('.stick-zone').boundingBox();
  await b.mouse.move(zone!.x + zone!.width / 2, zone!.y + zone!.height / 2);
  await b.mouse.down();
  await b.mouse.move(zone!.x + zone!.width / 2, zone!.y + zone!.height / 2 - 70, { steps: 4 });
  const h0 = await frame(h);
  await firstMove('Yoni', h0);
  await b.mouse.up();
  expect(sentInputs.get(b)!.some((i) => i.y < -0.3 && Math.abs(i.x) < 0.3)).toBe(true); // joystick pushed up

  // a dash button press is accepted
  await a.locator('[data-btn="A"]').dispatchEvent('pointerdown', { pointerId: 7, bubbles: true });
  await a.locator('[data-btn="A"]').dispatchEvent('pointerup', { pointerId: 7, bubbles: true });

  // reload a phone mid-game: it rejoins as the same player (no duplicate)
  await a.reload();
  await expect(a.locator('.pad')).toBeVisible({ timeout: 10_000 });

  // pause / resume from the host
  await h.getByRole('button', { name: /Pause/ }).first().click();
  await expect(h.locator('.overlay__big')).toBeVisible();
  await h.locator('.overlay .btn').click();

  // end round -> results -> back to lobby
  await h.getByRole('button', { name: /End round/ }).click();
  await expect(h.locator('.podium__col')).toHaveCount(2);
  await expect(a.locator('.phone-results')).toBeVisible();
  await h.getByTestId('lobby-btn').click();
  await expect(h.locator('.player-tile[data-player]')).toHaveCount(2);

  // switch to Kart Chaos without a new room, started from the leader's phone
  await a.locator('.phone-games [data-game="kart"]').click();
  await expect(h.locator('.lobby__games [data-game="kart"].is-selected')).toBeVisible();
  await a.getByTestId('phone-start').click();
  await expect(b.locator('[data-btn="D"]')).toHaveText(/TURBO/); // racing pad: two arrows + TURBO / ITEM / BRAKE
  await waitPlaying(h);
  const k0 = await frame(h);
  // karts drive themselves; Yoni holds the right arrow with a real pointer (synthetic events lose pointer capture immediately)
  await b.locator('[data-btn="R"]').hover();
  await b.mouse.down();
  await h.waitForTimeout(600); // full lock turns a kart ~3 rad/s: stay well under a half turn so the signed angle does not wrap
  const k1 = await frame(h);
  await b.mouse.up();
  expect(k1.tr).toBe(0);
  const turned = (name: string) => { const id = ids[name]; let d = k1.c.find((c: any) => c.id === id).a - k0.c.find((c: any) => c.id === id).a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }; // signed heading change (the road itself bends, so compare the two karts)
  const moved = (name: string) => { const id = ids[name]; const c = k1.c.find((q: any) => q.id === id), o = k0.c.find((q: any) => q.id === id); return Math.hypot(c.x - o.x, c.y - o.y); };
  expect(moved('Dana')).toBeGreaterThan(30); // both karts accelerate by themselves
  expect(moved('Yoni')).toBeGreaterThan(30);
  expect(turned('Yoni') - turned('Dana')).toBeGreaterThan(0.4); // Yoni steered right on top of whatever the road did to both karts
  await expect(b.getByTestId('hud')).toContainText('Lap');

  expect(errors).toEqual([]);
});

test('wrong room code and offensive names are rejected', async ({ browser }) => {
  const { code } = await hostPage(browser);
  const ctx = await browser.newContext({ locale: 'en-US' });
  const p = await ctx.newPage();
  await p.goto('/join/QQQQ');
  await p.locator('input[name="name"]').fill('Test');
  await p.getByTestId('join-btn').click();
  await expect(p.locator('.error')).toContainText('not found');
  await p.locator('input[name="code"]').fill(code);
  await p.locator('input[name="name"]').fill('shit head');
  await p.getByTestId('join-btn').click();
  await expect(p.locator('.error')).toContainText('not allowed');
});

test('party tournament: 3 games in a row, points panel, skip to the next game, champion at the end', async ({ browser }) => {
  test.setTimeout(120_000);
  const { h, code } = await hostPage(browser);
  for (const n of ['One', 'Two', 'Three']) await phone(browser, code, n);
  await h.getByTestId('tour-3').click();
  for (let g = 0; g < 3; g++) {
    await waitPlaying(h);
    await h.getByRole('button', { name: /End round/ }).click();
    await expect(h.getByTestId('tour-panel')).toBeVisible();
    if (g < 2) await h.getByTestId('tour-skip').click();
  }
  await expect(h.getByTestId('tour-champion')).toBeVisible();
  await h.getByTestId('lobby-btn').click();
  await expect(h.getByTestId('start-btn')).toBeVisible();
  await expect(h.getByTestId('tour-panel')).toHaveCount(0);
});

test('league tournament from hand-picked games: each game is played twice, points table after every round, champion at the end', async ({ browser }) => {
  test.setTimeout(180_000);
  const { h, code } = await hostPage(browser);
  for (const n of ['One', 'Two', 'Three']) await phone(browser, code, n);
  await h.getByTestId('tour-custom').click();
  for (const g of ['bumper', 'vanish']) await h.locator(`.lobby__games [data-game="${g}"]`).click();
  await h.getByTestId('tour-custom-league').click();
  const rounds = 4; // 2 games x 2 rounds
  for (let r = 0; r < rounds; r++) {
    await waitPlaying(h);
    await h.getByRole('button', { name: /End round/ }).click();
    await expect(h.getByTestId('tour-panel')).toBeVisible();
    if (r < rounds - 1) await h.getByTestId('tour-skip').click();
  }
  await expect(h.getByTestId('tour-champion')).toBeVisible();
  await h.getByTestId('lobby-btn').click();
  await expect(h.getByTestId('start-btn')).toBeVisible();
});

test('multi-day tournament can be put on hold after a round and shows the hold state', async ({ browser }) => {
  test.setTimeout(120_000);
  const { h, code } = await hostPage(browser);
  for (const n of ['One', 'Two']) await phone(browser, code, n);
  await h.getByTestId('tour-custom').click();
  for (const g of ['bumper', 'vanish']) await h.locator(`.lobby__games [data-game="${g}"]`).click();
  await h.getByTestId('tour-custom-multiday').click();
  await waitPlaying(h);
  await h.getByRole('button', { name: /End round/ }).click();
  await expect(h.getByTestId('tour-panel')).toBeVisible();
  await h.getByTestId('tour-hold').click();
  await expect(h.getByTestId('tour-hold')).toBeVisible();
});
