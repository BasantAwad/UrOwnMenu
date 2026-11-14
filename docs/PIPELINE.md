# Visual pipeline: agents that understand a dish, make its imagery, and place it

Status: built and tested end to end in dry-run mode (no network, no model
calls). Real model use is blocked on licence verification and endpoints; see
section 8 for exactly what is done and what is not.

## What you asked for, and the answer to each part

| You asked for | How this pipeline does it |
|---|---|
| Analyse the items and their ingredients | Analyst agent reads the owner's text (and photo, if any) and writes an `ItemAnalysis`. It may only use ingredients the owner listed. |
| Generate or find realistic artefacts like the attached images | Asset Scout tries the owner's own photos, then licensed open-image sources, then generation with an open model, in that order. Every candidate passes the same gate. |
| Precise and correct | The quality gate (`src/pipeline/gate.ts`) rejects cutouts that are too small, fill the frame, have a dirty matte or are soft. The Critic agent checks the composed result against the brief, and the planner refuses to overlap. |
| Know where to place them and how | Composer agent chooses the layers; `src/pipeline/planner.ts` places them: hero beside the copy zone, splash behind, accents in a loose cloud, size and blur by depth. |
| Layer and put everything together | Layers are sorted by depth and rendered back to front with depth-driven blur and parallax. The planner reports anything it could not place rather than hiding it. |
| Video that scrubs with scroll | Motion Director makes or sources a short clip; `scripts/make-scrub-video.sh` prepares it; `src/ScrollScrub.tsx` maps scroll position to `currentTime`, so scrolling down plays forward and scrolling up rewinds. |
| Not copy-paste templates | Templates come out of the planner's output and the Designer's brief, per dish. No fixed template is filled in. |

## The honest limits (read these)

- **No real model has been run while building this.** The environment had no
  network access and no API keys, so every test runs in dry-run mode with
  deterministic fixtures and procedural cutouts. The agents, validation,
  caching, retries, manifest and post-processing are real and tested; the
  endpoints are configured by environment variables
  (`PIPELINE_LLM_URL`, `PIPELINE_GEN_URL`, `PIPELINE_MATTE_URL`,
  `PIPELINE_VIDEO_URL`) and have not been exercised. A real run also needs a
  host with network access and, for generation, a GPU or a free hosted tier.
- **The attached images are someone else's stock.** Several look like
  watermarked or licensed stock photos. The pipeline must not scrape them, and
  they must not be committed to the repo unless you hold a licence that allows
  it. The Asset Scout only accepts sources it can attribute and license.
- **Licences change.** Model licences differ between "open weights" and "free to
  use commercially". Check the model card before shipping. Some popular models
  are non-commercial. Section 6 lists what to check; I could not verify current
  terms from here.
- **Realism is judged, not guaranteed.** A generated splash can look plausible
  and still be wrong (wrong number of strawberries, a fork in the splash). The
  Critic reduces these, a human approves them.

## 1. Pipeline at a glance

```
owner item (name, description, ingredients, optional photo)
   |
   v
[1 Analyst]      -> ItemAnalysis     (hero, ingredients, mood, palette)
   |
   v
[2 Art Director] -> AssetBrief[]     (what each layer is: hero, splash, accents; count; mood)
   |
   v
[3 Asset Scout]  -> candidate files  (owner photo -> licensed open source -> generate)
   |
   v
[4 Matter]       -> transparent cutouts (background removal, edge clean-up)
   |
   v
[5 Gate]         -> AssetMeta + GateResult (deterministic; src/pipeline/gate.ts)
   |        fail -> back to [3] with the reasons
   v
[6 Composer]     -> LayerPlan        (deterministic placement; src/pipeline/planner.ts)
   |
   v
[7 Critic]       -> verdict + fixes  (vision model + checklist, section 7)
   |        fail -> back to [6] or [3]
   v
[8 Motion Director] -> scroll clip   (optional; section 5)
   |
   v
[9 Verifier]     -> screenshots at 390/820/1440 + numeric checks
```

Each arrow is a file on disk, so a stage can be rerun or replaced without
rerunning the others.

## 2. Agent roles

Each role is a prompt plus tools plus a contract. Keep the prompt short; the
contract and the rules do the work.

### 2.1 Analyst
- **Reads:** owner item text, optional photo.
- **Writes:** `ItemAnalysis` (`src/pipeline/contracts.ts`).
- **Rules:** ingredients come only from the owner's list. If the list is empty,
  `ingredients` is `[]` and no accents are planned. `hero` is one noun phrase.
  `mood` is one of the six allowed values.
- **Tools:** a small text model; pixel analysis of the photo when present
  (palette from `media-intelligence.ts`).

### 2.2 Art Director
- **Reads:** `ItemAnalysis`, the venue's palette and tone.
- **Writes:** `AssetBrief[]`: for each layer, its `kind` (hero, splash, accent),
  what it shows, what it must not show, and how many accents (0 to 8).
- **Rules:**
  - Accents are the owner's listed ingredients, one each, at most 8.
  - The hero is the dish. The splash is a liquid, powder or ground texture that
    matches the hero's colour, never a second dish.
  - Write the negative prompt too: "no text, no logo, no hands, no second plate,
    no packaging".
  - Describe lighting once: "soft key from upper left, no hard shadow on
    background". Every asset in one dish uses the same sentence.

### 2.3 Asset Scout
Tries sources in this order and stops at the first that passes the gate:

1. **Owner photo** (always first). Cutout with the Matter agent.
2. **Licensed open image source**: Openverse (CC0, public domain, CC-BY,
   CC-BY-SA) or Wikimedia Commons with `extmetadata`. Prefer transparent PNGs.
   Store the creator and licence with the file (see `docs/AI_BUILDER_PLAYBOOK.md`
   section 3).
3. **Generation** with an open text-to-image model. Prompt template:

   ```
   isolated {ingredient}, floating mid-air, product photography, soft key light
   from upper left, sharp focus, no background, white seamless backdrop,
   no text, no hands, no other objects
   ```

   Generate 4 candidates, keep the best by gate score, never the first.
4. Stop after 3 failed rounds and report the item as "no asset"; the layout then
   runs without that accent.

Reuse what worked: cache by `(ingredient, brief hash)` so a rerun is free.

### 2.4 Matter
- Background removal with an open segmentation model. Use a model whose licence
  allows your use (see section 6).
- Then `cleanAlphaEdge` (remove the light halo) and `normaliseCutout` (trim,
  centre, square pad), both in `apps/web/src`.
- Output: RGBA PNG plus `AssetMeta` from `measureAlpha` (`gate.ts`).

### 2.5 Gate (deterministic, no model)
- `gateAsset(meta)` returns `{ ok, reasons }`. Reasons are the Critic's
  vocabulary: `too-small`, `no-cutout`, `fills-frame`, `dirty-edge`,
  `soft-focus`, `nothing-visible`.
- Intentional motion blur (the falling-leaves look) is allowed for accents with
  `intentionalBlur: true`. Set it from the Art Director's brief, not by guessing.

### 2.6 Composer (deterministic)
- `planLayers(assets, stage, seed)` returns a `LayerPlan`. The same seed always
  gives the same arrangement. Use a hash of the item name as the seed.
- **Composition rules it enforces** (see the file header):
  - Hero beside the copy zone, on the side away from the text.
  - Splash at the back, larger than the stage, slightly rotated.
  - Accents in a loose cloud around the hero. Never a grid, never a ring.
  - Depth per accent: near = larger, defocused, faster parallax; far = smaller,
    sharp, slower. Size follows depth, so a crowd shrinks uniformly.
  - Nothing overlaps the copy zone.
  - Anything that does not fit is reported in `dropped`, not silently removed.
- The attached falling-leaves and tomato-and-basil images show exactly this
  arrangement: a few large blurred objects at the edge (near), several sharp
  mid-size ones (mid), and small far ones. The planner produces that spread.

### 2.7 Critic
- **Reads:** the composed frame (screenshot), the brief, the `LayerPlan`.
- **Writes:** `verdict: pass | fix | regenerate` and a list of `{ layerId, problem, fix }`.
- **Checklist** (each one is a yes/no question the Critic must answer):
  1. Does every layer read as the owner's ingredient, not a different food?
  2. Is there exactly one light direction across all layers and shadows?
  3. Is any cutout showing a rectangular shadow or a halo?
  4. Does the copy stay readable over every frame?
  5. Is the hero the largest sharp thing on the page?
  6. Are accent sizes consistent with their depth?
  7. Is any element clipped by the viewport or by another layer's edge?
- A "regenerate" verdict sends that one asset back to the Asset Scout with the
  problem text. A "fix" changes only the layer (position, scale, blur).
- Use the vision model with the checklist, not a free-form "does this look
  good?" The free-form question returns "yes" to almost anything.

### 2.8 Motion Director
- Decides whether a dish needs motion (usually the homepage hero only, not every
  item). Produces the clip in section 5.

### 2.9 Verifier (no model)
- Harness screenshots at 390, 820 and 1440; no horizontal overflow; no console
  errors; the numeric checks in `AI_BUILDER_PLAYBOOK.md` section 7.

## 3. Decision rules (the "how to place" knowledge, in one place)

These are the rules an agent must follow when it chooses. The planner enforces
the geometric ones; the Art Director and Critic apply the rest.

| Decision | Rule |
|---|---|
| How many accents | As many owner ingredients as fit at the minimum size. Cap at 8 on mobile, 12 on desktop. |
| Where the hero goes | The side opposite the copy. Overlapping the copy is a defect. |
| What is in front | The nearest accent, then the hero, then the splash. Overlap is how depth reads. |
| How big | Hero about a third of the stage width. Accents 0.15 to 0.35 of width, by depth. |
| How blurred | Only the nearest accents, up to 16px. Never blur the hero. Blur on a sharp photo is an error, unless it is stock motion blur you deliberately want. |
| Shadows | One light direction. Cutouts use `filter: drop-shadow`, never `box-shadow`. |
| Rotation | Accents up to ±25 degrees; the hero up to ±4. More than that reads as a mistake. |
| Colour | Warm light for food. Unify exposure across all layers with the same `autoEnhance` strength (`src/enhance.ts`). |
| Count vs fit | If accents do not fit at full size, shrink them together. If they still do not fit, drop the least important one and report it. |

## 4. Quality bar (what "precise and correct" means here)

A layer passes only if all of these hold, and each one is checked by code, not
by a model:

- Short edge at least 400px for an accent, 800px for the hero.
- Not touching the image edge (unless it is a splash, which may bleed).
- Alpha coverage between 1% and 60% for an accent (above 92% means no cutout was made).
- Sharpness above 0.15, unless the brief allows intentional blur.
- Within the copy-zone rules of the planner.

Then the Critic answers the seven questions above. Both must pass.

## 5. Scroll video (the "scrub" effect)

**The effect:** a short clip is pinned while the page scrolls. Scrolling down
moves the clip forward; scrolling up rewinds it. The clip is tied to scroll
position, so it cannot drift from the reader's hand.

**Build it:**
1. Source or generate a clip, 4 to 10 seconds, of the dish being assembled or
   floating (the same look as the layers, so the video and the static layers
   agree). Use one camera move.
2. `scripts/make-scrub-video.sh input.mp4 public/menu/hero-scrub.mp4 1080`
   converts it so every frame is a keyframe (instant seeks) and the file starts
   without a full download.
3. Use `<ScrollScrub src="/menu/hero-scrub.mp4" height="300vh">` with the copy
   as its children.

**Why it works and where it breaks:**
- Seeking a normal H.264 file with long GOPs is slow; that is why the script
  makes every frame a keyframe. The cost is file size: the 8-second 720p test
  clip is 5.4MB because it is busy test content. Real footage at 1080p is
  usually 10 to 25MB at this setting. Use a lower CRF, a shorter clip, or
  every 2nd frame as a keyframe (`-g 2`) if the size is too big.
- Reverse playback is a scrub, not a playback. It is smooth on desktop and
  current Android. On older iOS it may stutter for the first second after load;
  the component primes the decoder to reduce this.
- Respect `prefers-reduced-motion`: the component shows the poster and does
  not scrub.
- Never pin more than one scrub section per screen. Two at once fight for
  seeks.

**Verified:** `scripts/verify-scrub.mjs` runs in a real browser: scroll to 25%,
50%, 75%, back to 50%. Result: the video time goes 2.0s, 4.0s, 6.0s, then
returns to 4.0s (the same frame for the same scroll position). Run with the dev
server up.

## 6. Tools (free or open) and what to check

Verify each licence on its model card before shipping. I could not check
current terms from this sandbox.

| Stage | Option | Notes to check |
|---|---|---|
| Analyst, Art Director, Critic | A small open instruction model; a vision model for the Critic (for example a 7B-class Qwen2.5-VL) | Licence varies by size. Confirm commercial use. |
| Generation | FLUX.1-schnell or SDXL-class open models | Some variants (FLUX.1-dev) are non-commercial. Schnell and SDXL-class licences differ; read them. |
| Matting | BiRefNet | Check licence. Some popular matting models (for example RMBG-2.0) are non-commercial. |
| Sourcing | Openverse API; Wikimedia Commons API | Filter by licence; store creator and licence. |
| Video (optional) | Wan 2.1 or LTX-Video class open models | Check licence and hardware needs. Generation needs a GPU. |
| Scrub prep | ffmpeg (already installed here) | Free. |

If you do not have a GPU, run generation on a free hosted inference tier and
keep the rest local. Cache every output by its prompt hash so you never pay
twice for the same asset.

## 7. Evaluation (how you know the pipeline is getting better)

- Keep a fixed set of 10 owner items, including the hard ones: a long name, one
  ingredient, no ingredients, a photo with a bright background.
- Run the pipeline on the set after every change. Record: how many layers were
  placed vs dropped, gate failures by reason, Critic verdicts.
- A change is an improvement only when the placed count holds or rises and the
  gate failures and Critic "regenerate" count fall. Judge the images by eye too;
  the numbers are a guard, not a judge of taste.

## 8. What is built, and what is not

Built and tested on this branch:
- `apps/web/src/pipeline/`: `contracts.ts`, `rules.ts` (every threshold and
  word list), `hash.ts`, `gate.ts`, `planner.ts`, `schemas.ts` (model-output
  validators), `cache.ts` (cache-key payloads), `LayerStage.tsx` and
  `layer-stage.css` (the renderer from build spec section 11).
- `apps/web/pipeline-runner/`: the orchestrator (`run-item.ts`), all seven
  agents (Analyst, Art Director, Scout, Matter, Generator, Critic, Motion),
  the licence gate (`models.ts` + `models.json`), the file cache and manifest
  writer, pure-RGBA imaging (normalise, edge clean, stage composite), and
  deterministic dry-run fixtures.
- `apps/web/scripts/run-pipeline.mjs`: CLI. Dry run by default with
  `--dry-run` or `PIPELINE_DRY_RUN=1`; writes `pipeline-out/<item>/`.
- Tests, all passing in dry-run with no network:
  `verify-pipeline.mjs` (19 checks), `verify-analyst.mjs` (12),
  `verify-critic.mjs` (6), `verify-run-item.mjs` (11: use cases 4.1–4.8,
  idempotency, licence refusal, fix bounds, 12-call budget, per-attempt
  provenance sidecars, real MP4 clip).
- `apps/web/harness/layer-stage.html`: renders real pipeline output for the
  visual check (build spec 10.4) at 390, 820 and 1440.
- `apps/web/src/ScrollScrub.tsx` and `scrub.css`: scroll-scrubbed video
  component; `scripts/make-scrub-video.sh` prepares the clip.
- `apps/web/scripts/verify-scrub.mjs`: browser check (needs the dev server).

Not run yet, because it needs verified model licences and endpoints:
- Every entry in `pipeline-runner/models.json` is `licence: "unverified"`,
  `commercialOk: false`, `checkedOn: null`. The runner refuses a real
  (non-dry) call until the owner reads each model card and fills those fields.
- Consequently the real Cairo Coffee House run in the definition of done
  (build spec section 14) is still outstanding, as is any cost figure.

Next step: verify the licences, set the endpoint env vars
(`PIPELINE_LLM_URL`, `PIPELINE_GEN_URL`, `PIPELINE_MATTE_URL`,
`PIPELINE_VIDEO_URL`), then run **one** Cairo item for real, check the
manifest's events and spend, and only then the rest. Score with section 7
before tuning any prompt.
