import { expect, test } from '@playwright/test';
import jsQR from 'jsqr';
import { delta, frame, HTTP, HTTPS, lanIp, newHost, newPhone, playerIds, waitPlaying } from './util';

// Network scenarios. The TLS proxy in front of the server imitates Render's HTTPS edge and
// adds ~50 ms per direction, so phones going through it behave like players on another network.

// 127.0.0.2 is a loopback alias that the client does NOT treat as "localhost", so the site is served
// from a non-local HTTPS origin — the same situation as https://family-chaos-xxxx.onrender.com.
// (A fake hostname can't be used here: this sandbox's browser routes non-local names through its proxy.)
const PUBLIC_HOST = '127.0.0.2';

/** Decodes the QR on the host screen (what a phone camera would read) and checks it matches the URL shown. */
async function qrTarget(h: import('@playwright/test').Page) {
  const img = h.locator('.qr-frame img');
  await expect(img).toBeVisible();
  let decoded: string | undefined;
  await expect.poll(async () => {
    const shown = await img.getAttribute('alt');
    const px = await img.evaluate((el: HTMLImageElement) => {
      const c = document.createElement('canvas');
      c.width = el.naturalWidth;
      c.height = el.naturalHeight;
      const g = c.getContext('2d')!;
      g.drawImage(el, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      return { w: d.width, h: d.height, data: Array.from(d.data) };
    });
    decoded = jsQR(Uint8ClampedArray.from(px.data), px.w, px.h)?.data;
    return !!decoded && decoded === shown;
  }, { timeout: 10_000 }).toBe(true);
  return decoded!;
}

test('public HTTPS site: WebSockets use WSS and the QR points at the public origin', async ({ browser }) => {
  const origin = `https://${PUBLIC_HOST}:8443`; // stands in for https://family-chaos-xxxx.onrender.com
  const { h, code, sockets, errors } = await newHost(browser, origin);
  const joinUrl = await qrTarget(h);
  expect(joinUrl).toBe(`${origin}/join/${code}`);
  expect(sockets.every((u) => u.startsWith('wss://'))).toBe(true);

  // a phone "scans" the QR: opens exactly that URL
  const a = await newPhone(browser, joinUrl, 'Scanner');
  expect(a.sockets[0]).toMatch(/^wss:\/\//);
  const b = await newPhone(browser, joinUrl, 'Second');
  await expect(h.locator('.player-tile[data-pid]')).toHaveCount(2);
  const ids = await playerIds(h);

  await h.getByTestId('start-btn').click();
  await waitPlaying(h);
  const f0 = await frame(h);
  await a.p.keyboard.down('ArrowLeft');
  await b.p.keyboard.down('ArrowDown');
  await h.waitForTimeout(800);
  const f1 = await frame(h);
  const ma = delta(f0, f1, 'p', ids.Scanner), mb = delta(f0, f1, 'p', ids.Second);
  expect(ma.dx).toBeLessThan(-50);
  expect(mb.dy).toBeGreaterThan(50);
  expect(errors).toEqual([]);
});

test('local mode: QR on a localhost host screen points phones to the LAN address', async ({ browser }) => {
  const ip = lanIp();
  test.skip(!ip, 'no non-loopback interface');
  const { h, code } = await newHost(browser, HTTP);
  await expect.poll(async () => (await h.locator('.qr-frame img').getAttribute('alt')) ?? '').toContain(ip!);
  expect(await qrTarget(h)).toBe(`http://${ip}:8790/join/${code}`);
});

test('players on different networks: a remote phone (HTTPS + latency) and a local phone play together', async ({ browser }) => {
  const { h, code } = await newHost(browser, HTTP); // screen on the "home" network
  const remote = await newPhone(browser, `${HTTPS}/join/${code}`, 'Remote'); // through TLS proxy, +100 ms RTT
  const local = await newPhone(browser, `${HTTP}/join/${code}`, 'Local');
  const ids = await playerIds(h);
  await h.locator('.lobby__games [data-game="kart"]').click();
  await h.getByTestId('start-btn').click();
  await waitPlaying(h);
  const f0 = await frame(h);
  await remote.p.keyboard.down('Space'); // gas
  await local.p.keyboard.down('Space');
  await h.waitForTimeout(1500);
  const f1 = await frame(h);
  const dr = delta(f0, f1, 'c', ids.Remote).d, dl = delta(f0, f1, 'c', ids.Local).d;
  expect(dr).toBeGreaterThan(150);
  expect(dl).toBeGreaterThan(150);
  // latency only delays the start by ~a frame or two, not the speed
  expect(Math.abs(dr - dl)).toBeLessThan(120);
  await expect(remote.p.getByTestId('hud')).toContainText('Lap');
});

test('Wi-Fi drop: phone and screen reconnect to the same room and player, game continues', async ({ browser, request }) => {
  const { h, code } = await newHost(browser, HTTPS);
  const a = await newPhone(browser, `${HTTPS}/join/${code}`, 'Dropper');
  const b = await newPhone(browser, `${HTTP}/join/${code}`, 'Stable');
  const ids = await playerIds(h);
  await h.getByTestId('start-btn').click();
  await waitPlaying(h);

  // kill every connection that goes through the "remote network" (phone A + the screen)
  const r = await request.get(`${HTTPS}/__proxy/drop`, { ignoreHTTPSErrors: true });
  expect(await r.text()).toMatch(/dropped [1-9]/);
  // both come back by themselves
  await expect(a.p.locator('.conn-banner')).toBeHidden({ timeout: 15_000 });
  await expect(h.locator('.conn-banner')).toBeHidden({ timeout: 15_000 });
  await expect(a.p.locator('.pad')).toBeVisible();

  // same room code, still 2 players, no duplicates, and the reconnected phone still drives its critter
  const f0 = await frame(h);
  expect(f0.p).toHaveLength(2);
  await a.p.keyboard.down('ArrowUp');
  await h.waitForTimeout(800);
  const f1 = await frame(h);
  expect(delta(f0, f1, 'p', ids.Dropper).dy).toBeLessThan(-40);
  await h.getByRole('button', { name: /End round/ }).click();
  await expect(h.locator('.results__title')).toBeVisible();
  await h.getByTestId('lobby-btn').click();
  await expect(h.getByTestId('room-code')).toHaveText(new RegExp(code.split('').join('\\s*')));
  await expect(h.locator('.player-tile[data-pid]')).toHaveCount(2);
  void b;
});

test('dead network (socket open but silent, e.g. Wi-Fi to 4G switch): phone detects it and rejoins', async ({ browser, request }) => {
  const { h, code } = await newHost(browser, HTTP);
  const a = await newPhone(browser, `${HTTPS}/join/${code}`, 'Silent');
  await newPhone(browser, `${HTTP}/join/${code}`, 'Other');
  const ids = await playerIds(h);
  await h.getByTestId('start-btn').click();
  await waitPlaying(h);
  const r = await request.get(`${HTTPS}/__proxy/freeze`, { ignoreHTTPSErrors: true });
  expect(await r.text()).toMatch(/frozen [1-9]/);
  // within ~10 s the phone notices missing pongs and opens a fresh socket by itself
  const before = a.sockets.length;
  await expect.poll(() => a.sockets.length, { timeout: 15_000 }).toBeGreaterThan(before);
  await expect(a.p.locator('.conn-banner')).toBeHidden({ timeout: 10_000 });
  await expect(a.p.locator('.pad')).toBeVisible();
  const f0 = await frame(h);
  await a.p.keyboard.down('ArrowRight');
  await h.waitForTimeout(800);
  const f1 = await frame(h);
  expect(delta(f0, f1, 'p', ids.Silent).dx).toBeGreaterThan(40);
  expect(f1.p).toHaveLength(2);
});

test('phone that loses the room (server restart) gets a clear message instead of hanging', async ({ browser }) => {
  const p = await browser.newContext({ locale: 'en-US' }).then((c) => c.newPage());
  await p.goto(`${HTTP}/join/ZZZZ`);
  await p.locator('input[name="name"]').fill('Lost');
  await p.getByTestId('join-btn').click();
  await expect(p.locator('.error')).toContainText('not found');
});
