import { expect, test, type Page } from '@playwright/test';
import { CATALOG } from '../../shared/catalog';
import { BTN } from '../../shared/protocol';
import { delta, frame, HTTP, HTTPS, newHost, newPhone, padProblems, playerIds, waitPlaying, wheelAt, type SentInput } from './util';

// Regression tests for the controller bugs found in the review (see docs/CONTROLLER.md).
// Touch input is real CDP touch emulation in Chromium (not a physical phone).

type Pt = { x: number; y: number; id: number };
async function touch(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  return (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', touchPoints: Pt[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: touchPoints.map((p) => ({ ...p, radiusX: 8, radiusY: 8, force: 1 })) });
}
const center = async (p: Page, sel: string) => {
  const b = (await p.locator(sel).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const last = (inputs: SentInput[]) => inputs[inputs.length - 1];

async function startGame(game: string, phoneOpts: object = {}) {
  return async (browser: import('@playwright/test').Browser) => {
    const { h, code } = await newHost(browser);
    const a = await newPhone(browser, `${HTTP}/join/${code}`, 'Pad', phoneOpts);
    const b = await newPhone(browser, `${HTTP}/join/${code}`, 'Other');
    const extra = game === 'potato' ? await newPhone(browser, `${HTTP}/join/${code}`, 'Third') : null;
    const ids = await playerIds(h);
    await h.locator(`.lobby__games [data-game="${game}"]`).click();
    await h.getByTestId('start-btn').click();
    await waitPlaying(h);
    return { h, a, b, extra, ids };
  };
}

test('stick: dead zone sends exactly zero, small pushes are proportional, full push = 1', async ({ browser }) => {
  const { a } = await (await startGame('bumper'))(browser);
  const t = await touch(a.p);
  const s = await center(a.p, '.stick-zone');
  await t('touchStart', [{ ...s, id: 1 }]);
  await t('touchMove', [{ x: s.x + 4, y: s.y + 3, id: 1 }]); // inside the dead zone
  await a.p.waitForTimeout(80);
  expect(last(a.inputs)).toMatchObject({ x: 0, y: 0 });
  await t('touchMove', [{ x: s.x + 30, y: s.y, id: 1 }]);
  await expect.poll(() => last(a.inputs).x).toBeGreaterThan(0.2);
  expect(last(a.inputs).x).toBeLessThan(0.75);
  await t('touchMove', [{ x: s.x + 150, y: s.y, id: 1 }]);
  await expect.poll(() => last(a.inputs).x).toBe(1);
  await t('touchEnd', []);
  await expect.poll(() => last(a.inputs)).toMatchObject({ x: 0, y: 0 });
});

test('stick: finger slides off the stick area and the screen side — still steering; lifting it anywhere stops', async ({ browser }) => {
  const { h, a, ids } = await (await startGame('bumper'))(browser);
  const t = await touch(a.p);
  const s = await center(a.p, '.stick-zone');
  await t('touchStart', [{ ...s, id: 1 }]);
  // drag far to the right: across the buttons and off the stick region
  for (let i = 1; i <= 8; i++) await t('touchMove', [{ x: s.x + i * 40, y: s.y - i * 2, id: 1 }]);
  await expect.poll(() => last(a.inputs).x).toBeGreaterThan(0.9);
  // wait for the movement to show up on the big screen (poll instead of a fixed sleep: the host page can lag under load)
  const f0 = await frame(h);
  await expect.poll(async () => delta(f0, await frame(h), 'p', ids.Pad).dx, { timeout: 6000 }).toBeGreaterThan(20);
  // no button got pressed by the sliding stick finger
  expect(a.inputs.every((i) => i.b === 0)).toBe(true);
  await t('touchEnd', []);
  await expect.poll(() => last(a.inputs)).toMatchObject({ x: 0, y: 0, b: 0 });
});

test('touch cancel (system gesture / incoming call) releases steering and buttons', async ({ browser }) => {
  const { a } = await (await startGame('kart'))(browser);
  const t = await touch(a.p);
  const R = await center(a.p, '[data-btn="R"]');
  const brake = await center(a.p, '[data-btn="B"]');
  await t('touchStart', [{ ...R, id: 1 }, { ...brake, id: 2 }]);
  await expect.poll(() => last(a.inputs).b).toBe(BTN.B);
  await expect.poll(() => last(a.inputs).x).toBe(1);
  await t('touchCancel', []);
  await expect.poll(() => last(a.inputs)).toMatchObject({ x: 0, y: 0, b: 0 });
  await expect(a.p.locator('[data-btn="B"]')).not.toHaveClass(/is-down/);
});

test('screen lock / app switch while steering and braking: everything is released (no runaway car)', async ({ browser }) => {
  const { a } = await (await startGame('kart'))(browser);
  const t = await touch(a.p);
  const L = await center(a.p, '[data-btn="L"]');
  const brake = await center(a.p, '[data-btn="B"]');
  await t('touchStart', [{ ...L, id: 1 }, { ...brake, id: 2 }]);
  await expect.poll(() => last(a.inputs)).toMatchObject({ b: BTN.B });
  await expect.poll(() => last(a.inputs).x).toBe(-1);
  // the phone goes to sleep: the browser fires visibilitychange, and no pointerup will ever arrive
  await a.p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => last(a.inputs)).toMatchObject({ x: 0, y: 0, b: 0 });
});

test('three fingers at once: steer + TURBO + ITEM (Kart) all reach the server; the kart drives itself', async ({ browser }) => {
  const { h, a, ids } = await (await startGame('kart'))(browser);
  const t = await touch(a.p);
  const R = await center(a.p, '[data-btn="R"]');
  const turbo = await center(a.p, '[data-btn="D"]');
  const item = await center(a.p, '[data-btn="C"]');
  const f0 = await frame(h);
  await t('touchStart', [{ ...R, id: 1 }]);
  await t('touchStart', [{ ...R, id: 1 }, { ...turbo, id: 2 }]);
  await t('touchStart', [{ ...R, id: 1 }, { ...turbo, id: 2 }, { ...item, id: 3 }]);
  await expect.poll(() => last(a.inputs).b).toBe(BTN.D | BTN.C);
  await expect.poll(() => last(a.inputs).x).toBe(1);
  await expect(a.p.locator('.pad-btn.is-down')).toHaveCount(2);
  await h.waitForTimeout(900);
  const f1 = await frame(h);
  expect(delta(f0, f1, 'c', ids.Pad).d).toBeGreaterThan(100); // auto-accelerates without any gas button
  // lift only the TURBO finger: the other two keep working
  await t('touchEnd', [{ ...turbo, id: 2 }]);
  await expect.poll(() => last(a.inputs).b).toBe(BTN.C);
  await expect.poll(() => last(a.inputs).x).toBe(1);
  await t('touchEnd', []);
  await expect.poll(() => last(a.inputs)).toMatchObject({ x: 0, y: 0, b: 0 });
});

test('controls stay visible and tappable when the browser bar shows/hides and when the phone rotates', async ({ browser }) => {
  const { a } = await (await startGame('kart'))(browser);
  for (const vp of [{ width: 412, height: 860 }, { width: 412, height: 760 }, { width: 860, height: 412 }, { width: 860, height: 330 }, { width: 412, height: 915 }]) {
    await a.p.setViewportSize(vp);
    // the layout settles within a few frames of the resize; wait for it instead of sleeping a fixed time
    await expect.poll(() => padProblems(a.p), { message: `${vp.width}x${vp.height}`, timeout: 6000 }).toEqual([]);
    await expect(a.p.locator('.pad-btn')).toHaveCount(3);
    await expect(a.p.locator('.arrow-btn')).toHaveCount(2);
  }
});

test('controller settings: L buttons + swapped sides still fit; stick moves to the right', async ({ browser }) => {
  const { a } = await (await startGame('bumper'))(browser);
  const before = await center(a.p, '.stick-zone');
  await a.p.getByTestId('pad-settings').click();
  await a.p.locator('[data-size="l"]').click();
  await a.p.getByTestId('mirror').click();
  await a.p.locator('.pad-sheet .btn').click();
  const after = await center(a.p, '.stick-zone');
  expect(after.x).toBeGreaterThan(before.x + 100);
  expect(await padProblems(a.p)).toEqual([]);
  // preference survives a reload
  await a.p.reload();
  await expect(a.p.locator('.pad')).toBeVisible();
  expect((await center(a.p, '.stick-zone')).x).toBeGreaterThan(before.x + 100);
});

test('after a network drop the controller comes back complete and working', async ({ browser, request }) => {
  const { h, code } = await newHost(browser);
  const a = await newPhone(browser, `${HTTPS}/join/${code}`, 'Dropper');
  await newPhone(browser, `${HTTP}/join/${code}`, 'Stable');
  await h.locator('.lobby__games [data-game="kart"]').click();
  await h.getByTestId('start-btn').click();
  await waitPlaying(h);
  await request.get(`${HTTPS}/__proxy/drop`, { ignoreHTTPSErrors: true });
  await expect(a.p.locator('.conn-banner')).toBeHidden({ timeout: 15_000 });
  await expect(a.p.locator('.pad-btn')).toHaveCount(3);
  await expect(a.p.locator('.arrow-btn')).toHaveCount(2);
  expect(await padProblems(a.p)).toEqual([]);
  await a.p.locator('[data-btn="D"]').hover();
  await a.p.mouse.down();
  await expect.poll(() => last(a.inputs).b).toBe(BTN.D);
  await a.p.mouse.up();
});

test('the controller updates for each game in the same lobby (buttons appear/disappear correctly)', async ({ browser }) => {
  test.setTimeout(900_000); // one match start/stop per game (30 games)
  const { h, code } = await newHost(browser);
  const a = await newPhone(browser, `${HTTP}/join/${code}`, 'Switcher');
  await newPhone(browser, `${HTTP}/join/${code}`, 'B');
  await newPhone(browser, `${HTTP}/join/${code}`, 'C');
  const expected: Record<string, string[]> = Object.fromEntries(CATALOG.filter((g) => g.status === 'playable').map((g) => {
    const c = g.controller;
    return [g.id, c.kind === 'tap' ? [c.button.key] : c.kind === 'choices' ? ['A', 'B', 'C', 'D'].slice(0, c.count) : c.buttons.map((b) => b.key as string)];
  }));
  for (const [g, keys] of Object.entries(expected)) {
    await h.locator(`.lobby__games [data-game="${g}"]`).click();
    await h.getByTestId('start-btn').click();
    await waitPlaying(h);
    await expect(a.p.locator('.pad-btn')).toHaveCount(keys.length);
    expect(await a.p.locator('.pad-btn').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.btn))).toEqual(keys);
    expect(await padProblems(a.p), g).toEqual([]);
    await h.getByRole('button', { name: /End round/ }).click();
    await h.getByTestId('lobby-btn').click();
  }
});

test('Chaos Rush: run, jump with a real tap, dash and shove reach the server and move the right runner', async ({ browser }) => {
  const { h, code } = await newHost(browser);
  const a = await newPhone(browser, `${HTTP}/join/${code}`, 'Runner', { viewport: { width: 891, height: 412 } });
  await newPhone(browser, `${HTTP}/join/${code}`, 'Rival');
  const ids = await playerIds(h);
  await h.locator('.lobby__games [data-game="rush"]').click();
  await h.getByTestId('start-btn').click();
  await waitPlaying(h);
  expect(await padProblems(a.p)).toEqual([]);
  const t = await touch(a.p);
  const s = await center(a.p, '.stick-zone');
  const jump = await center(a.p, '[data-btn="A"]');
  const dash = await center(a.p, '[data-btn="B"]');
  const f0 = await frame(h);
  await t('touchStart', [{ ...s, id: 1 }]);
  await t('touchMove', [{ x: s.x + 70, y: s.y, id: 1 }]); // run right
  await h.waitForTimeout(500);
  const f1 = await frame(h);
  expect(delta(f0, f1, 'p', ids.Runner).dx).toBeGreaterThan(60);
  expect(delta(f0, f1, 'p', ids.Rival).dx).toBeLessThan(5); // the other phone's runner stayed
  // tap JUMP: the runner leaves the ground
  await t('touchStart', [{ x: s.x + 70, y: s.y, id: 1 }, { ...jump, id: 2 }]);
  await expect.poll(async () => (await frame(h)).p.find((p: any) => p.id === ids.Runner).g, { timeout: 2000 }).toBe(0);
  await t('touchEnd', [{ ...jump, id: 2 }]);
  // DASH sends bit B
  await t('touchStart', [{ x: s.x + 70, y: s.y, id: 1 }, { ...dash, id: 3 }]);
  await expect.poll(() => a.inputs.some((i) => (i.b & BTN.B) !== 0)).toBe(true);
  await t('touchEnd', []);
  await expect.poll(() => last(a.inputs)).toMatchObject({ x: 0, y: 0, b: 0 });
});

test('wheel (optional mode): rotating a finger steers proportionally, fine near centre, full at the lock; release snaps back to straight', async ({ browser }) => {
  const { a } = await (await startGame('kart'))(browser);
  await a.p.getByTestId('pad-settings').click();
  await a.p.locator('[data-steer-mode="wheel"]').click();
  await a.p.locator('.pad-sheet .btn').click();
  const t = await touch(a.p);
  const w = await wheelAt(a.p);
  await t('touchStart', [{ ...w.at(0), id: 1 }]);
  await t('touchMove', [{ ...w.at(10), id: 1 }]);
  await expect.poll(() => last(a.inputs).x).toBeGreaterThan(0.02);
  expect(last(a.inputs).x).toBeLessThan(0.15); // tiny rotation = tiny steering
  for (const d of [30, 50, 70]) await t('touchMove', [{ ...w.at(d), id: 1 }]);
  await expect.poll(() => last(a.inputs).x).toBeGreaterThan(0.4);
  expect(last(a.inputs).x).toBeLessThan(0.8);
  for (const d of [90, 110, 130, 150]) await t('touchMove', [{ ...w.at(d), id: 1 }]);
  await expect.poll(() => last(a.inputs).x).toBe(1); // locked
  // the visible wheel really rotated
  const rot = await a.p.locator('.wheel').evaluate((e) => getComputedStyle(e).transform);
  expect(rot).not.toBe('none');
  // turning back the other way reduces the steering
  for (const d of [100, 60, 20, -20]) await t('touchMove', [{ ...w.at(d), id: 1 }]);
  await expect.poll(() => last(a.inputs).x).toBeLessThan(0.1);
  await t('touchEnd', []);
  await expect.poll(() => last(a.inputs)).toMatchObject({ x: 0 });
});

test('arrows mode: holding left/right steers fully, both = straight, and the choice is remembered', async ({ browser }) => {
  const { a } = await (await startGame('kart'))(browser);
  await a.p.getByTestId('pad-settings').click();
  await a.p.locator('[data-steer-mode="arrows"]').click();
  await a.p.locator('.pad-sheet .btn').click();
  await expect(a.p.locator('.arrow-btn')).toHaveCount(2);
  const t = await touch(a.p);
  const L = await center(a.p, '[data-btn="L"]'), R = await center(a.p, '[data-btn="R"]');
  await t('touchStart', [{ ...R, id: 1 }]);
  await expect.poll(() => last(a.inputs).x).toBe(1);
  await t('touchStart', [{ ...R, id: 1 }, { ...L, id: 2 }]);
  await expect.poll(() => last(a.inputs).x).toBe(0);
  await t('touchEnd', [{ ...R, id: 1 }]);
  await expect.poll(() => last(a.inputs).x).toBe(-1);
  await t('touchEnd', []);
  await expect.poll(() => last(a.inputs).x).toBe(0);
  expect(await padProblems(a.p)).toEqual([]);
  await a.p.reload();
  await expect(a.p.locator('.arrow-btn')).toHaveCount(2); // remembered after reload
});

test('tilt mode: a (simulated) sensor steers, calibration centres it, and a missing sensor says so', async ({ browser }) => {
  const { a } = await (await startGame('kart', { viewport: { width: 891, height: 412 } }))(browser);
  // Only our synthetic (untrusted) motion events reach the page: the browser's own emulated ones are ignored,
  // so "no sensor" and "sensor" can both be tested deterministically.
  await a.ctx.addInitScript(() => {
    // iPhone-style: motion access needs a tap and a permission answer
    (window.DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => 'granted';
    const orig = window.addEventListener.bind(window);
    window.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions) =>
      type === 'devicemotion' ? orig(type, (e: Event) => { if (!e.isTrusted) (fn as EventListener)(e); }, opts) : orig(type, fn, opts)) as typeof window.addEventListener;
  });
  await a.p.reload();
  await expect(a.p.locator('.pad')).toBeVisible();
  await a.p.getByTestId('pad-settings').click();
  await a.p.locator('[data-steer-mode="tilt"]').click();
  await a.p.locator('.pad-sheet .btn').click();
  await a.p.getByTestId('tilt-enable').click(); // permission tap
  // no sensor events at all: a clear message after a moment
  await expect(a.p.locator('.tilt-msg .warn')).toBeVisible({ timeout: 6000 });

  // the sensor "appears": remount the tilt steering, then send level + tilted readings
  const fire = (x: number, y: number) => a.p.evaluate(([gx, gy]) => {
    const e = new Event('devicemotion');
    (e as unknown as { accelerationIncludingGravity: unknown }).accelerationIncludingGravity = { x: gx, y: gy, z: 0 };
    window.dispatchEvent(e);
  }, [x, y]);
  await a.p.getByTestId('pad-settings').click();
  await a.p.locator('[data-steer-mode="wheel"]').click();
  await a.p.locator('[data-steer-mode="tilt"]').click();
  await a.p.locator('.pad-sheet .btn').click();
  await a.p.getByTestId('tilt-enable').click();
  await a.p.waitForTimeout(100);
  await fire(9.8, 0); await a.p.waitForTimeout(50); await fire(9.8, 0);
  await expect(a.p.getByTestId('tilt-calibrate')).toBeVisible();
  // landscape (screen angle 90): level = gravity along +x. Tilting changes the y component.
  await fire(9.8 * Math.cos(0.4), 9.8 * Math.sin(0.4)); // about 23 degrees one way
  await expect.poll(() => Math.abs(last(a.inputs).x)).toBeGreaterThan(0.3);
  const one = last(a.inputs).x;
  await fire(9.8 * Math.cos(0.4), -9.8 * Math.sin(0.4)); // the other way
  await expect.poll(() => last(a.inputs).x * one).toBeLessThan(0);
  await fire(9.8, 0);
  await expect.poll(() => last(a.inputs).x).toBe(0);
});
