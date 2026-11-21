# Boltz League Admin

[Open the admin dashboard](https://johnbarsisa.github.io/boltz-league-admin/) · [Open the public match centre](https://johnbarsisa.github.io/boltz-league-match-centre/)

Select a tool, sign in with the configured league owner account and approve the dashboard connection. Keep the owner window open while editing. If a browser blocks that window, the secure editor link opens the same management tools in one tab.

The owner can edit clubs and squads, fixtures, live events, streams, formations, homepage features, navigation, branding and homepage sections. Tournament setup can generate a single round robin or an empty programme for manual scheduling. Starting a competition stages the switch. Publish changes to activate it. Previous tournaments can be downloaded with their full records and lineup positions.

## Source

GitHub Pages serves `docs/` from the main branch. `docs/desk/` contains the editor used by the dashboard. `service/` contains the hosted worker, database migrations, starter publication and owner editor. Run `node scripts/build.mjs` from `service/` to build the worker. The service uses the existing Boltz League database (DB), media bucket (BUCKET), owner identity (EDITOR_EMAIL) and separate referee credential (REF_PASSWORD). The public match centre reads published revisions from the same service. GitHub Pages hosts the frontend. Server changes also need deployment to the private Boltz League Studio service.

The dashboard exchanges requests through the verified owner window. No owner password is stored in GitHub Pages. The referee role continues to have its own matchday permissions.


## Referee publishing patch (22 November 2026)

The public website runs at `https://boltzleague.github.io/`, **but the live scores and referee writes are served by a separate private backend**. Deploying GitHub Pages **does not update the backend**.

The patched worker under `service/worker/` now permits authenticated referee login and `PUT /api/state` from the official GitHub Pages origin, keeps all other origins blocked, supports eight-a-side formations, and allows match start/finish timestamps under referee permissions. Its read-only `GET /api/health` endpoint reports `release: boltz-ref-publish-2026-11-22` when the corrected backend is actually active.

Backend deployment procedure for the owner of the existing Boltz League Studio service:

1. Download the successful GitHub Actions artifact **boltz-league-backend-worker** (or run `cd service && node scripts/build.mjs`).
2. Deploy `dist/server/index.js` **to the existing private backend service**, not GitHub Pages, preserving its bound `DB` database, `BUCKET` media storage, `EDITOR_EMAIL`, `REF_PASSWORD`, and existing production records. Do not recreate or reset the database.
3. Check the backend health endpoint and confirm `boltz-ref-publish-2026-11-22` before retrying a referee login from GitHub Pages. The service's routing layer must continue to expose `/referee/api/*` and `/api/league` and allow the official origin in CORS preflights.
4. Test a referee's authenticated save in production using a real authorized user and a match they intend to change. Never put passwords or tokens into GitHub Actions source or console logs.

This repository's Actions workflow runs the actual backend worker against a completely in-memory mock database. The tests do not alter live league results and are not proof that the private backend was redeployed.
