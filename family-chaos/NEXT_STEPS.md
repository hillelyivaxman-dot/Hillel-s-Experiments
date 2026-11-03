# NEXT STEPS — FAMILY CHAOS

Read PROGRESS.md and docs/GAME_AUDIT.md first. State: 30/30 games playable; racing/basketball/zombies/mage hill/freeze tag/space rescue reworked; one drawn icon set replaces emoji; `/admin` + owner management panel; party tournaments (party / pick games / knockout). Accounts (and so admin) are OFF on Render until `DATABASE_URL` is set.

## Verify first (user, in the browser)
1. Render → service → **Events/Logs**: latest deploy "Live"; `/health` says `ok`.
2. Play 2-3 rounds with real phones (landscape). Tell me for each game: too hard / too easy / confusing control / looks wrong. Numbers are constants at the top of each `server/games/*.ts` and in `shared/basketball.ts`.
3. For the crown: connect `DATABASE_URL` (docs/DEPLOY.md), set `OWNER_SETUP_CODE` on Render, open `/admin` and follow the 4 steps.

## Not done / next (priority order)
1. **Human play-testing and balance** (nothing was played by people): basketball aim sensitivity (`launch()` in shared/basketball.ts), zombie counts/speeds (`ZK`, `toSpawn` in arena2.ts), mage hill scoring, freeze tag speeds, boat stream strength (`push` in shared/tracks.ts), bike hurdle spacing.
2. **Lobby/home "console" redesign** — only partly done: cards have original art, play time, favourites-first, smooth GSAP phase transitions, tournament chips. Still a plain rail: no category tabs/search inside the host lobby, no big hero carousel.
3. **Per-game art & sound**: scenes are drawn in code (readable, consistent) but simple; sounds are the shared synthesized set. A real artist/sound pass would help.
4. **Accounts**: password reset (needs a free email provider), Google login, XP / cosmetics / profile card; roles ADMIN/HOST are reserved but have no behaviour yet.
5. **Tournaments v2**: League and multi-day formats, persistence in Postgres (survive Render restarts), bracket screen.
6. **Flaky test**: `multiplayer.spec "two phones control two different characters…"` failed its first attempt once in a long suite run (retry passed). Not reproducible in 18 isolated + 12 CPU-stressed repeats; cause still unknown (its first phase has no focus/visibility dependency that I could find). Global `retries: 1` stays; do not raise timeouts to hide it.

## Known risks
* Render free plan sleeps after 15 min idle and drops in-memory rooms on restart; 5 GB/month bandwidth (frame size budget test keeps snapshots < 900 B average).
* The full browser suite takes ~35 min; run it detached (`setsid nohup … &`) and poll the log.
