# UrOwnMenu — Status

## Running right now

| Service | URL | Command |
|---------|-----|---------|
| Web app (React + Vite) | http://localhost:5173 | `cd apps\web && npx vite dev --port 5173` |
| API (Hono Worker + D1) | http://127.0.0.1:8787 | `cd apps\api && npx wrangler dev --port 8787` |

Or both, detached:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-servers.ps1   # start
powershell -ExecutionPolicy Bypass -File .\stop-servers.ps1    # stop
```

## What works

Verified by `apps/api/scripts/e2e-client-journey.mjs` — **81/81 checks pass** —
and by capturing the real build at desktop and mobile widths with
`capture_live_site` and reviewing the images.

Recent motion work:

- Orbital Menu animates like the animata "Orbiting items" pattern (MIT): the
  ring rotates continuously, chips counter-rotate so dishes stay upright,
  pause on hover, disabled under prefers-reduced-motion. Ellipse variants
  spring the dishes along the ellipse on selection. No caption text sits on
  dish photography.
- Menu Magazine folds its right page around the centre gutter with a shaded
  curl, carries its images through the fold, and each page owns its own
  product (left: feature, right: numbered index).

Recent media and art-direction work:

- Cutouts are normalised on upload: trimmed to alpha bounds, rescaled to a
  90% fill, optically centred, feathered and padded to a known frame. A
  rectangle no longer stays a rectangle; an opaque matte falls back to the
  photograph path instead of being stored as a cutout.
  Verified by `apps/web/scripts/verify-cutout-normalise.mjs` - **8/8**.
- Every stored photo carries `photo_meta` (focal point, ratio, luminance,
  contrast, coverage, dominant colour). The API validates it, persists it and
  copies it into published snapshots; templates place images and size scrims
  from it. Verified by `apps/api/scripts/verify-photo-meta.mjs` - **6/6**.
- Templates render a deterministic SVG plate study (seeded from the item,
  tinted by palette, transparent ground) when a dish has no photograph.
- Editorial Showcase: signature row adapts to 1/2/3+ featured items, media
  frames contain rather than stretch, text-only courses no longer reserve the
  media column, chapter bands bleed to the viewport edges.
- Demo fixtures repaired: the Cairo menu's "Fresh Orange Juice" now shows an
  actual glass of juice (CC0, Commons) prepared through the real upload
  pipeline, and its legacy cutout was re-normalised in place.

| Phase | Status |
|-------|--------|
| Registration (email + password, PBKDF2 hashed, D1 sessions) | Working |
| Login / logout / session restore | Working |
| Restaurant creation (name, slug, description, currency, timezone, phone, address) | Working |
| 8 brand palettes from `docs/DESIGN_SYSTEM.md` | Working |
| Menu studio: categories and items, add / edit / delete / hide | Working |
| Owner-entered ingredients per item | Working |
| Photo upload with media editor (crop, focal point, exposure, contrast, saturation, warmth, sharpening) | Working |
| ONNX background removal, two permissively licensed models | Working |
| Cutout delivered as WebP with alpha | Working |
| 5 templates: Editorial Showcase, Orbital Menu, Ingredient Universe, Endless Table, Menu Magazine | Working |
| 3 new templates from owner inspiration: Café Pedestal (Drinko), Mosaïque (AKME), Ingredient Story | Working |
| Ingredient Story backgrounds: macro photography resolved by name from Openverse (CC0/PDM/CC-BY/CC-BY-SA) with Wikimedia Commons fallback, cached in D1, stored in R2, credited in the public footer | Working |
| Ingredient Universe reskinned to premium black (gold leaders, warm off-white type) | Working |
| Publish embeds `ingredientPhotos` (url, licence, creator, source link) into the immutable snapshot | Working |
| Owner marks a hero ingredient per item (the Ingredient Story background) | Working |
| Wove-style numbered orbital category navigation | Working |
| Publish -> immutable snapshot with SHA-256 checksum, version history | Working |
| Public menu at `/m/:slug` with no login | Working |
| QR code pointing at a pinned snapshot | Working |
| Tenant isolation between accounts | Working |
| Deterministic AI helpers (copy, template recommendation, category organiser, visual review) | Working |

## Accessibility

`analyze_accessibility` on the built page:

| Check | Result |
|---|---|
| Worst text contrast | 8.11:1 (AA threshold is 4.5:1) |
| Images missing alt | 0 |
| Images missing width/height | 0 |
| Heading order | 1 -> 2 -> 3, no skips |
| Positive tabindex | 0 |
| Document lang / title | present |

## Known limitations

- Background-removal models download from the Hugging Face CDN on first use
  (~42 MB for the default model, ~6 MB for the light one). The owner opts in
  explicitly and the choice is shown with its licence and size.
- The `references` in `docs/DESIGN_DECISIONS.md` cover 5 of the 12 templates
  in `docs/TEMPLATES.md`. Bento Table, Chef's Story, Tasting Journey,
  Minimalist Menu, 3D Gallery and the future concepts are not built.
- WebP derivatives are produced for cutouts only; normal photos ship as
  JPEG.
- The cutout's contact shadow is a static drop-shadow, not a light model
  that reacts to the dish's own shading.
- Ingredient macro photographs are resolved from Openverse / Wikimedia
  Commons at publish time. The platform needs network access to those APIs
  at that moment; on failure the menu publishes anyway with a typographic
  chapter instead of a photograph. Once resolved, photos are cached in D1
  and stored in R2 forever, so published menus never depend on third parties.
  CC-BY / CC-BY-SA sources are credited in the public footer (creator,
  licence, source link), which satisfies the licence requirement.
- Production deployment has not been exercised against a real Cloudflare
  account; local development uses the wrangler simulators.

## Cost

| Item | Cost |
|------|------|
| Cloudflare Workers / D1 / R2 free tier | $0 |
| Photo processing (browser Canvas) | $0 |
| Background removal (open-source model, in-browser) | $0 |
| Design research (open-source MCP servers) | $0 |
| AI helpers (deterministic, no model calls) | $0 |
| **Total / payment card** | **$0 / never required** |
