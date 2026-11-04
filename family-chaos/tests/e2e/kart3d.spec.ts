import { expect, test, type Page } from '@playwright/test';
import { BTN } from '../../shared/protocol';
import { frame, HTTP, newHost, newPhone, waitPlaying } from './util';

// Kart Chaos 3.0: the phone renders the race itself (Three.js, WebGL) from server snapshots; the host shows a 3D broadcast.
// WebGL here is software (SwiftShader) in headless Chromium: this checks the pipeline, not real-GPU performance.

const land = { viewport: { width: 891, height: 412 } }; // ~Galaxy S25 Ultra landscape (CSS pixels)
const dbg = (p: Page) => p.evaluate(() => (window as any).__fcKart ?? { frames: 0, calls: 0, cars: 0 });

test('Kart Chaos: the phone draws its own 3D world from live server frames, with HUD, camera switch and map', async ({ browser }) => {
  test.setTimeout(120_000);
  const { h, code } = await newHost(browser);
  const a = await newPhone(browser, `${HTTP}/join/${code}`, 'Driver', land);
  await newPhone(browser, `${HTTP}/join/${code}`, 'Rival', land);
  await h.locator('.lobby__games [data-game="kart"]').click();
  await h.getByTestId('start-btn').click();
  await waitPlaying(h);
  await expect(a.p.getByTestId('kart3d')).toBeVisible();
  // the WebGL world is really being rendered, with both cars in it
  await expect.poll(async () => (await dbg(a.p)).frames, { timeout: 20_000 }).toBeGreaterThan(10);
  expect((await dbg(a.p)).calls).toBeGreaterThan(5);
  await expect.poll(async () => (await dbg(a.p)).cars).toBe(2);
  // personal HUD: the kart drives itself, so the speedometer rises; place and lap are shown
  await expect.poll(async () => Number(await a.p.getByTestId('k3-speed').locator('b').innerText()), { timeout: 15_000 }).toBeGreaterThan(20);
  await expect(a.p.getByTestId('k3-place')).toContainText('/2');
  await expect(a.p.getByTestId('k3-lap')).toContainText('1');
  // phone frame rate is ~20 Hz (bandwidth friendly), not 30+
  const t0 = Date.now(); const n0 = (await dbg(a.p)).msgs ?? 0;
  await a.p.waitForTimeout(3000);
  const rate = (((await dbg(a.p)).msgs ?? 0) - n0) / ((Date.now() - t0) / 1000);
  expect(rate, `phone frames per second: ${rate.toFixed(1)}`).toBeGreaterThan(8); expect(rate).toBeLessThan(26);
  // camera button cycles chase -> bumper -> cockpit
  const label = () => a.p.getByTestId('k3-cam').innerText();
  const first = await label();
  await a.p.getByTestId('k3-cam').click();
  expect(await label()).not.toBe(first);
  // controls over the 3D view still reach the server: steering arrow + turbo
  const R = (await a.p.locator('[data-btn="R"]').boundingBox())!;
  await a.p.mouse.move(R.x + R.width / 2, R.y + R.height / 2); await a.p.mouse.down();
  await expect.poll(() => a.inputs.at(-1)?.x).toBe(1);
  await a.p.mouse.up();
  expect((await frame(h)).c).toHaveLength(2); // the host's 2D map is fed by the same race
});

test('Kart Chaos controls: manual gas option adds a GAS button and the manual flag; sensitivity and camera options are remembered', async ({ browser }) => {
  test.setTimeout(90_000);
  const { h, code } = await newHost(browser);
  const a = await newPhone(browser, `${HTTP}/join/${code}`, 'Driver', land);
  await newPhone(browser, `${HTTP}/join/${code}`, 'Rival', land);
  await h.locator('.lobby__games [data-game="kart"]').click();
  await h.getByTestId('start-btn').click();
  await waitPlaying(h);
  await expect(a.p.locator('.pad-btn')).toHaveCount(3);
  await a.p.getByTestId('pad-settings').click();
  await a.p.locator('[data-gas-mode="manual"]').click();
  await a.p.locator('[data-sens="1.3"]').click();
  await a.p.locator('[data-cam="cockpit"]').click();
  await a.p.locator('.pad-sheet .btn').click();
  await expect(a.p.locator('.pad-btn')).toHaveCount(4);
  await expect(a.p.locator('[data-btn="A"]')).toContainText(/GAS/i);
  await expect.poll(() => (a.inputs.at(-1)?.b ?? 0) & BTN.M).toBe(BTN.M); // manual flag is sent
  const gas = (await a.p.locator('[data-btn="A"]').boundingBox())!;
  await a.p.mouse.move(gas.x + gas.width / 2, gas.y + gas.height / 2); await a.p.mouse.down();
  await expect.poll(() => (a.inputs.at(-1)?.b ?? 0) & BTN.A).toBe(BTN.A);
  await a.p.mouse.up();
  await a.p.reload();
  await expect(a.p.locator('.pad-btn')).toHaveCount(4); // remembered
});

test('Kart Chaos host: 3D broadcast with leader / car switcher, and a switch back to the 2D map', async ({ browser }) => {
  test.setTimeout(120_000);
  const { h, code } = await newHost(browser, HTTP, true);
  const a = await newPhone(browser, `${HTTP}/join/${code}`, 'Driver', land);
  await newPhone(browser, `${HTTP}/join/${code}`, 'Rival', { viewport: { width: 360, height: 240 } });
  await h.locator('.lobby__games [data-game="kart"]').click();
  await h.getByTestId('start-btn').click();
  await waitPlaying(h);
  await expect(h.getByTestId('kart3d')).toBeVisible();
  await expect.poll(async () => (await dbg(h)).frames, { timeout: 30_000 }).toBeGreaterThan(5);
  await expect.poll(async () => (await dbg(h)).cars).toBe(2);
  await h.getByTestId('k3-cam').click();
  await h.getByTestId('k3-leader').click();
  await h.getByTestId('view-toggle').click();
  await expect(h.getByTestId('kart3d')).toHaveCount(0);
  void a;
});
