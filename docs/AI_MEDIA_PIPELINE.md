# AI Service Layer — free-first implementation

## Constraint
$0, no payment card, no paid APIs, no trial credits. Core platform works with AI disabled. Hosted free inference is quota-limited and can change; over-quota fails gracefully without billing.

## Architecture
Frontend -> authenticated Hono Worker -> task router -> provider adapter -> optional Cloudflare Workers AI -> Zod validation -> D1 AI job record -> owner approval. This is an application-owned service layer, not a separate paid Python server. Keep adapters so FastAPI/Ollama can be added later.

## Bounded specialist agents (not autonomous agents)
1. Menu Copy Assistant: rewrite only owner-provided facts; draft only.
2. Menu Organizer: suggest categories/order based on supplied names/descriptions.
3. Template Recommender: deterministic rules first; AI may explain top 3.
4. Visual Review Assistant: optional vision model suggests crop/quality/alt text.
5. Media Preparation: deterministic browser code, not an LLM agent.
No unrestricted shell/filesystem/database/publishing tools or arbitrary loops.

## Model policy
Workers AI free allocation documented as 10,000 Neurons/day. Select only model IDs confirmed free for this account at implementation time. Candidate text model: `@cf/meta/llama-3.1-8b-instruct-fp8` or a smaller free-eligible option. Candidate vision model: `@cf/llama-3.2-11b-vision-instruct` only if Free access is confirmed. Check live catalog: https://developers.cloudflare.com/workers-ai/models/ . Some models require Workers Paid; never use them. No Hugging Face hosted inference dependency.
Future local-only candidates (not MVP hosting): Qwen3-4B, Qwen3-VL-4B, rembg with individually licensed weights, Real-ESRGAN. These require local compute or later hosting.

## Tasks
- POST /api/ai/menu-copy
- POST /api/ai/category-suggestions
- POST /api/ai/template-recommendation
- POST /api/ai/image-review
- GET /api/ai/jobs/:id
- POST /api/ai/jobs/:id/approve
- POST /api/ai/jobs/:id/reject
For MVP, keep calls short and bounded; do not invent a long-running queue if unnecessary.

## Image preparation
1. Preserve immutable original. — DONE: the original is stored once in R2 and never overwritten; derivatives are separate `media_assets` rows.
2. Validate file signature, MIME, dimensions and size; normalize EXIF. — DONE: `inspectImageFile()` checks MIME, <= 25 MB and >= 64x64 before any processing.
3. Create responsive WebP derivatives. — PARTIAL: derivatives are capped at 1400 px on the longest edge and served as JPEG (or PNG when the result is a cutout). WebP is not used; the browser-side encoder does not target it.
4. Browser Canvas controls: crop, subject position, exposure, contrast, white balance, restrained sharpening. — DONE: `apps/web/src/media.ts` + `apps/web/src/MediaEditor.tsx`.
5. Optional ONNX background removal only after exact weight license, browser RAM, download size and performance are checked. Load only on explicit request; show progress/cancel. — DONE: MODNet (Apache-2.0, ~6 MB) and ormbg (Apache-2.0, ~42 MB) are offered with their licence and download size shown before the owner opts in. See `docs/MEDIA_PREPARATION.md`.
6. Compare before/after; owner approves. — DONE: the editor shows a live preview with a "hold to compare original" control, and nothing is uploaded until the owner confirms.
7. Approved cutout becomes CSS 2.5D asset with stable shadow, perspective and subtle parallax. — PARTIAL: the cutout is stored as a transparent PNG and composed with a stable shadow in the Ingredient Universe template; deliberate perspective/parallax on the cutout is not implemented.

## Moving object levels
Level 1: cutout + CSS 2.5D transforms/shadows/parallax (MVP).
Level 2: cautiously layered depth and subtle displacement with flat fallback.
Level 3: future image-to-3D. A single photo cannot reveal hidden sides; generated mesh is approximate/decorative, explicit approval only. Never replace factual dish image.
AI generation disabled in MVP because it can change dish identity, ingredients, toppings, shape and quantity. Future generated art must be separate background/campaign material with real dish foreground locked.

## Safety, privacy and quotas
AI never certifies ingredients, allergens, nutrition, dietary suitability, prices or availability. Owner-provided facts authoritative. Do not send private customer photos to third-party model unless disclosed and approved. Model IDs allowlisted server-side. Input/output Zod schemas, timeout, rate limits, max sizes, audit trail and owner approval. On quota/429/timeout show “AI temporarily unavailable; continue manually.” Never ask for card or auto-upgrade.

## Art direction layer (implemented)

A measured image is not yet a placed image. After background removal or
cropping, the browser pipeline measures the stored file and the templates
place it from that evidence instead of guessing.

**Cutout normalisation.** The bug this fixes: a segmentation model returns
the input canvas, so the subject stays small and off-centre inside the
original rectangle. `normaliseCutout()` (`apps/web/src/media-intelligence.ts`)
now trims to the alpha bounds, rescales the subject to a consistent 90% fill,
re-centres optically (alpha centroid, not bounding-box centre, so a handle or
straw does not pull the dish off-axis), feathers the edge, and pads to a known
frame (square by default). The owner's aspect crop is deliberately ignored for
cutouts: a normalised subject cannot keep a rectangle's empty margin, and
`object-fit: contain` in a transparent frame is what stops a cutout sitting
inside a visible white box. An opaque matte (model failed, or returned a
fully opaque mask) is detected and falls back to the photograph path, so an
unmasked rectangle is never stored as a cutout.

**Measured metadata.** Every stored photo records `photo_meta`:
`{ v, focusX, focusY, ratio, meanLuma, contrast, coverage, treatment,
dominant, subject? }`. The API validates the shape and ranges
(`photoMetaSchema`) and persists it in `menu_items.photo_meta_json`; it is
returned in the owner tree and copied into the immutable snapshot, so the
public menu reads exactly the measurements the owner approved. Invalid values
are rejected with 400 rather than corrupting a layout.

**How templates consume it.**

- Focal crop: `object-position` comes from `focusX/focusY`, never a blind
  centre crop.
- Scrim strength: `meanLuma` and `contrast` choose a light, mid or strong
  band under type over photography; a dark photo gets almost nothing, a white
  plate on a white table gets a taller, denser band.
- Hero selection: the strongest photograph leads the page
  (`pickHero`), rather than menu order.
- Split ratios: editorial hero and signature layouts size their media column
  from the frame ratio.
- Treatment: `contain` for cutouts, `cover` for photographs; the CSS and the
  metadata agree.

Legacy cutouts stored before normalisation can be repaired in place with
`apps/web/scripts/normalise-stored-cutouts.mjs` (downloads the asset, runs the
same normaliser in Chromium, PATCHes the result).

**Generated art when there is no photograph.** A missing photo becomes a
deterministic SVG plate study (`apps/web/src/design/generated.tsx`): seeded
from the item id, tinted from the restaurant palette, drawn on a transparent
ground with `preserveAspectRatio="xMidYMid meet"` so it fits any slot without
cropping or a visible card. No model, no paid API, no image asset. It is
decorative artwork, not a claim about the dish.

**Honest limits.** Focal points are measured, not semantic: the pipeline
finds where detail and contrast sit, not what the subject is. A photograph of
a plate on a busy table can still place its focal point on the tablecloth.
Owner override stays possible (the media editor's framing controls and the
stored `focusX/focusY`).
