# Design tooling

Open-source tools used to research and verify the UrOwnMenu interface. They
are development tools, not runtime dependencies of the published app.

## MCP servers (stdio)

| Tool | Install | Used for |
|---|---|---|
| `awwwards-mcp` | `npm i -g awwwards-mcp playwright ffmpeg-static` | Searching award-winning sites for design DNA, measuring reference band structure, reading motion and hover behaviour, and capturing this project's own build for visual review. |
| `refero-design-mcp` | `npm i -g @darcas/refero-design-mcp` | Extracting measured design systems (palette roles, type pairing, surface ladders, dos and don'ts) as `design.md`. |

Both are MIT. See `THIRD_PARTY_UI.md` for the full provenance record.

## Client

`apps/web/scripts/mcp-client.mjs` is a small stdio MCP client so these
servers can be driven from a script:

```bash
# List tools
node scripts/mcp-client.mjs list

# Call a tool
node scripts/mcp-client.mjs call search_sites '{"tags":["food-drink"],"count":8}'
```

Point it at a different server with `AWWWARDS_CMD`:

```bash
set AWWWARDS_CMD=refero-design-mcp
node scripts/mcp-client.mjs list
```

## Helper scripts

| Script | Purpose |
|---|---|
| `scripts/awwwards-search.mjs` | Search Awwwards by taxonomy tag (food, restaurant, magazine, scrolling). |
| `scripts/awwwards-taxonomy.mjs` | Dump the full searchable taxonomy (195 tags, 27 colours, 115 technologies). |
| `scripts/awwwards-brief.mjs` | Generate a cited design brief from 2-5 reference sites. |
| `scripts/awwwards-details.mjs` | Fetch design DNA and band maps for reference sites. |
| `scripts/awwwards-analyze.mjs` | Measure this project's own band structure. |
| `scripts/awwwards-capture.mjs` | Full-page screenshot of any URL, including `localhost`. |
| `scripts/capture-all-templates.mjs` | Publish and capture all five templates at desktop and mobile. |
| `scripts/refero-search.mjs` | Search measured design systems. |
| `scripts/refero-design.mjs` | Fetch the full design system for a style id. |

## Why the browser automation could not judge the animation

The in-session browser reports `document.timeline.currentTime === 0` while
`performance.now()` advances. The compositor is not producing frames in that
context, so CSS and Web Animations never progress and `getAnimations()`
returns `startTime: null`. Animations were therefore verified by seeking each
animation to its end (`currentTime = 100000`) and asserting the computed
final state, and by full-page capture through Playwright, which runs a real
compositor.

## The API test harness

`apps/api/scripts/e2e-client-journey.mjs` runs the full owner journey against
the local API: register, log in, create a restaurant, pick a palette, build a
menu with two items including a photo, edit, publish twice, read the public
menu, read the QR target, check version history, exercise the AI helpers,
sign out, and verify a second account cannot reach the first account's data.

```bash
cd apps/api && node scripts/e2e-client-journey.mjs
```
