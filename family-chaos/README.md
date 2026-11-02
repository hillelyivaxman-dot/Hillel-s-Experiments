# 🎮 FAMILY CHAOS

Party games on the big screen, with phones as controllers. It runs in the browser: no app to install, and guests don't need to sign up. It's free and original (all characters, art and sounds are drawn or synthesized in code).

## Status (v0.1)

| Part | Status |
| --- | --- |
| Rooms, 4-letter code, QR, join link, password, max players | ✅ working, tested |
| Phone controller: floating joystick + multi-touch buttons + vibration + keyboard for desktop | ✅ (tested in emulated mobile Chromium; **not yet on physical phones**) |
| Lobby: animated critters, colors, ready, avatar change, kick, transfer leader, leader controls from phone | ✅ |
| Reconnect (refresh / Wi-Fi drop) without duplicates | ✅ tested |
| Pause / end round / results with podium, stars, play again / back to lobby / switch game | ✅ tested |
| Remote viewers: `/watch/CODE` | ✅ (basic) |
| Hebrew + English, RTL/LTR, reduced animations, sound toggle | ✅ |
| **Games playable:** Bumper Battle, Kart Chaos (3 tracks, items, laps), Reaction Duel, Hot Potato | ✅ 4 / 12 |
| Mini Soccer, Obstacle Rush, Treasure Hunt, Air Hockey, Draw & Guess, Maze Escape, Tower Stack, Party Trivia | 🔜 shown as "coming soon", cannot start |
| Accounts (Supabase Auth), profiles, achievements | ❌ not started (phase 4) |
| Public deployment | ⏳ `render.yaml` ready; needs one-time Render connection (see below) |

## Run it

```bash
cd family-chaos
npm install
npm run build && npm start      # http://localhost:8787  → open /host on the TV/PC
# or for development with hot reload:
npm run dev                     # site on :5173, game server on :8787
```

On a home network, open `http://localhost:8787/host` on the PC. The QR code automatically points phones to the PC's LAN address (e.g. `http://192.168.1.20:8787/join/ABCD`). If phones can't connect, allow Node through the Windows firewall (private networks).

## Tests

```bash
npm run typecheck
npm test            # unit: rooms, permissions, reconnect, each game simulated to the end with bots
npm run test:e2e    # Playwright: host + 2 phone browsers over real WebSockets
npm run check       # all of the above + build
```

## Deploy for free (Render) — once, from the phone browser

1. Sign in at render.com with GitHub (the free plan needs no card at the time of writing).
2. **New → Blueprint**, then pick this repository. Render reads `render.yaml` (root) and creates `family-chaos` on the **free** plan.
3. After the build you get `https://family-chaos-XXXX.onrender.com`. Open `/host` on a TV/PC and scan with phones.

Limits: the free service sleeps after ~15 min idle (first load ~1 min), and rooms reset on restart. See `docs/ARCHITECTURE.md`.

## Docs

* `docs/ARCHITECTURE.md`: stack decisions, networking/security, hosting limits, Open Party Lab evaluation
* `docs/ADDING_A_GAME.md`: the game module API + template (`server/games/_template.ts`)
* `docs/ROADMAP.md`: what's next
