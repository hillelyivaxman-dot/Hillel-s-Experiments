import { expect, test, type Page } from '@playwright/test';
import { CATALOG } from '../../shared/catalog';
import { BTN } from '../../shared/protocol';
import { frame, HTTP, newHost, newPhone, playerIds, waitPlaying, type SentInput } from './util';

// For EVERY playable game: two phones in separate browser contexts, a real match, every control of the phone is
// pressed with real (CDP) touch input and must reach the server as the right input; both players must exist in the
// game; then the round is ended (results on host and phones) and the room goes back to the lobby for the next game.
// (Playing a whole round to its end is covered by the server-side bot tests in tests/unit; here we check the real
// browser path for each game.)

type Pt = { x: number; y: number; id: number };
async function touch(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  return (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: Pt[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: touchPoints.map((p) => ({ ...p, radiusX: 8, radiusY: 8, force: 1 })) });
}
const center = async (p: Page, sel: string) => { const b = (await p.locator(sel).first().boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const last = (a: SentInput[]) => a[a.length - 1];

test('every game: two phones, every control reaches the server, both players are in the match, results, back to the lobby', async ({ browser }) => {
  test.setTimeout(1_800_000);
  const { h, code, errors } = await newHost(browser);
  const land = { viewport: { width: 860, height: 412 } };
  const A = await newPhone(browser, `${HTTP}/join/${code}`, 'Alpha', land);
  const B = await newPhone(browser, `${HTTP}/join/${code}`, 'Bravo', land);
  await newPhone(browser, `${HTTP}/join/${code}`, 'Charlie', land); // 3 players so every game (min 3) can start
  const ids = await playerIds(h);
  const problems: string[] = [];

  for (const meta of CATALOG.filter((g) => g.status === 'playable')) {
    const g = meta.id;
    await h.locator(`.lobby__games [data-game="${g}"]`).click();
    await h.getByTestId('start-btn').click();
    await waitPlaying(h);
    const f = await frame(h);
    const list: any[] = f.p ?? f.c ?? f.s ?? [];
    for (const who of ['Alpha', 'Bravo', 'Charlie']) if (!list.some((e) => e.id === ids[who])) problems.push(`${g}: ${who} is not in the match`);

    for (const [name, ph] of [['Alpha', A], ['Bravo', B]] as const) {
      const t = await touch(ph.p);
      const c = meta.controller;
      const before = ph.inputs.length;
      if (c.kind === 'stick') { // joystick: a drag to the right must produce x > 0.3
        const s = await center(ph.p, '.stick-zone');
        await t('touchStart', [{ ...s, id: 1 }]);
        // the air-hockey touchpad sends the finger's absolute position on the pad, so drag to its right-hand part
        const reach = (c as any).pointer ? ((await ph.p.locator('.stick-zone').first().boundingBox())!.width * 0.4) : 90;
        await t('touchMove', [{ x: s.x + reach * 0.66, y: s.y, id: 1 }]);
        await t('touchMove', [{ x: s.x + reach, y: s.y, id: 1 }]);
        await expect.poll(() => Math.max(...ph.inputs.slice(before).map((i) => i.x), 0), { message: `${g}/${name} stick`, timeout: 5000 }).toBeGreaterThan(0.3);
        await t('touchEnd', []);
        await expect.poll(() => last(ph.inputs).x, { message: `${g}/${name} stick release` }).toBe(0);
      }
      if (c.kind === 'wheel') { // racing: the two big arrow buttons steer
        for (const [k, want] of [['R', 1], ['L', -1]] as const) {
          const a = await center(ph.p, `[data-btn="${k}"]`);
          await t('touchStart', [{ ...a, id: 1 }]);
          await expect.poll(() => last(ph.inputs).x, { message: `${g}/${name} arrow ${k}` }).toBe(want);
          await t('touchEnd', []);
          await expect.poll(() => last(ph.inputs).x, { message: `${g}/${name} arrow ${k} release` }).toBe(0);
        }
      }
      const keys = c.kind === 'tap' ? [c.button.key] : c.kind === 'choices' ? (['A', 'B', 'C', 'D'] as const).slice(0, c.count) : c.buttons.map((b) => b.key);
      for (const k of keys) {
        const at = await center(ph.p, `[data-btn="${k}"]`);
        await t('touchStart', [{ ...at, id: 2 }]);
        await expect.poll(() => (last(ph.inputs).b & BTN[k]) !== 0, { message: `${g}/${name} button ${k} down`, timeout: 5000 }).toBe(true);
        await t('touchEnd', []);
        await expect.poll(() => (last(ph.inputs).b & BTN[k]) === 0, { message: `${g}/${name} button ${k} up`, timeout: 5000 }).toBe(true);
      }
    }
    await h.getByRole('button', { name: /End round/ }).click();
    await expect(h.locator('.results__title')).toBeVisible();
    for (const ph of [A, B]) await expect(ph.p.locator('.phone-results')).toBeVisible();
    await h.getByTestId('lobby-btn').click();
    await expect(h.getByTestId('start-btn')).toBeVisible();
  }
  expect(problems).toEqual([]);
  expect(errors).toEqual([]);
});
