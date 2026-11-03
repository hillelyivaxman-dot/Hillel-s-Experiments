# Roadmap

Done in v0.1: phase 1 (infrastructure) and phase 2 (three required games, plus a fourth).

## Next (in order)
1. **Real-device pass:** play on physical phones (Android Chrome, iOS Safari) and a TV browser. Tune stick size and dead zone, then fix issues.
2. **Deploy** via `render.yaml` (owner action, `DEPLOY.md`) and test rooms across different networks (4G phone + home Wi-Fi PC).
3. **Phase 3 polish:** better arena/track art, a loading screen, character-select animation, a music loop (synthesized), and a camera follow for Kart on large tracks.
4. **Phase 4 accounts:** Supabase Auth (email+password, Google OAuth, password reset). The `profiles` table and match history use row-level security, guests stay account-free, and stars and wins are saved only for signed-in players. Server-side writes go through the service key, never from phones.
5. **Phase 5:** 8 more games in 4 waves, bringing the total to 12. See `GAMES_PLAN.md`.
6. Then the board-style party game, team games and co-op games toward 30.
