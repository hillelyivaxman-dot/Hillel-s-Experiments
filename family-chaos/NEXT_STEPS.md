# NEXT STEPS — FAMILY CHAOS 3.0

Read PROGRESS.md and docs/GAME_AUDIT.md first. State: exactly ten games; Kart Chaos in 3D on the phone; Flag Wars; sticker-book design system and console lobby; accounts, owner/GOD powers with chaos mode; persistent tournaments (party / knockout / league / multi-day). 113 unit tests and 38 browser tests pass on this build.

## Verify first (you, with real devices)
1. Render → service → **Events/Logs**: latest deploy "Live"; `/health` says `ok`. (Not checked from the sandbox.)
2. Play Kart Chaos on a real phone: 3D smoothness, wheel/arrows/tilt direction (an "invert" switch exists), camera choice. Tell me what feels off per game.
3. For accounts, owner and saved tournaments: connect `DATABASE_URL` (docs/DEPLOY.md), set `OWNER_SETUP_CODE` on Render, open `/admin` and follow the steps.

## Next (priority order)
1. Polish the remaining eight games: Chaos Rush tracks/camera, Family Board Party (dice/board interactivity, bonus mini-games), Trap Builders flow, Bumper / Floor Is Lava / Hot Potato feel; original per-game sound.
2. Browser tests for the tournament UI (league, multi-day, resume), per-game "play to the end" runs, and a WebSocket load test with many rooms.
3. Team tournaments, cosmetic prizes beyond trophies, chaos powers for Kart / Soccer / Hockey / Rush / Trap Builders / Board.
4. Kart podium scene and 3D polish; performance budget measured on a real phone.
5. Accounts: password reset, Google login, XP / cosmetics profile card.

## Known risks
* Render free plan sleeps after 15 min idle and drops in-memory rooms on restart; 5 GB/month bandwidth (Kart phone frames are ~20 Hz, kept compact).
* The browser suite takes ~20 min; run each spec file detached and don't touch ports or rebuild `dist` while it runs (that caused false failures once).
