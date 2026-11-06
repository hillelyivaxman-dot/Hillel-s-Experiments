import { expect, test } from '@playwright/test';
import { HTTP, newHost, newPhone, waitPlaying } from './util';

// The "stuck on the purple background after a game" bug: results must always show a usable screen on the phone
// (portrait and landscape), the actions must be inside the viewport, and the room must go back to the lobby and on to the next game.

const VIEWPORTS = [{ width: 412, height: 891 }, { width: 891, height: 412 }, { width: 740, height: 360 }];

test('after a game the phones show results with their actions inside the screen (portrait + landscape), then the lobby, then the next game', async ({ browser }) => {
  test.setTimeout(150_000);
  const { h, code } = await newHost(browser);
  const a = await newPhone(browser, `${HTTP}/join/${code}`, 'Lead', { viewport: VIEWPORTS[1] });
  const b = await newPhone(browser, `${HTTP}/join/${code}`, 'Guest', { viewport: VIEWPORTS[1] });
  for (const game of ['bumper', 'soccer']) {
    await h.locator(`.lobby__games [data-game="${game}"]`).click();
    await h.getByTestId('start-btn').click();
    await waitPlaying(h);
    await h.getByRole('button', { name: /End round/ }).click();
    for (const vp of VIEWPORTS) {
      await a.p.setViewportSize(vp);
      await expect(a.p.getByTestId('phone-results')).toBeVisible();
      for (const id of ['phone-again', 'phone-lobby']) {
        // (poll: the page re-measures its height a moment after the rotation)
        await expect.poll(async () => {
          const box = await a.p.getByTestId(id).boundingBox();
          return !!box && box.y >= 0 && box.y + box.height <= vp.height + 1 && box.x >= 0 && box.x + box.width <= vp.width + 1;
        }, { message: `${game} ${id} fully on screen @${vp.width}x${vp.height}`, timeout: 4000 }).toBe(true);
      }
    }
    // a phone that is not the leader still gets a clear screen, not a bare background
    await expect(b.p.getByTestId('phone-results')).toBeVisible();
    await expect(b.p.getByTestId('phone-wait')).toBeVisible();
    // the leader's phone ends the results screen
    await a.p.getByTestId('phone-lobby').click();
    await expect(a.p.locator('.phone-lobby')).toBeVisible();
    await expect(b.p.locator('.phone-lobby')).toBeVisible();
  }
  // "play again" from the phone starts the same game again
  await h.getByTestId('start-btn').click();
  await waitPlaying(h);
  await h.getByRole('button', { name: /End round/ }).click();
  await a.p.getByTestId('phone-again').click();
  await waitPlaying(h);
  expect(await h.evaluate(() => document.querySelectorAll('[data-testid="crash"]').length)).toBe(0);
});

test('a leader who loses signal hands the crown on so the others are never left without controls', async ({ browser }) => {
  test.setTimeout(90_000);
  const { h, code } = await newHost(browser);
  const a = await newPhone(browser, `${HTTP}/join/${code}`, 'Lead');
  const b = await newPhone(browser, `${HTTP}/join/${code}`, 'Second');
  await h.getByTestId('start-btn').click();
  await waitPlaying(h);
  await h.getByRole('button', { name: /End round/ }).click();
  await expect(b.p.getByTestId('phone-wait')).toBeVisible();
  await a.ctx.setOffline(true);
  await a.p.close(); // the leader's phone is gone
  await expect(b.p.getByTestId('phone-again')).toBeVisible({ timeout: 20_000 });
});

test('switching games back to back never gets stuck: every game starts, ends, shows results and returns', async ({ browser }) => {
  test.setTimeout(240_000);
  const { h, code } = await newHost(browser);
  const a = await newPhone(browser, `${HTTP}/join/${code}`, 'One');
  const b = await newPhone(browser, `${HTTP}/join/${code}`, 'Two');
  const errors: string[] = [];
  for (const p of [a.p, b.p]) p.on('pageerror', (e) => errors.push(String(e)));
  for (const game of ['kart', 'rush', 'hockey', 'flagwars', 'trapbuilders', 'bumper', 'vanish', 'soccer']) {
    await h.locator(`.lobby__games [data-game="${game}"]`).click();
    await h.getByTestId('start-btn').click();
    await waitPlaying(h);
    await h.getByRole('button', { name: /End round/ }).click();
    await expect(a.p.getByTestId('phone-results'), `${game} results (phone)`).toBeVisible({ timeout: 15_000 });
    await a.p.getByTestId('phone-lobby').click();
    await expect(a.p.locator('.phone-lobby'), `${game} lobby (phone)`).toBeVisible({ timeout: 10_000 });
    await expect(b.p.locator('.phone-lobby'), `${game} lobby (2nd phone)`).toBeVisible();
    await expect(h.getByTestId('start-btn')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
