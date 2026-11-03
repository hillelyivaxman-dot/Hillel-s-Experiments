import { expect, test, type Browser, type Page } from '@playwright/test';

// End-to-end: one host screen + phones in separate browser contexts, real server, real WebSockets.

async function phone(browser: Browser, code: string, name: string) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, hasTouch: true, isMobile: true, locale: 'en-US' });
  const p = await ctx.newPage();
  await p.goto(`/join/${code}`);
  await p.locator('input[name="name"]').fill(name);
  await p.getByTestId('join-btn').click();
  await expect(p.getByTestId('ready-btn')).toBeVisible();
  return p;
}

async function hostPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'en-US' });
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
  await expect(page.locator('.library .game-card')).toHaveCount(12);
  await expect(page.locator('.library .game-card.is-soon')).toHaveCount(8);
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

  await h.getByTestId('start-btn').click(); // Bumper Battle is the default game
  await expect(a.locator('.pad')).toBeVisible();
  await waitPlaying(h);

  const f0 = await frame(h);
  // Dana: keyboard right. Yoni: drag the on-screen joystick upwards with the mouse/pointer.
  await a.keyboard.down('ArrowRight');
  const zone = await b.locator('.stick-zone').boundingBox();
  await b.mouse.move(zone!.x + zone!.width / 2, zone!.y + zone!.height / 2);
  await b.mouse.down();
  await b.mouse.move(zone!.x + zone!.width / 2, zone!.y + zone!.height / 2 - 70, { steps: 4 });
  await h.waitForTimeout(350); // short window: avoids collisions / falling off the arena
  const f1 = await frame(h);
  await a.keyboard.up('ArrowRight');
  await b.mouse.up();

  // match the two moving critters by direction
  const moved = f1.p.map((p: any) => {
    const o = f0.p.find((q: any) => q.id === p.id);
    return { id: p.id, dx: p.x - o.x, dy: p.y - o.y };
  });
  const right = moved.find((m: any) => m.dx > 25 && Math.abs(m.dy) < Math.abs(m.dx) / 2);
  const up = moved.find((m: any) => m.dy < -25 && Math.abs(m.dx) < Math.abs(m.dy) / 2);
  expect(right, JSON.stringify(moved)).toBeTruthy();
  expect(up, JSON.stringify(moved)).toBeTruthy();
  expect(right.id).not.toBe(up.id);

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
  await expect(b.locator('[data-btn="A"]')).toHaveText(/GAS/);
  await waitPlaying(h);
  const k0 = await frame(h);
  // hold GAS with a real pointer (synthetic events lose pointer capture immediately)
  await b.locator('[data-btn="A"]').hover();
  await b.mouse.down();
  await h.waitForTimeout(1200);
  const k1 = await frame(h);
  await b.mouse.up();
  expect(k1.tr).toBe(0);
  const dist = k1.c.map((c: any) => {
    const o = k0.c.find((q: any) => q.id === c.id);
    return Math.hypot(c.x - o.x, c.y - o.y);
  });
  expect(Math.max(...dist)).toBeGreaterThan(100); // Yoni drove
  expect(Math.min(...dist)).toBeLessThan(15); // Dana did not
  await expect(b.getByTestId('hud')).toContainText('Lap');

  expect(errors).toEqual([]);
});

test('reaction duel: fastest tap wins over the network', async ({ browser }) => {
  const { h, code } = await hostPage(browser);
  const a = await phone(browser, code, 'Fast');
  const b = await phone(browser, code, 'Slow');
  await h.locator('.lobby__games [data-game="reaction"]').click();
  await h.locator('.options .chip').click(); // rounds 5 -> 7
  await h.locator('.options .chip').click(); // 7 -> 10
  await h.locator('.options .chip').click(); // 10 -> 3
  await expect(h.locator('.options .chip')).toContainText('3');
  await h.getByTestId('start-btn').click();
  await waitPlaying(h);
  // 'Fast' taps when GO shows; 'Slow' never taps
  for (let r = 0; r < 3; r++) {
    await expect.poll(async () => (await frame(h))?.ph, { timeout: 15_000 }).toBe('go');
    await a.locator('[data-btn="A"]').dispatchEvent('pointerdown', { pointerId: 1, bubbles: true });
    await a.locator('[data-btn="A"]').dispatchEvent('pointerup', { pointerId: 1, bubbles: true });
    await expect.poll(async () => (await frame(h))?.ph, { timeout: 8000 }).not.toBe('go');
  }
  await expect(h.locator('.podium__col--1 .podium__name')).toHaveText('Fast', { timeout: 15_000 });
  void b;
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
