# FAMILY CHAOS — architecture & decisions

## Chosen architecture (one consistent stack)

```
 TV / PC  (/host)                Node.js server (one process)                Phones (/join/CODE)
 React + Canvas renderer  ◄──WS── rooms · lobby · game loop 30 Hz ──WS──►  React controller (stick/buttons)
 draws snapshots, GSAP UI        authoritative rules, scores, anti-spam        sends {x,y,buttons} only
```

* **Server:** Node.js + TypeScript + `ws`. A single long-running process serves the built website *and* the WebSocket endpoint `/ws`. Rooms live in memory. A fixed-step loop (30 Hz) runs every active game.
* **Server-authoritative:** phones send only controller state (`x`, `y`, button bitmask, sequence number). All movement, collisions, laps, timers, scores and winners are computed on the server. Phones can't report scores.
* **Client:** Vite + React + TypeScript. Game screens are drawn on a 2D canvas from server snapshots, with interpolation between frames. UI animation uses GSAP (`@gsap/react` `useGSAP`) and respects a "reduced animations" setting plus `prefers-reduced-motion`. Sound effects are synthesized with WebAudio, so there are no audio files and no licensing questions.
* **Modular games:** each game is a server module (`server/games/*.ts`), a renderer (`client/src/render/*.ts`) and a catalog entry (`shared/catalog.ts`). See `ADDING_A_GAME.md`.
* **Why not Phaser or Three.js yet:** the server owns physics, so the client only draws. A canvas renderer with no engine keeps the bundle small (~130 KB gzip) and works on weak TVs. Three.js can be added per game later, because renderers are independent.
* **Why not Next.js:** there is no SEO or SSR need, and Next.js on serverless hosting (Vercel) can't run a permanent WebSocket server. One Node process is simpler and runs identically on a LAN, on Render and on a home PC.
* **Why not Cloudflare Durable Objects (yet):** it's a good fit for rooms, and its free tier now includes SQLite-backed Durable Objects. But it changes the runtime (Workers instead of Node) and local LAN play would need `wrangler`. The room logic (`server/room.ts`) is transport-independent (`Client` interface), so it can be moved into a Durable Object later if the free Render tier becomes the bottleneck.

## Accounts (inside the website)

* Our own `/api/auth/*` and `/api/me` endpoints on the same Node server, so players never meet a third-party login.
* **Passwords:** scrypt (N=16384, r=8, p=1) with a per-user salt. Constant-ish timing for unknown emails.
* **Brute-force protection:** per-IP rate limit, and an email is locked for 15 minutes after 8 failed attempts.
* **Sessions:** a 256-bit random token in an `HttpOnly; SameSite=Lax; Secure` cookie. Only its SHA-256 is stored, it expires after 30 days, and every session is revoked when the password changes.
* **CSRF:** POST requests need a JSON body and a same-origin `Origin` header.
* **Results:** the WebSocket handshake carries the cookie, so the server knows which players are signed in. Only server-computed match results are written to `plays`. Stats, favourites and achievements are derived from those rows.
* **Storage (`server/db.ts`):** `DATABASE_URL` uses PostgreSQL (free Neon in production). Otherwise it uses PGlite (Postgres in WASM), stored in `./data/db` on a home PC, or in memory on Render/tests (not persistent, and the UI says so).
* **Not yet:** password-reset email (needs an email provider key) and Google sign-in (needs a Google OAuth client). Neither is shown in the UI until it works.

## Networking details

| Concern | How it's handled |
| --- | --- |
| Latency | 30 Hz snapshots + client interpolation; Reaction Duel subtracts half the host-screen RTT and half the phone RTT |
| Reconnect | Each player gets a random session token (stored on the phone). Rejoining with it re-binds the same player, so there are no duplicates. Auto-reconnect with backoff. The host screen resumes with its secret `hostKey` |
| Duplicate/out-of-order input | Per-player monotonic `seq`; stale messages are dropped (reset at each game start) |
| Disconnected players | Kept for the whole match (their character idles). Removed 90 s after the match if they don't return |
| Flooding | Per-socket token bucket (90 msg/s), 8 KB max message, per-IP limits on room creation and join attempts, max 500 rooms, idle rooms deleted after 10 min |
| Room security | 4-letter codes from 20 consonants (160k codes), optional password, max players, host/leader-only admin actions (checked on the server), kicked players' tokens are banned for that room |
| Names | Unicode-normalized, control/bidi chars stripped, 14 chars max, small EN/HE blocklist. Players can report a name; enough reports reset it to "Player N". No open chat |
| Remote play | Everyone opens the same public URL. Remote viewers open `/watch/CODE` to see the screen live while using their phone as the controller |

## Hosting (free) — verified limits as of writing

* **Render free web service** (blueprint `render.yaml` in the repo root): supports WebSockets over HTTPS/WSS. It sleeps after 15 min without inbound traffic (waking takes up to ~1 min). It has 750 instance hours/month per workspace and **5 GB bandwidth/month** (reduced from 100 GB in 2026; overage is billed only if a card is on file, so don't add one). Rooms are in memory, so a restart ends running rooms. Good for family/friends use, **not** for unlimited users. Details: `DEPLOY.md`.
* **Bandwidth measures:** permessage-deflate on WebSockets (frames compress to ~5–20%), static track data is not streamed, coordinates are integers, gzip for static assets, and frames are skipped for screens with a backed-up socket.
* **LAN mode** (free, best latency): run `npm start` on a PC. Phones on the same Wi-Fi scan the QR, which automatically uses the PC's LAN IP.
* **Not suitable:** Vercel/Netlify functions (no persistent WebSocket server).

## Open Party Lab evaluation (github.com/Hartwich/Open-Party-Lab)

Checked by cloning `main` (last commit 2026-10-30):

* **Available and active:** yes. **License:** Apache-2.0 (allows reuse, with NOTICE/attribution). Its NOTICE warns that assets must be reviewed separately.
* **Structure:** the platform (server/host/controller packages) plus **21 optional games in separate repositories**. Each repository's license and assets would have to be checked one by one. The README itself says most games are alpha/beta, and its status doc lists many items as "physical devices remain unverified".
* **Fit:** German-first (EN added), Windows/PowerShell dev scripts, ~59 MB of source, and a complex multi-repo game-boundary system.
* **Decision:** we built an original, smaller platform rather than forking. It's Hebrew/RTL-first, uses one repository, is easier to manage from a phone, and we own every asset. We did **not** copy code or assets from it. Its validated ideas were useful as reference: a single Node server on Render free, server clock for countdowns, and session recovery tokens.
