import { expect, test } from '@playwright/test';
import { HTTP, newHost, newPhone, waitPlaying } from './util';

// Accounts live entirely inside the website (our own server + database). Guests never need one.

test('register on the site, play signed-in next to a guest, see stats/history/achievements, sign out and back in', async ({ browser }) => {
  test.setTimeout(90_000);
  const email = `p${Date.now()}@example.com`;

  // 1) register from a phone browser
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, hasTouch: true, isMobile: true, locale: 'en-US' });
  const p = await ctx.newPage();
  await p.goto(`${HTTP}/`);
  await p.getByTestId('account-link').click();
  await expect(p).toHaveURL(/\/account$/);
  await p.getByTestId('tab-register').click();
  await p.locator('input[name="email"]').fill(email);
  await p.locator('input[name="password"]').fill('family chaos 1');
  await p.locator('input[name="nickname"]').fill('Member');
  await p.getByTestId('auth-submit').click();
  await expect(p.getByTestId('profile-name')).toHaveText('Member');
  await expect(p.getByTestId('stat-games')).toHaveText('0');

  // the session cookie is HttpOnly (not readable by page scripts)
  expect(await p.evaluate(() => document.cookie)).not.toContain('fc_session');
  const cookies = await ctx.cookies();
  expect(cookies.find((c) => c.name === 'fc_session')).toMatchObject({ httpOnly: true, sameSite: 'Lax' });

  // 2) a room on the TV; the member joins (form is prefilled from the account) + a guest
  const { h, code } = await newHost(browser);
  await p.goto(`${HTTP}/join/${code}`);
  await expect(p.locator('input[name="name"]')).toHaveValue('Member');
  await expect(p.getByTestId('account-note')).toContainText('Signed in as Member');
  await p.getByTestId('join-btn').click();
  await expect(p.getByTestId('ready-btn')).toBeVisible();
  const guest = await newPhone(browser, `${HTTP}/join/${code}`, 'Guest');
  await expect(guest.p.getByTestId('account-note')).toHaveCount(0); // note only on the join form
  await h.getByTestId('start-btn').click();
  await waitPlaying(h);
  await h.getByRole('button', { name: /End round/ }).click();
  await expect(h.locator('.results__title')).toBeVisible();

  // 3) profile shows the saved game
  await p.goto(`${HTTP}/account`);
  await expect(p.getByTestId('stat-games')).toHaveText('1');
  await expect(p.getByTestId('history').locator('li')).toHaveCount(1);
  await expect(p.getByTestId('history')).toContainText('Bumper Battle');
  await expect(p.locator('[data-ach="first_game"]')).toHaveAttribute('data-done', '1');

  // 4) sign out, wrong password, sign in again
  await p.getByTestId('sign-out').click();
  await expect(p.getByTestId('auth-form')).toBeVisible();
  await p.locator('input[name="email"]').fill(email);
  await p.locator('input[name="password"]').fill('wrong password');
  await p.getByTestId('auth-submit').click();
  await expect(p.locator('.error')).toContainText('Wrong email or password');
  await p.locator('input[name="password"]').fill('family chaos 1');
  await p.getByTestId('auth-submit').click();
  await expect(p.getByTestId('stat-games')).toHaveText('1');
});

test('account API rejects cross-site posts and non-JSON bodies (CSRF)', async ({ request }) => {
  const evil = await request.post(`${HTTP}/api/auth/login`, {
    headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    data: { email: 'a@b.co', password: 'x' },
  });
  expect(evil.status()).toBe(403);
  const form = await request.post(`${HTTP}/api/auth/login`, { form: { email: 'a@b.co', password: 'x' } });
  expect(form.status()).toBe(400);
});

test('owner setup: the setup code makes a signed-in user OWNER; only that browser gets the crown, and its powers run through the server', async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
  const p = await ctx.newPage();
  await p.goto(`${HTTP}/account`);
  await p.getByTestId('tab-register').click();
  await p.locator('input[name="email"]').fill(`owner${Date.now()}@example.com`);
  await p.locator('input[name="password"]').fill('family chaos 1');
  await p.locator('input[name="nickname"]').fill('Boss');
  await p.getByTestId('auth-submit').click();
  await expect(p.getByTestId('profile-name')).toHaveText('Boss');
  // a wrong code does nothing
  await p.locator('summary', { hasText: 'Owner setup' }).click();
  await p.getByTestId('owner-code').fill('nope');
  await p.getByTestId('owner-claim').click();
  await expect(p.getByTestId('owner-badge')).toHaveCount(0);
  await p.getByTestId('owner-code').fill('e2e-owner-code-123');
  await p.getByTestId('owner-claim').click();
  await expect(p.getByTestId('owner-badge')).toBeVisible();

  // host screen in the same browser: crown button + working powers (players in the room)
  const host = await ctx.newPage();
  await host.goto(`${HTTP}/host`);
  await expect(host.getByTestId('crown-btn')).toBeVisible();
  const code = (await host.getByTestId('room-code').innerText()).replace(/\s/g, '');
  for (const n of ['One', 'Two']) await newPhone(browser, `${HTTP}/join/${code}`, n);
  await host.getByTestId('crown-btn').click();
  await host.locator('[data-power="bonus"]').click();
  await expect(host.locator('.player-tile__meta', { hasText: /\b3\b/ })).toHaveCount(1);

  // an anonymous host never sees the crown
  const { h: anon } = await newHost(browser);
  await expect(anon.getByTestId('crown')).toHaveCount(0);
});
