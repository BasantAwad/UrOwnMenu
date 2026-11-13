# AI Builder Playbook

How a coding AI should design, source images, edit them, and ship a template in
this repo. Read this before touching `apps/web/src/templates.tsx`. It exists
because earlier template work failed in predictable ways: dishes rendered tiny
in empty space, type clipped behind rectangles, flat dark grounds, images with
no consistent scale or light. Each rule below prevents one of those.

The short version: **you cannot judge a design by reading its code. Render it,
look at it, and fix what you see.** Everything else is detail.

---

## 1. The loop (do not skip steps)

```
brief -> plan -> attack the plan -> build in the harness -> screenshot -> critique -> fix -> verify -> commit
                                         ^______________________________|
```

1. **Brief.** One sentence each: the subject (what is sold, to whom), the
   template's single job, and the one memorable moment. If you cannot write
   these, stop and ask.
2. **Plan, in tokens, before code.** Write down 4 to 6 named colours (hex), the
   typefaces and their roles, a layout concept with an ASCII wireframe, and the
   depth/light rule (section 5). Put it in the PR description.
3. **Attack the plan.** Ask: would I produce this exact plan for any other
   restaurant? If yes, it is a default, not a choice. Replace the part that is
   generic and write down what you changed and why. Defaults to refuse are in
   section 8.
4. **Build in the harness** (section 2), never against the live API.
5. **Screenshot at 390, 820 and 1440 wide.** Open the images and look. Write
   down three things that are wrong before you write down anything that is right.
6. **Fix, re-shoot, repeat** until the three problems are gone and no new ones
   appeared. Two or three rounds is normal. One round means you did not look.
7. **Verify** with numbers where numbers exist (section 7), then commit.

Boldness goes in one place per template. One element is memorable; everything
around it is quiet and exact. If everything is loud, nothing is.

---

## 2. See your work: the harness

`apps/web/harness/` renders any real template from a fixture menu. No API,
database or login.

```bash
cd apps/web
npm install --ignore-scripts      # skip native postinstalls; the browser build does not need them
npm run dev                       # leave running (port 5173)

node scripts/harness.mjs assets                       # once: fixture cutouts, macros, two real photos
node scripts/harness.mjs shoot ingredient-story       # -> apps/web/shots/ingredient-story-1280.png
node scripts/harness.mjs shoot orbital-menu --w 390 --h 844
node scripts/harness.mjs shoot cafe --palette tomato-parchment --viewport-only
```

- `shoot` scrolls the page once before capturing (so scroll-linked and lazy
  states resolve), then reports page height, **horizontal overflow** and any
  script error or failed request. Treat every line under `PROBLEMS` as a bug.
- If Playwright's Chromium is not installed, set `CHROMIUM_PATH` to any
  Chrome/Chromium, or run `npx playwright install chromium`.
- Edit `harness/fixture.ts` to test hard cases: a 60-character item name, one
  item, thirty items, no photo, no price, an item with a non-cutout photo.
  Templates are judged on their worst data, not their best.

Open the PNG. Describe it to yourself in words (what is biggest, what the eye
lands on first, what is empty). If the description does not match your intent,
the design does not match your intent.

---

## 3. Getting images

Never invent a photograph and never claim a generated image is a photo. There
are four honest sources, in order of preference:

| Source | Use for | Notes |
|---|---|---|
| The owner's own photos | Every dish | Always first. Cutouts via `removeBackground`, then `normaliseCutout`. |
| Openverse | Ingredient macro backgrounds | CC0, PDM, CC-BY, CC-BY-SA only. Store the file, record creator and licence, credit it in the public footer. |
| Wikipedia lead image / Wikimedia Commons | Ingredient fallback | Licence and author come from `extmetadata`. |
| Procedural stand-in | When nothing resolves | `proceduralMacro()` and the illustrated plates in `design/dishes.tsx`. Honest, deterministic, never presented as a photo. |

The working resolver is `apps/api/index.ts`, section "Ingredient photo
resolution". Read it before writing another one. Endpoints it uses:

```
Openverse   https://api.openverse.org/v1/images/?q=<name>&license=cc0,pdm,by,by-sa&page_size=10&mature=false
Wikipedia   https://en.wikipedia.org/api/rest_v1/page/summary/<Title_With_Underscores>   (originalimage.source)
Commons     https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&titles=File:<name>&format=json
            -> extmetadata.LicenseShortName, LicenseUrl, Artist (strip the HTML)
```

**Rules**
- Do not hotlink a third party in a customer menu. Download, store (R2), serve
  your own copy.
- Never use a result whose licence you could not read. "Unknown" means no.
- Keep `creator`, `license`, `licenseUrl`, `sourceUrl` with the file. The public
  menu shows them.
- If your sandbox blocks the network, say so plainly and ask for the files.
  Do not substitute a made-up image and do not stay silent about it.

**The current picker is weak: improve it when you touch it.** It takes the first
landscape result at least 700px wide. A good macro backdrop needs scoring:

1. Resolution: at least 1600px on the long edge for a full-bleed background.
2. Orientation: landscape for backdrops, square or portrait for inset frames.
3. Relevance: the ingredient word appears in the title or tags; reject titles
   containing `logo`, `diagram`, `map`, `drawing`, `illustration`, `poster`,
   `packaging`, `text`.
4. After download, run `analysePhoto` (`media-intelligence.ts`) and reject very
   dark, very bright, or very low-contrast images: a backdrop sits behind
   type and must survive a scrim.
5. Prefer a tight, shallow-depth-of-field macro of the ingredient itself over a
   wide shot of a market stall.
6. Keep the next-best candidate. If the owner dislikes the first, offer it.

---

## 4. Editing images

All editing is free, in-browser and deterministic. Order matters.

```
prepareImage / prepareForUpload  (apps/web/src/media.ts)
  crop to frame
  -> autoEnhance   (src/enhance.ts: levels, adaptive gamma, clamped white balance, vibrance)
  -> manual tone   (exposure, contrast, saturation, warmth)
  -> unsharpLuma   (luma-only, noise-gated; never per-channel)
  -> cleanAlphaEdge (cutouts: remove the light halo at the matte edge)
  -> normaliseCutout (trim, 90% fill, optical centre, square pad)
```

- **One light per menu.** Photographs from different shoots disagree about
  exposure and white balance. Grade every dish in a menu with the same
  `autoEnhance` strength so the set looks lit by one source. Do not grade one
  hero heavily and leave the rest.
- **Cutouts are lit by CSS, not by the file.** Use
  `filter: drop-shadow(...)`, which follows the alpha channel. `box-shadow`
  paints the rectangle and ruins the cutout. Add a rim light with a 1px
  low-opacity warm `drop-shadow` and a cast shadow with a large soft one.
- **Reflection** under a dish on a dark ground:
  `-webkit-box-reflect: below -1.5% linear-gradient(transparent 68%, rgba(255,255,255,.16))`
  inside `@supports`. Chromium and Safari render it; Firefox ignores it, which
  is fine.
- **A photograph that is not a cutout** is framed, not floated. Put it in a
  deliberate shape (arch, circle, tall slit) with its own shadow. A bare
  rectangle next to a floating cutout reads as a mistake.
- **Duotone** (zine, riso, minimalist): an SVG `feColorMatrix` filter or two
  stacked layers with `mix-blend-mode: multiply` and `screen`. Do it in CSS so
  the owner's original stays untouched.
- **Never stretch.** Give every image an `aspect-ratio` from its stored width
  and height, `object-fit: contain` for cutouts, `cover` plus the measured focal
  point (`photo_meta`) for photographs.
- **Verify edits with numbers** (section 7), not only by eye.

`scripts/verify-enhance.mjs` shows how to test an image function without a
browser: build synthetic pixels with known properties and assert on the result.

---

## 5. Depth: how a flat page gets dimension

Flat output has one cause: every layer sits at the same distance and nothing is
lit. The Ingredient Story template (`src/story.css`) is the worked example.
Every chapter stacks the same six layers, back to front:

```
1  ground        macro photograph, parallax -7% .. +7%, scale 1.16 -> 1.08
2  grain         SVG feTurbulence, opacity .11, mix-blend-mode soft-light
3  scrims        legibility gradient + vignette + fades into the neighbouring chapter
4  type          the ingredient word, huge, BEHIND the dish
5  light         warm radial bloom, behind the dish, parallax opposite to the ground
6  subject       dish: rim light + cast shadow + reflection, with its own parallax
7  copy          sits in front; gets a text-shadow if the ground can be bright
```

Rules that make it read as a scene:

- **One light.** Pick where light comes from and obey it in every shadow,
  highlight and bloom. The bloom sits behind the subject; the shadow falls away
  from it.
- **Overlap on purpose.** Type behind the subject, subject over the seam
  between two grounds, a label crossing a connector. Overlap is how the eye
  reads depth. Nothing overlapping means nothing is in front of anything.
- **Scale hierarchy.** The subject should fill at least about 55% of its stage
  height. If the hero dish looks "placed", it is too small.
- **Move layers at different rates.** Ground slowest, subject faster, type in
  between and sideways. Use `useScroll({ target, offset })` with a spring, and
  skip the transforms under `prefers-reduced-motion`.
- **Hand over between sections.** Fade each section's ground into the next with
  a gradient. A hard seam is what makes chapters feel like separate posters.
- **Occlusion beats blur.** Use `filter: blur()` only for genuinely
  out-of-focus planes. Arbitrary blur is decoration.

---

## 6. Building and publishing an artifact

Use two different tools for two different jobs.

**A. A single self-contained page (most previews, concept boards, demos).**
Write one HTML file with inline CSS and JS. No build step. Publish it with the
Artifact tool.

**B. A real React app preview (use the `web-artifacts-builder` skill).**

```bash
bash <skill>/scripts/init-artifact.sh my-preview    # React 18 + TS + Vite + Tailwind + shadcn/ui
cd my-preview  # ...build...
bash <skill>/scripts/bundle-artifact.sh             # -> bundle.html, everything inlined
```

**Bundling a repo template as a standalone page** (what produced the Ingredient
Story preview): a second Vite config with `build.assetsInlineLimit` very large,
`cssCodeSplit: false`, one chunk, an alias that replaces `./three/PlateScene`
with a stub (the 3D plate is lazy and unused), and fixture images imported with
`?inline` so they become data URIs. Then assemble one file:

```python
css = re.sub(r'@font-face\s*\{[^}]*\}', '', css)   # a broken local font URL blocks the web font from ever loading
js  = js.replace('</script', '<\\/script')          # JS strings can contain this and end the tag early
# head: <title>, Google Fonts <link>, <style>css</style>, then <div id=root>, <script type=module>js</script>
```

**Publishing constraints** (the viewer enforces these; breaking them fails
silently):
- Scripts only from `cdnjs.cloudflare.com`, `cdn.jsdelivr.net/npm/`,
  `unpkg.com`, `cdn.tailwindcss.com`, `code.jquery.com`. Pin exact versions.
- Stylesheets only from Google Fonts. Everything else is inlined.
- No runtime `fetch` to other hosts. Images are `data:` URIs. Page limit 16MB.
- Write page content only: a `<title>` (a name, two to four words), `<style>`,
  markup, scripts. Not `<html>`, `<head>` or `<body>`.
- Define every colour as a token on `:root`. A deliberately dark single look is
  allowed: set `color-scheme: dark` and an explicit `body` background.
- Layout must hold at 400px wide with no horizontal scroll.
- Check the result in a browser before publishing: console errors, overflow at
  390 and 1440, fonts actually loading.

---

## 7. Verify with numbers

| Claim | How to prove it |
|---|---|
| No sideways scroll | `shoot` prints horizontal overflow; must be `0px` |
| Nothing clipped | `scripts/probe-overflow.mjs` |
| Cutout is centred and sized | `scripts/verify-cutout-normalise.mjs` |
| Enhance does no harm | `node scripts/verify-enhance.mjs` |
| Text is readable on the ground | compute contrast of the real rendered pixels under the text, not the CSS colour; need 4.5:1 for body, 3:1 for large type |
| Two renders match | pixel-diff two screenshots, ignore noise under ~40/255 |
| A test can fail | break the code on purpose once; a check that cannot fail proves nothing |

Write tests that could fail. Two of this repo's first enhance tests were wrong:
one used two colours with nearly equal luminance, so there was no edge to
sharpen and the check passed for the wrong reason.

---

## 8. Defaults to refuse

These are the commonest signs that a page was generated. They are allowed only
when the owner's brief asks for them.

- A warm cream ground with a high-contrast serif and a terracotta accent.
- Near-black with one acid-green or vermilion accent.
- Broadsheet hairlines and dense columns on a food menu.
- Identical rounded cards with the same soft grey shadow; one radius on
  everything; gradient washes as decoration.
- A tracked all-caps label above every heading; meta lines joined with middle
  dots; labels like `WORD — fragment`; a monospace face for small labels; an
  arrow appended to every link.
- Numbering (`01 / 02 / 03`) on content that is not actually a sequence.
- Accenting one word of a headline in italics or a colour.
- Fade-and-slide-up on every section and a hover transition on every card.
- Centring everything.
- Random floating PNGs, arbitrary blur, shadows that disagree about the light.

Also from `docs/INSPIRATION.md` section 8: stretched logos, distorted dishes,
fake facts, label collisions, and motion that blocks reading.

---

## 9. How to be creative from a reference

The owner's references are there to be understood, not copied. Do not trace the
layout, reuse the typeface, or lift the coordinates. Extract the mechanism and
rebuild it from the restaurant's own world.

```
reference  ->  what does it DO for the person?  ->  a metaphor from THIS venue  ->  one constraint  ->  one signature moment
```

Worked example. The Wove navigation shows a thin ellipse with one active marker.
What it does: it shows position in a set and makes choosing feel like turning
something. A pizzeria does not need an ellipse; it has a lazy Susan on a shared
table. A bakery has a vitrine, a cocktail bar has a shelf of bottles. Pick the
object the venue already owns, make it physical, then let the menu be that object.

Ask, in order:
1. What does the reference make easier or more pleasurable?
2. What object, ritual or material in this kind of venue does the same thing?
3. What single constraint keeps it disciplined (one colour pair, one axis of
   motion, one material)?
4. What is the one moment someone will describe to a friend?
5. What would a competent but lazy designer do here, and have I avoided it?

Typography is a design material, not a container. The Ingredient Story word set
huge behind the dish is the template. Decide what the type is doing.

---

## 10. Hard-won bugs (check these first)

| Symptom | Cause | Fix |
|---|---|---|
| A grid column is wider than the screen, content clipped at the right | `1fr` means `minmax(auto, 1fr)`, so min-content forces it wider | `grid-template-columns: minmax(0, 1fr)` |
| Outlined headline shows stray lines inside letters | variable fonts draw internal overlap contours through `-webkit-text-stroke` | use a translucent fill instead of a stroke |
| Cutout gets a rectangular shadow | `box-shadow` | `filter: drop-shadow()` |
| Ghost word sized by JS disappears under reduced motion | size was set inside the motion style that reduced motion drops | set size with a CSS variable outside the motion style |
| Procedural backdrop is a random colour (blue tomato) | hash-only hue | map known ingredients to natural hues; constrain the fallback to a warm range |
| Sticky rail shows nothing | sticky element inside a flow container has no height | zero-height sticky wrapper, absolutely positioned child |
| Web font never appears in the standalone page | an inlined `@font-face` with a dead URL wins over the Google face | strip `@font-face` from the inlined CSS |
| Enhance stats skewed on cutouts | transparent pixels counted | ignore `alpha < 200` when measuring |
| Gamut clip shifts hue | clamping each channel separately | slide toward the grey of equal luminance until it fits |
| `git clone` stalls | proxy concurrency | one clone, long timeout, do not interrupt |
| `npm install` fails on `onnxruntime-node` | postinstall downloads a binary | `--ignore-scripts`; browser build does not need it |

---

## 11. Definition of done

- [ ] Plan written (tokens, wireframe, depth rule) and attacked once.
- [ ] Shot at 390, 820, 1440; three problems found and fixed; no horizontal overflow.
- [ ] Hardest fixture data tried (long name, one item, no photo, non-cutout photo, many items).
- [ ] The single memorable moment exists and is the loudest thing on the page.
- [ ] Light direction consistent; cutouts use `drop-shadow`; nothing stretched.
- [ ] Type contrast measured on real pixels.
- [ ] Keyboard focus visible; `prefers-reduced-motion` removes movement but not content.
- [ ] Missing photo, missing price, empty menu and one item all look intentional.
- [ ] Every motion has trigger, start, end, easing, duration and interruption behaviour written down.
- [ ] Owner data only: no invented ingredients, prices, claims or reviews.
- [ ] `npx tsc -b` clean; any new pure function has tests that can fail.
- [ ] Commit message says what changed and why; screenshots attached to the PR.
