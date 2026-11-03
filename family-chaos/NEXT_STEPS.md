# NEXT STEPS — FAMILY CHAOS

Read PROGRESS.md first. State at the last update: **30/30 games playable, party tournament v1 (in-memory)**; accounts are OFF on Render until `DATABASE_URL` is set.

## Before the next family night (user, in the browser — nothing needs chat secrets)
1. Render dashboard → service `family-chaos` → **Events/Logs**: confirm the latest deploy (branch `ccr-64ced051-a2t8s8`) is "Live", then open `/health` (must say `ok`) and `/api/info`.
2. Open `/host` on the TV/PC, join with phones from the QR code. Try 3 phones at least. Rotate phones to landscape.
3. Use "🏆 Party tournament" (5 games) for the whole evening, or pick single games.
4. Tell me which games feel too hard / too easy / confusing — the balance numbers are constants at the top of each server file.

## Build next (priority order from the master prompt)
1. **Accounts + persistence** — connect Neon (`DATABASE_URL`, see docs/DEPLOY.md; this is what switches accounts, the owner claim and the crown on). Then: password reset (needs an email provider — free tier only), optional Google login, XP / cosmetics / profile card.
2. **GOD ADMIN crown** — DONE server-side + host UI + tests (see PROGRESS.md). Left: real-browser e2e of the owner claim, ADMIN/HOST role behaviour, per-power polish in each game (e.g. a game-specific effect instead of the generic ones), a visible audit log for the owner.
3. **Tournaments v2** — party / pick-games / knockout / hold / cancel / no-shows / ties are DONE (in-memory). Left: League and Multi-day formats, a bracket screen, persistence in Postgres so a Render restart does not lose it, profile card.
4. **Console-style redesign** — hero + card carousel, estimated play time per game, GSAP page transitions (skills installed: gsap-core/react/performance, frontend-design).
5. **Game polish** — custom SVG art per game instead of emoji icons, sounds per game, intro/rules screen per game, balance passes from real play, tilt/wheel verification on real phones.

## Known risks
- Render free plan sleeps after 15 min idle (first load ≈ 1 min) and restarts drop in-memory rooms and tournaments.
- 5 GB/month bandwidth: frame size budget test (`tests/unit/framesize.test.ts`) keeps snapshots < 900 B average.
- Draw & Guess sends strokes every ~10 frames; fine for a family, not stress-tested at 12 players.
- The e2e "all games" loops take several minutes; run `npm run check` detached (see PROGRESS.md "How to continue").
