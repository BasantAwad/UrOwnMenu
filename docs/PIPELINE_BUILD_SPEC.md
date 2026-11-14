# Pipeline build spec

This document tells another AI, or a developer, exactly what to build: which
agents exist, what each one is allowed to decide, the JSON each one reads and
writes, how they are wired, and worked examples to test against. It is written
to remove judgment calls. Where a decision is needed, the decision is already
made here. If something is not covered, the builder must stop and ask rather
than guess (section 13).

Read `docs/PIPELINE.md` first for the overview and the reasons. This file is the
build contract.

---

## 0. Non-negotiable rules

These override everything else in this document and every prompt in it.

1. **Owner data is the only source of facts.** Dish names, descriptions, prices
   and ingredient lists come from the owner's menu item. An agent may never
   add an ingredient, a claim, a price, an allergen, or a review.
2. **Decisions belong in code wherever code can make them.** Placement, sizes,
   blur, parallax, quality thresholds, retry counts, and file naming are fixed
   in code (sections 6 and 9). Language models make only the decisions listed
   for them in section 3, and their output is validated against a schema before
   use.
3. **Every model output is validated.** Parse as JSON, validate against the
   schema in this document, and on failure retry once with the validation error
   in the prompt. A second failure marks the stage failed; it never passes
   unvalidated text downstream.
4. **Every generated or sourced image is licence-recorded or it is rejected.**
   An asset without a recorded licence and creator is not stored and not used.
   "Unknown" means rejected.
5. **No third-party image is hotlinked in the output.** Every asset used by the
   menu is copied into the owner's own storage (R2, or `public/` for local
   builds) and served from there.
6. **No asset is shown that failed the gate.** The gate result is stored with
   the asset, and the renderer reads only assets whose gate result is `ok: true`.
7. **The pipeline never publishes.** It writes files and a manifest. A human (or
   the existing publish flow) decides what goes live.
8. **Stop conditions are explicit** (section 13). When one is hit, halt the
   item, write the reason, and do not continue to later stages.

---

## 1. Scope of version 1

Version 1 takes one menu item and produces:

- `analysis.json`: what the dish is and which ingredients it has.
- `assets/`: transparent PNG cutouts for each layer, each with a sidecar
  `*.meta.json` (licence, creator, source, gate result).
- `layers.json`: the layer plan for a stated stage (desktop and mobile).
- `manifest.json`: every step, every decision, every failure, with timestamps
  and cache keys.
- Optional: `scrub.mp4` for the homepage hero only (section 4.9).

Version 1 does **not** do: editing the owner's menu data, publishing, pricing,
translation, or rendering the final page (rendering uses the existing templates
plus a `LayerStage` component, specified in section 11).

---

## 2. Repository layout to create

All new code lives under `apps/web/src/pipeline/` (pure TypeScript, no DOM) and
`apps/web/pipeline-runner/` (Node, runs the agents). Do not put runner code in
`src/`.

```
apps/web/
  src/pipeline/
    contracts.ts        EXISTS  types for every stage (read it first)
    gate.ts             EXISTS  gateAsset(), measureAlpha()
    planner.ts          EXISTS  planLayers(), rng(), realDistance()
    hash.ts             NEW     fnv1a32(string) -> number   (section 9.1)
    cache.ts            NEW     cacheKey(...), readCache, writeCache  (section 9.3)
    schemas.ts          NEW     JSON schemas + validators for every LLM output (section 3)
    rules.ts            NEW     every numeric threshold in one object (section 6)
  pipeline-runner/
    run-item.ts         NEW     orchestrator: runs one item through the stages
    agents/
      analyst.ts        NEW     LLM agent (section 3.1)
      art-director.ts   NEW     LLM agent (section 3.2)
      scout.ts          NEW     deterministic search + query text (section 3.3)
      generator.ts      NEW     image-generation model call (section 3.4)
      matter.ts         NEW     background-removal model call + post (section 3.5)
      critic.ts         NEW     vision LLM agent (section 3.7)
      motion.ts         NEW     motion decision + clip prompt (section 3.8)
    llm.ts              NEW     one function: callJsonModel(prompt, schema) with retry
    models.ts           NEW     model IDs from env, licence allow-list (section 8)
    store.ts            NEW     reads/writes the artifact folder + manifest
  scripts/
    verify-pipeline.mjs EXISTS  deterministic checks (must keep passing)
    run-pipeline.mjs    NEW     CLI: node scripts/run-pipeline.mjs <item-file> [--stage X]
```

Node version: 22 (the repo already uses `--experimental-strip-types` for
`scripts/`; keep the runner under that, with `import type` for types and `.ts`
extensions in relative imports). If the runner needs packages, add them under
`apps/web` only, and pin exact versions.

---

## 3. Agent catalogue

Ten roles. Three are **code only** (no model), four are **model-driven** with
a schema, and three are **model calls wrapped in code** (the code validates and
stores the output). The "Decides" column is the complete list of decisions the
agent is allowed to make. Anything not listed is decided by code or forbidden.

| # | Agent | Kind | Decides | Never decides |
|---|---|---|---|---|
| 3.1 | Analyst | LLM, JSON | hero noun phrase; mood word; which owner ingredients become accents | ingredients not in the owner list; prices; claims |
| 3.2 | Art Director | LLM, JSON | per-layer visual description and negative prompt | number of layers and whether a splash exists (code, section 3.2 rule 3); placement |
| 3.3 | Scout | code + query text | which sources to try, in order; search terms | which result is used (gate decides) |
| 3.4 | Generator | model call | nothing; it renders the prompt | content of the prompt (Art Director wrote it) |
| 3.5 | Matter | model call + code | nothing; removes the background | — |
| 3.6 | Gate | code | pass/fail per asset | — |
| 3.7 | Critic | vision LLM, JSON | pass / fix / regenerate, and which layer | new layers; facts about the food |
| 3.8 | Motion | LLM, JSON + model call | whether a scrub clip is made; clip prompt | item content |
| 3.9 | Composer | code | every placement, size, depth, blur, parallax, z | — (deterministic) |
| 3.10 | Orchestrator | code | stage order, retries, stop conditions, caching | — |

### 3.1 Analyst (LLM, JSON)

**Input** (`AnalystInput`):

```json
{
  "item": {
    "id": "item_0142",
    "name": "Strawberry Yogurt Bowl",
    "description": "Greek yogurt, fresh strawberries, granola",
    "ingredients": ["Greek yogurt", "strawberries", "granola"],
    "photoPath": "owner/item_0142.jpg"
  },
  "venue": { "name": "Cairo Coffee House", "tone": "warm, neighbourhood" },
  "photoStats": { "palette": ["#e8a7a0", "#f5f0e8", "#7a1f2b"] }
}
```

`photoStats` is `null` when there is no photo. `palette` comes from
`media-intelligence.ts`, not from the model.

**Output** (`ItemAnalysis`, from `contracts.ts`), validated by `schemas.ts`:

```json
{
  "item": "Strawberry Yogurt Bowl",
  "hero": "strawberry yogurt",
  "ingredients": ["strawberries", "Greek yogurt", "granola"],
  "mood": "fresh",
  "palette": ["#e8a7a0", "#f5f0e8", "#7a1f2b"]
}
```

**Rules the prompt must state (exact text in 3.1.1):**
- `ingredients` must be a subset of the input list, matched by case-insensitive
  name. Output names exactly as the input spelled them.
- `hero` is at most four words, lowercase, a noun phrase built from the item name
  and ingredients. No adjectives of quality ("delicious", "best").
- `mood` is exactly one of: `fresh`, `rich`, `crisp`, `playful`, `elegant`, `warm`.
  Pick by the dish type rule in 3.1.2.
- `palette` is copied from input, never invented.

**3.1.1 Prompt (send verbatim):**

```
You analyse one menu item for a restaurant website. You output JSON only.

Facts you may use: the item name, description, ingredient list and palette given
below. You must not add any ingredient, claim, price, origin, health statement or
description that is not in the input.

Rules:
1. "ingredients" in your output must be a subset of the input ingredient list.
   Keep the input spelling. Drop nothing you can see is in the list; drop only
   items that are not in the list (you should never need to).
2. "hero" is a noun phrase of at most four words, lowercase, describing what the
   dish is made of, taken from the name or ingredients. No quality adjectives.
3. "mood" must be one of: fresh, rich, crisp, playful, elegant, warm.
   - fresh: salads, fruit, juice, light bowls
   - rich: chocolate, cheese, cream desserts, burgers
   - crisp: fried or baked items with crust, chips, pastry
   - playful: kids items, pancakes, donuts
   - elegant: plated desserts, fine items
   - warm: soups, coffee, tea, stews
4. "palette" must be copied exactly from the input. Do not change it.
5. Output one JSON object with keys: item, hero, ingredients, mood, palette.
   No prose. No markdown fences.

Input:
{INPUT_JSON}
```

**3.1.2** The mood table above is the rule. If the dish fits two moods, use the
first one listed in the table order above.

**Failure modes:** output contains an ingredient not in the input → validation
fails → retry once with the message "ingredient X is not in the input list" →
second failure: `analysis` stage fails, item halts with reason `analyst-invalid`.

**Test cases the builder must add (`scripts/verify-analyst.mjs`, mocked model):**
- Input with 3 ingredients; mock returns 4 (one invented) → rejected.
- Input with empty ingredient list → output ingredients must be `[]`.
- Mood value outside the enum → rejected.

### 3.2 Art Director (LLM, JSON)

**Input** (`ArtDirectorInput`):

```json
{
  "analysis": { "...ItemAnalysis..." },
  "hasOwnerHeroCutout": false,
  "stageAspects": [1.6, 0.5625],
  "maxAccents": 6,
  "brandPalette": ["#0d0c0a", "#efe9dd", "#d2a965"]
}
```

`maxAccents` is set by code (section 6): 6 for desktop, 4 for mobile. The model
may choose fewer, never more.

**Output** (`ArtBrief`):

```json
{
  "layers": [
    {
      "kind": "hero",
      "assetLabel": "strawberry yogurt",
      "visual": "a single strawberry half and a spoonful of thick yogurt, sitting on a light wood surface, soft key light from upper left",
      "negative": "no text, no logo, no hands, no second bowl, no packaging",
      "intentionalBlur": false
    },
    {
      "kind": "splash",
      "assetLabel": "strawberry yogurt splash",
      "visual": "a frozen liquid splash of pale pink yogurt, mid-motion, crown shape, against plain white",
      "negative": "no fruit, no text, no spoon, no bowl",
      "intentionalBlur": false
    },
    {
      "kind": "accent",
      "assetLabel": "strawberries",
      "visual": "a single whole strawberry floating mid-air, slight tilt, sharp focus",
      "negative": "no leaves cut off, no text, no other fruit",
      "intentionalBlur": false
    }
  ],
  "lightSentence": "soft key light from upper left, no hard shadow on background"
}
```

**Rules:**
- `layers[]` contains at most one `hero`, at most one `splash`, and accents with
  `kind: "accent"`. Accents map 1:1 to `analysis.ingredients`, in the same order,
  and at most `maxAccents` of them. Code rejects extra.
- `lightSentence` is the same string for every layer of the item. The Art
  Director writes it once; code copies it into every generation prompt.
- A `splash` is requested only when code says the item is liquid-based. Code
  decides this with the word list `RULES.liquidWords` (section 6) matched against
  the item name and hero. The Art Director's own choice is overridden by that
  result and logged when it disagrees: a splash it proposed for a dry item is
  dropped, and a liquid item it left without a splash gets one added by code,
  using the Generator prompt template (3.4) with the visual "a frozen liquid
  splash of the item's main liquid, against plain white".
- `intentionalBlur: true` only for accents where the brief says "falling",
  "motion", or "blurred". Default false.
- The `visual` string describes only what is in `analysis`. It must not
  introduce a food that is not an ingredient or the hero.

**3.2.1 Prompt (verbatim):**

```
You write visual briefs for food photography cutouts used in a menu website.
You output JSON only.

You are given an analysis of one menu item. Write one layer brief per layer:
- one "hero" (if hasOwnerHeroCutout is false),
- one "splash" only if the item is liquid-based (yogurt, milk, juice, sauce,
  smoothie, soup, coffee, tea, syrup),
- one "accent" per ingredient in analysis.ingredients, in the same order, up to
  maxAccents accents in total.

For each layer give: kind, assetLabel, visual, negative, intentionalBlur.
- visual: one sentence, under 30 words, describing only the food shown. Do not
  mention any food that is not in the analysis.
- negative: always include "no text, no logo, no hands". Add "no packaging".
- intentionalBlur: true only if the ingredient is naturally shown falling or in
  motion; otherwise false.

Also give one lightSentence used for all layers. Use exactly this lightSentence
unless the palette clearly needs a warm one: "soft key light from upper left, no
hard shadow on background".

Do not invent ingredients, prices, or claims.

Input:
{INPUT_JSON}
```

**Failure modes:** more accents than `maxAccents` → code truncates to the first
N and writes a manifest warning (this is the one allowed silent-but-logged
trim). An accent whose `assetLabel` does not match an ingredient → validation
fails.

**Test cases:** 3 ingredients, `maxAccents` 2 → 2 accents, warning logged.
Dry item (`description: "chocolate chip cookie"`) → no splash layer.

### 3.3 Scout (code + query text)

The Scout does not decide quality. It produces an ordered list of **sources** to
try for each layer, and runs them.

**Source order, fixed (do not change without updating this spec):**

| Order | Source | Used for | Condition |
|---|---|---|---|
| 1 | `owner-photo` | hero, accents if the owner uploaded a cutout | the owner's file exists |
| 2 | `openverse` | accents, hero | always tried if step 1 gave nothing |
| 3 | `wikimedia` | accents | Openverse gave nothing passing the gate |
| 4 | `generate` | any layer | all above failed the gate |

For `splash`, skip steps 2 and 3 (no licensed splash library is reliable); go
straight to `generate`. Owner photo is not used for splash.

**Search query text (deterministic, no model):**

- Openverse: `q = "{assetLabel} isolated"`, `license=cc0,pdm,by,by-sa`,
  `page_size=20`, `mature=false`. Use the existing resolver logic in
  `apps/api/index.ts` (`searchOpenverse`), extended to return up to 20 results.
- Wikimedia: `titles=File:` search on `"{assetLabel}"` with
  `prop=imageinfo&iiprop=extmetadata|url|size`, limited to 20.
- Reject results whose title or tags contain any of: `logo`, `diagram`, `map`,
  `drawing`, `illustration`, `poster`, `packaging`, `text`, `vector`, `clipart`
  (case-insensitive). This list is a constant in `rules.ts`.

**Candidate ranking (deterministic, do not use a model):** For each candidate
that passes the reject list and has a file size and dimensions, score:

```
score = 0
score += 2 if format is PNG (transparent) else 0
score += 1 if width >= 1000 else 0
score += 1 if aspect ratio within 0.6..1.7 else 0
score += 1 if licence is cc0 or pdm else 0
```

Sort by score descending, ties by id ascending. Download the top 4 only. The
gate in section 3.6 decides which one is used.

**Generation step (3.4) is triggered when no candidate passes the gate.**

### 3.4 Generator (model call, code-wrapped)

**Purpose:** render an image for a layer when no sourced asset passes.

**Input:** the layer brief from 3.2 and the item's `lightSentence`.

**Prompt template (built in code, not by a model):**

```
{visual}, {lightSentence}, isolated on a plain white background, sharp focus,
studio product photography, realistic, {negative}
```

Example with the strawberry accent brief:

```
a single whole strawberry floating mid-air, slight tilt, sharp focus,
soft key light from upper left, no hard shadow on background, isolated on a
plain white background, sharp focus, studio product photography, realistic,
no text, no logo, no hands, no other objects
```

**Generation parameters (fixed):**
- Width 1024, height 1024 for accents and hero; 1024 x 768 for splash.
- Steps: 4 for schnell-class models; 28 for SDXL-class. Set per model in `models.ts`.
- Candidates: **4 per call**. Keep all 4 on disk; gate them all; use the best
  that passes. Never use the first one only.
- Seed: `fnv1a32(item.id + layer.kind + layer.assetLabel + round)`, so a rerun
  with the same inputs gives the same candidates.

**Budget:** at most 12 generation calls per item (3 rounds x 4 candidates).
Set `GENERATION_BUDGET_PER_ITEM` in `rules.ts`.

**Output:** up to 4 PNG files, each with a `*.gen.json` sidecar:

```json
{
  "source": "generate",
  "model": "<model id from models.ts>",
  "modelLicence": "<licence string from models.ts>",
  "prompt": "...",
  "seed": 1834920231,
  "createdAt": "2026-11-14T15:00:00Z"
}
```

Generated images have no creator other than the model. Record that; do not
attribute them to a person.

### 3.5 Matter (model call + code)

**Purpose:** remove the background from a candidate, producing an RGBA PNG.

**Steps, in this order, all required:**
1. Background removal model (`models.ts` entry `matting`) on the candidate.
   Output: a matte (alpha).
2. Clean the edge: remove the light halo. Use `cleanAlphaEdge` from
   `src/media.ts` if it is exported by the time you build; it is currently
   private, so either export it or copy the logic into `pipeline/matte-edge.ts`
   with a test. Do not skip this step.
3. `normaliseCutout(...)` from `src/media-intelligence.ts`: trims to content,
   centres, pads to square with transparent pixels.
4. `measureAlpha(data, width, height)` from `src/pipeline/gate.ts` to produce
   `AssetMeta` fields (`alphaCoverage`, `touchesEdge`, `sharpness`).

**Output:** `assets/<layerId>.png` and a sidecar `assets/<layerId>.meta.json`
containing `AssetMeta` plus source fields.

**Failure:** if the matting model returns an empty alpha (zero opaque pixels),
mark the candidate failed with reason `empty-matte`; do not send it to the gate.

### 3.6 Gate (code only)

`gateAsset(meta)` from `src/pipeline/gate.ts`. The thresholds are in
`rules.ts`, and `gate.ts` must read from there. The current hard-coded minimums
in `gate.ts` (`MIN_SHORT_EDGE`) and the thresholds in `gateAsset` must be moved
to `rules.ts` so there is one source of truth. Values:

| Rule | Value |
|---|---|
| min short edge: hero / splash / background | 800 / 700 / 800 px |
| min short edge: ingredient / accent | 400 / 300 px |
| nothing visible | alphaCoverage < 0.01 |
| no cutout | alphaCoverage > 0.92 (except background) |
| fills frame | alphaCoverage > 0.6 (except background) |
| dirty edge | touchesEdge, except background and splash |
| soft focus | sharpness < 0.15 for hero and ingredient, unless intentionalBlur |

**Gate output** is stored in the asset sidecar as `gate: { ok, reasons }`.

### 3.7 Critic (vision LLM, JSON)

**Input:** a PNG of the composed stage (rendered by the Verifier at 1440px wide),
the `ArtBrief`, and the `LayerPlan` as JSON.

**Output:**

```json
{
  "verdict": "fix",
  "findings": [
    {
      "layerId": "accent-2",
      "check": 3,
      "problem": "rectangular shadow visible under the strawberry",
      "action": "fix"
    }
  ]
}
```

`verdict` is one of `pass`, `fix`, `regenerate`.
`action` per finding is `fix` (change this layer's placement or blur only) or
`regenerate` (send this layer back to Scout/Generator).

**Checklist (the Critic must answer each, in this order):**
1. Does every layer read as its owner ingredient, not a different food?
2. Is there one light direction across all layers and shadows?
3. Is there a rectangular shadow or a halo around any cutout?
4. Is the copy readable over every frame (contrast at least 4.5:1)?
5. Is the hero the largest sharp object?
6. Are accent sizes consistent with depth (nearer = larger)?
7. Is any element clipped by the viewport or by a layer edge?

**Prompt (verbatim):**

```
You review one composed food image for a menu website. You output JSON only.

You see: the image, the layer brief (what each layer should be), and the layer
plan (where each layer is). Answer the checklist below for the whole image, one
answer per check, then give findings.

Checklist (answer each as true or false, with a one-line reason):
1. Does every layer read as the ingredient named in its brief, not a different food?
2. Is there one light direction across all layers and shadows?
3. Is there a rectangular shadow or a halo around any cutout?
4. Is the copy readable over every part of the frame?
5. Is the hero the largest sharp object?
6. Are accent sizes consistent with depth (nearer = larger)?
7. Is any element clipped by the viewport or by another layer's edge?

Verdict rules:
- "pass": all checks are true.
- "fix": one or more checks are false, and each can be fixed by moving, resizing,
  or blurring the layer. Use layerId from the plan.
- "regenerate": a check is false because the food itself is wrong (check 1), or
  a cutout has a visible defect (check 3) that moving will not fix.

Output: {"verdict": ..., "checks": [{"n": 1, "ok": true, "reason": "..."}, ...],
"findings": [{"layerId": ..., "check": n, "problem": ..., "action": "fix"|"regenerate"}]}

Input:
{INPUT_JSON}
```

**Loop limit:** the Critic may run at most 2 times per item (initial + one
re-check after fixes). If the second verdict is not `pass`, the item is marked
`needs-review` and its best-so-far layer plan is saved. Do not loop further.

### 3.8 Motion (LLM JSON + optional model call)

**Decides:** whether the item gets a scrub clip. Rule, decided in code, not by
the model: a clip is made **only** for the item the owner flags as
`homepageHero: true`. No other item gets a clip. The model only writes the clip
prompt when a clip is requested.

**Clip prompt output** (JSON from the model):

```json
{
  "clipPrompt": "a bowl of strawberry yogurt, layers of yogurt and strawberries separating and floating in slow motion, camera slowly orbiting, soft key light from upper left",
  "durationSeconds": 6,
  "endFrameDescription": "the fully assembled bowl, centred"
}
```

`durationSeconds` must be between 4 and 10. Out of range → validation fails.

**Model call:** an open text-to-video model from `models.ts` (entry `video`).
Output: an MP4.

**Post-processing (fixed command):**

```bash
apps/web/scripts/make-scrub-video.sh <raw.mp4> <out>/scrub.mp4 1080
```

Then `ScrollScrub` (in `src/ScrollScrub.tsx`) uses `scrub.mp4`.

### 3.9 Composer (code only)

`planLayers(assets, stage, seed)` from `src/pipeline/planner.ts`. The seed is
`fnv1a32(item.name)`. The stage list is fixed:

| Stage | aspect (w/h) | copyZone (normalised) |
|---|---|---|
| desktop | 1.6 | `{ x: 0.04, y: 0.2, w: 0.36, h: 0.6 }` |
| mobile | 0.5625 (9/16) | `{ x: 0.06, y: 0.56, w: 0.88, h: 0.36 }` |

**Mobile caveat:** `planner.ts` has been tested at aspect 1.6 only, and its
focal point assumes the copy is at the side (`copyOnLeft`). The mobile copy zone
is at the bottom, so the focal point must instead sit in the upper half. Before
using the mobile stage, change the planner so the focal point is chosen from the
copy zone's position (side or bottom), and add `verify-pipeline` checks for
aspect 0.5625: no accent centre in the copy zone, hero centre in the upper half,
and at least 3 of 4 accents placed. If those checks fail, fix the planner; do not
work around it in the caller.

The Composer's output is `LayerPlan` (`contracts.ts`), stored as `layers.json`
for each stage.

### 3.10 Orchestrator (code only)

Section 5 describes it in full.

---

## 4. Use cases (worked examples)

These are the examples the builder must reproduce as tests. Each lists the
input, the path through the pipeline, and what the output must look like. The
"Expected" lines name the files and statuses that must exist. They do not fix
exact layer counts: the builder runs each case, records the real counts in
`manifest.json`, and checks that the counts follow the rules (accents capped,
drops reported, no accent on the copy zone). Any number written into a test must
come from a run, not from this document.

### 4.1 Strawberry yogurt bowl (owner photo for the hero, generated splash)

**Input:**
```json
{ "id": "item_0142", "name": "Strawberry Yogurt Bowl",
  "description": "Greek yogurt, fresh strawberries, granola",
  "ingredients": ["Greek yogurt", "strawberries", "granola"],
  "photoPath": "owner/item_0142.jpg" }
```

**Path:**
1. Analyst → `hero: "strawberry yogurt"`, `mood: "fresh"`, `ingredients` = all 3.
2. Art Director → hero, splash (liquid), three accents (yogurt, strawberries,
   granola). Accent cap for desktop 6, so all 3 kept.
3. Scout:
   - hero: `owner-photo` exists. Matter it. Gate: passes if the owner's photo is
     at least 800px short edge and cuts out cleanly; if it fails, continue.
   - splash: go to `generate`. Four candidates generated.
   - accents: Openverse search. Suppose 2 of 3 pass the gate; "granola" fails the
     gate (`fills-frame`: a granola photo on white is dense). It is retried,
     then generated.
4. Gate: splash candidate 3 passes (short edge 1024, alpha 0.31, not touching
   edge). Accents pass.
5. Composer, seed `fnv1a32("Strawberry Yogurt Bowl")`, desktop stage, 4 layers
   placed (hero, splash, 3 accents if all fit). If one is dropped, it must
   appear in `layers.json.dropped` with a reason.
6. Critic: first verdict `fix`: "granola accent sits on the copy zone edge"
   (check 4, moving only). Composer re-run with that layer excluded from the
   copy zone margin: verdict `pass` on second check.

**Expected outputs:** `analysis.json` (hero, mood `fresh`); an asset with a
sidecar for each layer that passed (hero from `owner-photo` if the photo passed,
otherwise sourced or generated); `layers.desktop.json` where every layer either
appears or appears in `dropped`; `manifest.json` with every gate result and every
Critic run.

### 4.2 Fresh fries (hero from a sourced photo, accent is the same food)

**Input:** `{ "name": "Crispy Fries", "description": "Hand-cut potatoes,
fried twice, sea salt", "ingredients": ["potatoes", "sea salt", "vegetable oil"] }`

**Key decision:** for this dish, the hero and accents are all potato. The
Art Director must give the hero a distinct visual (a paper cone or a pile),
and accents as single fries. Check: if the Analyst's `hero` equals an
ingredient name, the Art Director must differentiate the hero by adding the
container or arrangement (for example "a pile of fries in a paper cone").

**Path:** Scout → Openverse "fries isolated". Set `intentionalBlur: true` on
accents only if the brief says falling.

**Expected:** a hero visibly different from the accents (container or pile), and
single-fry accents. The gate has no aspect-ratio rule; do not add one for thin
shapes.

### 4.3 Caesar salad (no splash, owner has no photo)

**Input:** `{ "name": "Caesar Salad", "description": "Romaine, parmesan, croutons, dressing", "ingredients": ["romaine", "parmesan", "croutons", "caesar dressing"] }`

**Path:** the liquid-word check (section 3.2 rule 3) looks at the name and hero
only. "Caesar Salad" and "romaine" contain no liquid word, so there is no
splash, even though "caesar dressing" is an ingredient. Analyst sets
`mood: "fresh"`. Layers: hero (romaine) and up to 4 accents, one per ingredient.

**Test:** the final brief must have no `splash` layer. Put this in
`verify-analyst.mjs` as a fixture.

### 4.4 Empty ingredient list (dish has no listed ingredients)

**Input:** `{ "name": "House Lemonade", "description": "", "ingredients": [] }`

**Path:** Analyst → `ingredients: []`. Art Director → hero (lemon, from the name
if it is in the name; otherwise the hero is "lemonade" and the brief must say
a glass of pale yellow liquid) and splash. **No accents.**

**Test:** the Composer produces 1 to 2 layers (splash, hero). Zero accents.

### 4.5 Owner photo passes the gate as the hero

**Input:** an owner-uploaded JPEG 1600 x 1200 with a plain background.

**Path:** the Matter step makes an RGBA cutout. The gate passes when the short
edge is at least 800, the cutout does not touch the edge, and coverage is between
0.01 and 0.92. Measured values are whatever the run produces. Scout stops; no
generation.

**Test:** `manifest.json` shows `hero.source: "owner-photo"` and no generation
calls for hero.

### 4.6 Falling-leaves accent set (deliberate motion blur)

**Input:** a green smoothie; ingredients `["spinach", "mint"]`; desktop stage.

**Path:** Art Director sets `intentionalBlur: true` for both accents because the
visual is "falling". Gate: soft focus is allowed for accents with
`intentionalBlur: true`. Composer: accents at depth above 0.75 get defocus up to
16px; those below stay sharp. The rendered result should match the attached
falling-leaves reference: a few large blurred near leaves at the edge, several
sharp mid-size ones.

**Test:** `gateAsset` with `sharpness: 0.05, intentionalBlur: true` returns `ok`
for accent kind (already in `verify-pipeline.mjs`). Add a layer-plan test: for
a seed, at least one accent with `blurPx > 0` exists when there are 4 or more
accents.

### 4.7 Missing everything (generation fails)

**Input:** `{ "name": "Mystery Tart", "description": "", "ingredients": ["figs"] }`

**Path:** hero: owner photo absent; Openverse returns 0 results that pass the
gate after 3 rounds of 4 generations (12 calls, budget exhausted). Hero is
`no asset`.

**Result:** item status `needs-assets`, reason `hero-unavailable`. The
pipeline does **not** place a different image as the hero. The owner is shown
the reason. Layers that did succeed are kept in `layers.json` with
`status: "partial"`.

**Test:** `run-item` returns status `needs-assets`; no `layers.json` hero entry.

### 4.8 Homepage hero with scrub clip

**Input:** an item with `homepageHero: true`.

**Path:** after the Critic passes, Motion runs. Clip prompt generated. Video
model produces MP4. `make-scrub-video.sh` converts it. Output `scrub.mp4`.

**Test:** `scrub.mp4` exists; `ScrollScrub` renders with `src` pointing to it;
`verify-scrub.mjs` passes against that file.

---

## 5. Orchestration (how the agents are wired)

### 5.1 State per item

```
REQUESTED
  -> ANALYSED                (Analyst valid)
  -> BRIEFED                 (Art Director valid)
  -> SOURCING                (Scout per layer)
       -> each layer: SOURCED-OK | GENERATING | NO-ASSET
  -> MATTED                  (Matter per candidate that passed download)
  -> GATED                   (Gate per candidate; pick best per layer)
  -> PLACED                  (Composer per stage: desktop, mobile)
  -> CRITIQUED               (Critic verdict)
       -> pass         -> MOTION (if homepageHero) -> DONE
       -> fix          -> PLACED (apply fixes; max 1 re-run)
       -> regenerate   -> SOURCING for that layer only (max 1 re-run)
  -> NEEDS-REVIEW            (any stop condition hit; saved with reason)
  -> FAILED                  (unrecoverable; saved with reason)
```

Each transition writes a line to `manifest.json` (section 7.2).

### 5.2 Orchestrator pseudo-code (build this, in `run-item.ts`)

```ts
async function runItem(item: OwnerItem, opts: RunOpts): Promise<ItemResult> {
  const manifest = newManifest(item)

  // Stage 1: Analyst (LLM with validation)
  const analysis = await withRetry(() => analyst.run({ item, venue: opts.venue }),
                                   { attempts: 2 })          // section 3.1
  if (!analysis.ok) return halt(manifest, 'analyst-invalid')
  store.write('analysis.json', analysis.value)

  // Stage 2: Art Director (LLM with validation, accent cap applied in code)
  const brief = await withRetry(() => artDirector.run({ analysis: analysis.value,
                                   maxAccents: rules.maxAccents.desktop }), { attempts: 2 })
  if (!brief.ok) return halt(manifest, 'art-director-invalid')
  const layers = applyAccentCap(brief.value, rules.maxAccents)  // logs a warning if trimmed

  // Stage 3–5: per layer, source -> matte -> gate
  const chosen = new Map<LayerId, ChosenAsset>()
  for (const layer of layers) {
    const pick = await sourceLayer(layer, item, manifest)      // section 5.3
    if (!pick) {
      manifest.note('no-asset', layer.id)
      if (layer.kind === 'hero') return halt(manifest, 'hero-unavailable', { partial: chosen })
      continue                                                  // accents and splash may be skipped
    }
    chosen.set(layer.id, pick)
  }

  // Stage 6: Composer, per stage
  const plans = {
    desktop: planLayers(metaOf(chosen), STAGES.desktop, fnv1a32(item.name)),
    mobile:  planLayers(metaOf(chosen), STAGES.mobile,  fnv1a32(item.name)),
  }
  store.write('layers.desktop.json', plans.desktop)
  store.write('layers.mobile.json',  plans.mobile)

  // Stage 7: Critic (vision LLM), max 2 runs
  let verdict = await critic.run({ png: await renderStage(plans.desktop), brief, plan: plans.desktop })
  if (verdict.value.verdict === 'fix') {
    plans.desktop = applyFixes(plans.desktop, verdict.value.findings)    // bounded, see below
    verdict = await critic.run({ ... })
  }
  if (verdict.value.verdict === 'regenerate') {
    // re-source only the flagged layers, once
    // ...
  }
  if (verdict.value.verdict !== 'pass') return needsReview(manifest, plans)

  // Stage 8: Motion (only homepageHero)
  if (item.homepageHero) await motion.run({ analysis, brief, outDir })

  return done(manifest)
}
```

Rules:
- `withRetry(fn, {attempts})` retries only on validation failure or a
  transient network error (HTTP 429, 500, 503, timeout). It does not retry on
  a schema mismatch after the retry prompt has been sent once.
- `halt` and `needsReview` both write `manifest.json` before returning.
- No stage reads a file that a later stage writes.

### 5.3 `sourceLayer(layer, item, manifest)`

```
for source in layer.sources (fixed order from section 3.3):
  candidates = source.search(layer.assetLabel)           // up to 20
  ranked = rank(candidates)                              // section 3.3 score
  for c in ranked.slice(0, 4):
    file = download(c)                                   // store raw under cache
    png  = matte(file)                                   // section 3.5
    meta = measureAlpha(png) + sourceFields(c)
    g    = gateAsset(meta)
    record(manifest, layer, c, g)
    if g.ok: return { png, meta, source }
if layer.kind == 'splash' or source budget left:
  for round in 1..3:                                     // up to 3 rounds
    for seed in [s1, s2, s3, s4]:                        // 4 candidates per round
      png = generate(layer, seed)                        // section 3.4
      png = matte(png)
      meta = ...
      if gateAsset(meta).ok: return {...}
return null
```

Budget: the total count of generation calls per item is capped at
`GENERATION_BUDGET_PER_ITEM` (12). Calls beyond the cap return `null`
immediately.

### 5.4 Data flowing between stages

| From | To | Via |
|---|---|---|
| Analyst | Art Director | `ItemAnalysis` JSON file |
| Art Director | Scout, Generator | `ArtBrief` JSON file |
| Scout | Matter | raw candidate file path (cached) |
| Matter | Gate | `AssetMeta` object (in memory) and PNG on disk |
| Gate | Composer | `AssetMeta[]` for passing assets only |
| Composer | Critic | `LayerPlan` JSON and a rendered PNG |
| Critic | Composer (fix) | `findings` array, applied as deltas |

Nothing passes a model's raw text to another model. Every hop is a validated
object.

---

**`applyFixes` bounds (write these into the function; do not loosen them):**
per finding with `action: "fix"`, a layer's `x` or `y` may move at most 0.05
(stage units), `scale` may change by at most 15%, and `blurPx` by at most 4px.
A fix that needs more than that is not applied; it becomes a `regenerate`
finding instead. `layerId` must exist in the plan.

## 6. Numbers (`src/pipeline/rules.ts`, single source)

Create `rules.ts` with exactly these values. Anything not here is a bug.

```ts
export const RULES = {
  maxAccents: { desktop: 6, mobile: 4 },
  generationBudgetPerItem: 12,
  generationCandidatesPerCall: 4,
  generationRoundsPerLayer: 3,
  scoutDownloadTopN: 4,
  scoutSearchResults: 20,
  rejectTitleWords: ['logo', 'diagram', 'map', 'drawing', 'illustration', 'poster', 'packaging', 'text', 'vector', 'clipart'],
  minShortEdge: { hero: 800, splash: 700, background: 800, ingredient: 400, accent: 300 },
  alpha: { nothingVisible: 0.01, noCutout: 0.92, fillsFrame: 0.6 },
  liquidWords: ['yogurt', 'yoghurt', 'milk', 'juice', 'sauce', 'smoothie', 'soup', 'coffee', 'tea', 'syrup', 'shake', 'lemonade', 'broth', 'latte'],
  sharpnessMin: 0.15,
  criticMaxRuns: 2,
  analystAttempts: 2,
  artDirectorAttempts: 2,
  videoDurationSeconds: { min: 4, max: 10 },
  hashSeedSalt: 0x9e3779b9,    // used by planner for accent seeding
  stages: {
    desktop: { aspect: 1.6, copyZone: { x: 0.04, y: 0.2, w: 0.36, h: 0.6 } },
    mobile:  { aspect: 0.5625, copyZone: { x: 0.06, y: 0.56, w: 0.88, h: 0.36 } },
  },
} as const
```

`gate.ts` must import `minShortEdge`, `alpha`, `sharpnessMin` from here.
`planner.ts` must import `stages` where it currently hard-codes copy-zone
offsets for the focal point (it reads `stage.copyZone`, so no change is needed
there; only the callers change).

---

## 7. Artifact folder and manifest

### 7.1 Folder

```
pipeline-out/
  <item-id>/
    analysis.json
    art-brief.json
    layers.desktop.json
    layers.mobile.json
    critic-1.json
    critic-2.json          (only if run)
    manifest.json
    assets/
      <layerId>.png
      <layerId>.meta.json
      <layerId>.gen-<n>.json          (generated candidates only)
    cache/                 (keyed downloads and generations; see 9.3)
    scrub/
      raw.mp4
      scrub.mp4            (homepageHero only)
```

`pipeline-out/` is gitignored. Only the owner-approved final assets are copied
into the repo or R2 by a separate step.

### 7.2 `manifest.json`

```json
{
  "itemId": "item_0142",
  "startedAt": "2026-11-14T15:00:00Z",
  "finishedAt": "2026-11-14T15:04:12Z",
  "status": "done",
  "events": [
    { "t": "...", "stage": "analyst", "result": "ok", "attempts": 1 },
    { "t": "...", "stage": "scout", "layer": "hero", "source": "owner-photo", "gate": { "ok": true, "reasons": [] } },
    { "t": "...", "stage": "scout", "layer": "accent-1", "source": "openverse", "candidateId": "ov_9921", "gate": { "ok": false, "reasons": ["fills-frame"] } },
    { "t": "...", "stage": "generate", "layer": "accent-1", "round": 1, "seed": 1834920231, "gate": { "ok": true, "reasons": [] } },
    { "t": "...", "stage": "critic", "run": 1, "verdict": "fix" },
    { "t": "...", "stage": "critic", "run": 2, "verdict": "pass" }
  ],
  "generationCalls": 4,
  "warnings": ["art-director: 8 accents requested, capped to 6"]
}
```

Every model call, every gate result, every retry, and every stop goes in
`events`. No silent steps.

---

## 8. Model choices, licence allow-list, configuration

`models.ts` reads the choice from env and refuses to run a model whose licence
is not on the allow-list for the stated use. The allow-list is a file the owner
edits, not the builder.

```ts
// models.ts (shape)
export type ModelEntry = {
  role: 'analyst' | 'art-director' | 'critic' | 'generate' | 'matting' | 'video'
  id: string                 // e.g. an HF repo id or API model name
  licence: string            // exact SPDX-ish label copied from the model card
  commercialOk: boolean      // copied from the model card, NOT inferred
  checkedOn: string          // date the builder read the card, ISO
}
```

Required by the builder before first run: fill each `licence`, `commercialOk`,
`checkedOn` from the model card. Do not fill them from memory. If the card
cannot be read, the entry stays `commercialOk: false` and the runner refuses
that role.

**Candidate models (verify each card; this list is a starting point, not a
decision):**
- Analyst / Art Director / Critic: a small open instruction model. For the
  Critic, it must accept images (a vision-language model). Pick the smallest
  one that passes the Critic test set in section 10.
- Generate: an open text-to-image model. Schnell-class models are fast but need
  checking for commercial use; SDXL-class models have their own licence. Read
  each card.
- Matting: an open background-removal model. Check the licence; some popular
  matting models are non-commercial.
- Video (homepage only): an open text-to-video model. Check the licence and the
  hardware requirement.

**Environment variables:**

```
PIPELINE_LLM_URL          base URL of an OpenAI-compatible endpoint (local or hosted)
PIPELINE_LLM_KEY          key if needed (never committed)
PIPELINE_GEN_URL          image generation endpoint
PIPELINE_MATTE_URL        matting endpoint
PIPELINE_VIDEO_URL        video endpoint (optional)
PIPELINE_OUT              output dir (default ./pipeline-out)
PIPELINE_CACHE            cache dir (default ./pipeline-out/cache)
PIPELINE_MAX_SPEND_USD    hard stop; the runner estimates cost per call and halts
```

Provide a dry-run mode: `PIPELINE_DRY_RUN=1` makes every model call return a
fixture (`apps/web/harness/pipeline-fixtures/`), so the whole chain runs with no
network. Dry-run is how the tests in section 10 run in CI.

---

## 9. Determinism and caching

### 9.1 Seeds

`fnv1a32(s: string): number` in `src/pipeline/hash.ts`:

```ts
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
```

- Planner seed: `fnv1a32(item.name)`.
- Generation seed: `fnv1a32(item.id + '|' + layer.kind + '|' + layer.assetLabel + '|' + round + '|' + candidateIndex)`.

### 9.2 Idempotency

Running the same item twice with the same inputs and cache must produce the
same `layers.*.json` byte for byte. Test it (section 10).

### 9.3 Cache keys

```
download:   sha256(sourceId + '|' + url)
matte:      sha256(inputFileSha256 + '|' + mattingModelId)
generate:   sha256(prompt + '|' + genModelId + '|' + seed + '|' + width + 'x' + height)
analyst:    sha256(JSON.stringify(input) + '|' + llmModelId + '|' + promptVersion)
art-dir:    same pattern
critic:     sha256(pngSha256 + '|' + promptVersion + '|' + criticModelId)
```

`promptVersion` is a string constant in each agent file (`'analyst-v1'`). Bump
it when a prompt changes, so the cache does not serve old answers.

Cached model outputs are stored with the same validation: a cache hit that
fails validation is evicted and re-run.

---

## 10. Tests the builder must write and pass

All tests run in dry-run mode, with no network, using fixtures.

### 10.1 Deterministic (must always pass)
- `scripts/verify-pipeline.mjs` (existing, 13 checks) still passes.
- New: planner at aspect 0.5625 (mobile): hero in upper half, no accent in the
  copy zone, layers returned for 4 accents. Fix the planner if these fail.
- New: `fnv1a32('') === 0x811c9dc5`; `fnv1a32('a') === 0xe40c292c`. (Known
  FNV-1a values; if different, the implementation is wrong.)
- New: `gateAsset` thresholds read from `RULES` (change `RULES`, the result
  changes).
- New: `rank()` in Scout: a PNG, 1200 px, CC0 scores higher than a JPEG,
  500 px, CC-BY-SA, and ties sort by id.

### 10.2 Schema and validation
- Analyst: invented ingredient rejected; empty list stays empty; bad mood
  rejected (section 3.1 tests).
- Art Director: accents capped at `maxAccents`; splash absent for a dry item
  (section 4.3); `lightSentence` identical across layers.
- Critic: `verdict` outside the enum rejected; `findings[].layerId` must exist
  in the plan.

### 10.3 Integration (dry-run)
- Use case 4.1 through 4.8 each as one test. Assert on status and on the files
  listed in each use case's "Expected" line.
- Idempotency: run 4.1 twice; `layers.desktop.json` identical.
- Budget: an item whose gate fails everything stops at 12 generation calls and
  returns `needs-assets`.

### 10.4 Visual (manual, but required before "done")
- Render 4.1 and 4.6 at 390, 820, and 1440 with the harness (`harness.mjs shoot`)
  and attach the screenshots. Compare against the attached references: accents
  form a loose cloud around the hero, near ones are larger and softer, none sit
  on the copy, the splash sits behind. If any of those four is false, the item
  is not done.

---

## 11. The LayerStage renderer (not yet built; spec)

The renderer reads `layers.desktop.json` and draws each layer:

- Container: a `position: relative` box with the stage aspect ratio
  (`aspect-ratio: 1.6`, or `0.5625` for mobile), `overflow: hidden`.
- Each layer: `position: absolute`, `left: x*100%`, `top: y*100%`,
  `width: scale/3*100%` (since scale 1 = one-third of stage width),
  `transform: translate(-50%, -50%) rotate(rotation deg)`.
- Depth: `filter: blur(blurPx px)` only when `blurPx > 0`.
- Parallax: on scroll, `translateY(progress * parallax * -60px)` per layer.
  `parallax` comes from the layer plan.
- Shadow: `filter: drop-shadow(...)` on the layer, never `box-shadow`.
  (Section 4 of `docs/AI_BUILDER_PLAYBOOK.md`.)
- Reduced motion: no parallax, no transform changes.
- Copy: rendered in its own element above the stage, positioned in `copyZone`.
- Images: `loading="lazy"` for accents, eager for hero. Explicit width and
  height attributes from `meta.width` and `meta.height` (no layout shift).

File: `apps/web/src/pipeline/LayerStage.tsx` plus `layer-stage.css`.

---

## 12. Build order (do in this order; each step is testable alone)

1. `rules.ts`, `hash.ts`, and make `gate.ts` read `rules.ts`. Run
   `verify-pipeline.mjs`.
2. Mobile planner checks (section 10.1). Fix the planner if needed.
3. `schemas.ts` with the four output schemas and their validators. Test them
   with the invalid cases in section 10.2.
4. `cache.ts`, `store.ts`, `manifest` writer.
5. `llm.ts` with `callJsonModel(prompt, schema, {attempts})`, dry-run aware.
6. Analyst and Art Director agents, with dry-run fixtures. Tests 10.2.
7. Scout (ranking, search adapters, reject list) with recorded API fixtures. Test ranking.
8. Generator and Matter with dry-run. Tests for the empty-matte failure.
9. `run-item.ts` orchestration; use cases 4.1 to 4.7 as dry-run tests.
10. Critic and the fix loop; test the 2-run limit.
11. `LayerStage.tsx`; visual check (10.4).
12. Motion (homepage only); `verify-scrub.mjs` against the output.
13. Only then: connect real model endpoints (section 8), one item at a time,
    and record the cost per item in the manifest.

---

## 13. Stop and ask (do not decide these yourself)

Stop, write the question to `manifest.json` as `needsDecision`, and do not
continue the affected item when:

- A model entry has `commercialOk: false` or an unreadable licence and the
  owner has not confirmed it may be used.
- A source returns an image with no licence string.
- The Analyst returns an ingredient the owner did not list and retry fails.
- A hero cannot be found after the budget (section 4.7): show the owner the
  reason; do not pick a substitute hero.
- The owner's `homepageHero` flag is set on more than one item.
- Spend would exceed `PIPELINE_MAX_SPEND_USD`.
- Any image appears to contain text, a logo, a watermark, or a person (the
  Critic's check 1 is not enough for these; the builder must add a
  watermark/text detector or stop and ask).

---

## 14. Definition of done

- [ ] Sections 10.1 to 10.3 pass in dry-run mode, in CI.
- [ ] Use cases 4.1 to 4.8 each produce their listed "Expected" files.
- [ ] `models.ts` has a filled licence for every role used, with `checkedOn`.
- [ ] No prompt in this document was changed without bumping its `promptVersion`.
- [ ] A real (non-dry) run on the Cairo Coffee House fixture completes for
      at least 3 items, and each manifest's `events` shows every call.
- [ ] Visual check 10.4 passed for 4.1 and 4.6, with screenshots attached.
- [ ] The renderer never displays an asset whose gate result is not `ok`.
- [ ] `docs/PIPELINE.md` and this file are updated with anything that changed.

---

## Appendix A. Glossary (fixed meanings)

- **Owner item:** one entry on the owner's menu.
- **Layer:** one object placed on the stage (hero, splash, or accent).
- **Accent:** a layer for one owner ingredient, floating.
- **Hero:** the dish itself, the largest sharp object.
- **Splash:** a liquid or powder layer behind the hero. Only for liquid-based items.
- **Candidate:** one image file for a layer before it passes the gate.
- **Stage:** one viewport shape (desktop or mobile) the plan is built for.
- **Copy zone:** the rectangle that layers must not cover.
- **Gate:** deterministic pass/fail for one asset (`gateAsset`).
- **Critic:** vision-model review of the composed stage.
- **Dry run:** all model calls replaced by fixtures; no network.
- **Partial:** an item where some layers are missing but the hero exists.

## Appendix B. What this spec deliberately leaves to code, not to any model

- Where each layer goes (Composer).
- How big, how blurred, how deep (Composer).
- Which source is tried first (Scout order).
- Which candidate wins (Gate, then rank).
- How many retries (rules).
- How many generations (budget).
- Whether a splash exists: liquid-based is decided by code from
  `RULES.liquidWords` matched against the item name and hero. The Art Director's
  answer is checked against that result and overridden by it (section 3.2 rule 3).

Any AI building this should read Appendix B as the list of things it is not
allowed to re-decide with a model.
