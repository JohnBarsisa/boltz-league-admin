# Boltz League Admin

[Open the admin dashboard](https://johnbarsisa.github.io/boltz-league-admin/) · [Open the public match centre](https://johnbarsisa.github.io/boltz-league-match-centre/)

Select a tool, sign in with the configured league owner account and approve the dashboard connection. Keep the owner window open while editing. If a browser blocks that window, the secure editor link opens the same management tools in one tab.

The owner can edit clubs and squads, fixtures, live events, streams, formations, homepage features, navigation, branding and homepage sections. Tournament setup can generate a single round robin or an empty programme for manual scheduling. Starting a competition stages the switch. Publish changes to activate it. Previous tournaments can be downloaded with their full records and lineup positions.

## Source

GitHub Pages serves `docs/` from the main branch. `docs/desk/` contains the editor used by the dashboard. `service/` contains the hosted worker, database migrations, starter publication and owner editor. Run `node scripts/build.mjs` from `service/` to build the worker. The service uses the existing Boltz League database (DB), media bucket (BUCKET), owner identity (EDITOR_EMAIL) and separate referee credential (REF_PASSWORD). The public match centre reads published revisions from the same service. GitHub Pages hosts the frontend. Server changes also need deployment to the private Boltz League Studio service.

The dashboard exchanges requests through the verified owner window. No owner password is stored in GitHub Pages. The referee role continues to have its own matchday permissions.
