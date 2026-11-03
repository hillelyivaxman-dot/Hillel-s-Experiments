import { expect, test, type Page } from '@playwright/test';
import { delta, frame, HTTP, newHost, newPhone, playerIds, waitPlaying } from './util';

// Controller tests with real (CDP-emulated) touch input, as a phone browser would deliver it.

type Pt = { x: number; y: number; id: number };
async function touch(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  return (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: Pt[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: touchPoints.map((p) => ({ ...p, radiusX: 8, radiusY: 8, force: 1 })) });
}

async function center(page: Page, sel: string) {
  const b = (await page.locator(sel).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test('joystick: dragging a finger moves the critter in that direction and releasing stops pushing', async ({ browser }) => {
  const { h, code } = await newHost(browser);
  const a = await newPhone(browser, `${HTTP}/join/${code}`, 'Thumb');
  await newPhone(browser, `${HTTP}/join/${code}`, 'Idle');
  const ids = await playerIds(h);
  await h.getByTestId('start-btn').click();
  await waitPlaying(h);
  const t = await touch(a.p);
  const s = await center(a.p, '.stick-zone');

  // finger down, drag down-right (45°), hold
  await t('touchStart', [{ ...s, id: 1 }]);
  for (let i = 1; i <= 5; i++) await t('touchMove', [{ x: s.x + i * 12, y: s.y + i * 12, id: 1 }]);
  const f0 = await frame(h);
  await h.waitForTimeout(700);
  const f1 = await frame(h);
  const m = delta(f0, f1, 'p', ids.Thumb);
  expect(m.dx).toBeGreaterThan(40);
  expect(m.dy).toBeGreaterThan(40);
  expect(Math.abs(m.dx - m.dy)).toBeLessThan(Math.max(m.dx, m.dy) * 0.5); // roughly diagonal
  expect(delta(f0, f1, 'p', ids.Idle).d).toBeLessThan(5); // the other phone's critter didn't move

  // drag past the edge: still full speed in the new direction (left)
  await t('touchMove', [{ x: s.x - 200, y: s.y, id: 1 }]);
  await h.waitForTimeout(600);
  const f2 = await frame(h);
  await h.waitForTimeout(300);
  const f3 = await frame(h);
  expect(delta(f2, f3, 'p', ids.Thumb).dx).toBeLessThan(-30);

  // release: knob returns to centre, critter slows to a stop (friction)
  await t('touchEnd', []);
  await expect(a.p.locator('.stick-knob')).toHaveCSS('transform', /matrix\(1, 0, 0, 1, 0, 0\)|none/);
  await h.waitForTimeout(1500);
  const f4 = await frame(h);
  await h.waitForTimeout(400);
  const f5 = await frame(h);
  expect(delta(f4, f5, 'p', ids.Thumb).d).toBeLessThan(8);
});

test('multi-touch: steering with one finger while holding GAS with another (Kart)', async ({ browser }) => {
  const { h, code } = await newHost(browser);
  const a = await newPhone(browser, `${HTTP}/join/${code}`, 'Driver');
  await newPhone(browser, `${HTTP}/join/${code}`, 'Parked');
  const ids = await playerIds(h);
  await h.locator('.lobby__games [data-game="kart"]').click();
  await h.getByTestId('start-btn').click();
  await waitPlaying(h);
  const t = await touch(a.p);
  const s = await center(a.p, '.stick-zone');
  const gas = await center(a.p, '[data-btn="A"]');
  const f0 = await frame(h);

  // finger 1 on the stick, finger 2 on GAS at the same time
  await t('touchStart', [{ ...s, id: 1 }]);
  await t('touchStart', [{ ...s, id: 1 }, { ...gas, id: 2 }]);
  await expect(a.p.locator('[data-btn="A"]')).toHaveClass(/is-down/);
  await h.waitForTimeout(700); // straight acceleration
  const fMid = await frame(h);
  await t('touchMove', [{ x: s.x + 70, y: s.y, id: 1 }, { ...gas, id: 2 }]); // steer right while still on the gas
  await h.waitForTimeout(900);
  const f1 = await frame(h);
  await t('touchEnd', []);
  await expect(a.p.locator('[data-btn="A"]')).not.toHaveClass(/is-down/);

  expect(delta(f0, fMid, 'c', ids.Driver).d).toBeGreaterThan(60); // gas works
  const turned = delta(fMid, f1, 'c', ids.Driver).da;
  expect(turned).toBeGreaterThan(0.4); // turned right (clockwise) while accelerating
  expect(delta(f0, f1, 'c', ids.Parked).d).toBeLessThan(5);
});

test('game switching: all four games start, run and return to the lobby in one room', async ({ browser }) => {
  test.setTimeout(120_000);
  const { h, code, errors } = await newHost(browser);
  const players = [];
  for (const n of ['One', 'Two', 'Three']) players.push(await newPhone(browser, `${HTTP}/join/${code}`, n));
  const ids = await playerIds(h);
  for (const g of ['bumper', 'kart', 'reaction', 'potato']) {
    await h.locator(`.lobby__games [data-game="${g}"]`).click();
    await expect(h.locator(`.lobby__games [data-game="${g}"].is-selected`)).toBeVisible();
    await h.getByTestId('start-btn').click();
    for (const p of players) await expect(p.p.locator('.pad')).toBeVisible();
    await waitPlaying(h);
    const f = await frame(h);
    // every participant is in the new game's snapshot
    const list = f.p ?? f.c ?? f.s;
    expect(list.map((e: any) => e.id).sort()).toEqual(Object.values(ids).sort());
    await h.getByRole('button', { name: /End round/ }).click();
    await expect(h.locator('.results__title')).toBeVisible();
    for (const p of players) await expect(p.p.locator('.phone-results')).toBeVisible();
    await h.getByTestId('lobby-btn').click();
    await expect(h.getByTestId('start-btn')).toBeVisible();
    for (const p of players) await expect(p.p.getByTestId('ready-btn')).toBeVisible();
  }
  await expect(h.locator('.player-tile[data-pid]')).toHaveCount(3);
  expect(errors).toEqual([]);
});
