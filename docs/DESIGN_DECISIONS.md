# UrOwnMenu — Design decisions

Every decision below is backed by evidence rather than taste. Sources are
cited per section. The measurements were taken with the open-source MCP
servers listed in `THIRD_PARTY_UI.md`.

---

## 1. Band structure and rhythm

**Measured.** `analyze_page_structure` against three award-winning food and
hospitality sites:

| Reference | Bands | Total height | Mean band |
|---|---|---|---|
| Tengile Malamala Collection (SOTD) | 17 | 11 546 px | ~680 px |
| Casa Momo (Nominee) | 28 | 19 157 px | ~685 px |
| Agrumea Farm (SOTD) | 1 | 900 px | full-bleed single screen |

**This project before the redesign** measured 4 bands at 4 834 px on desktop
and **1 band at 2 712 px on mobile** - a flat page with no rhythm, and on the
device a QR-scanned menu is actually read on, no structure at all.

**Applied.** Sections are real bands with their own ground, alternating
between the canvas and a muted surface, and the mobile layout keeps the same
section boundaries rather than collapsing into one block.

**Alternating ground** follows Casa Momo, which alternates a warm sand
`#e5d8b4` across all 28 of its bands, and Milanote, which alternates "a
deep slate workspace backdrop with broad white editorial sections".

---

## 2. The hero

**Measured.** Tengile's first band is `rgba(55, 63, 29, 0.5)` over its media
with a `rgb(245, 238, 233)` body below. Agrumea's single band is
`rgb(253, 243, 235)`.

**Problem found by capture.** The first implementation put the media
full-bleed behind the type with a scrim. For a **cutout** - a photo with a
transparent background - a scrim over it produced a washed-out grey field,
because the scrim darkened the page but the transparent pixels showed the
page rather than the photo.

**Applied.** The hero is a two-column band: type on the ink ground, media
beside it as a separate object with a warm key light behind it. A cutout
therefore sits on a flat ink field with a contact shadow; a normal photo
keeps its own frame.

---

## 3. Cutouts must not be cropped, boxed or shadowed with a rectangle

This produced three separate bugs, each caught by capturing the real build
rather than reasoning about it:

1. **`object-fit: cover` on a transparent PNG** slices the subject and turns
   the transparent margin into a white rectangle.
2. **A specificty mistake**: `.tpl-editorial__itemMedia img` (0,1,1) beat
   `.is-cutout` (0,1,0), so the cutout rule never applied. Fixed with
   `.tpl img.is-cutout`.
3. **`box-shadow` on the `<img>`** paints the element's *border box*, so a
   transparent PNG got a visible rectangular shadow. The correct technique is
   `filter: drop-shadow()`, which follows the alpha channel and traces the
   actual subject.

The media asset records `is_cutout`, so the templates know which treatment to
use. The server does not trust the client flag: it also detects a PNG alpha
channel from the IHDR colour type (4 = greyscale+alpha, 6 = truecolour+alpha)
and treats the asset as a cutout either way.

**Alpha fringe.** The segmentation model returns a soft matte whose
near-transparent pixels still carry the original background colour, which
read as a faint smudge on a light surface. `cleanAlphaEdge()` thresholds
alpha below 26 and erodes one pixel, cutting the faint band from 6% of the
image to 1%. Verified by sampling the rendered PNG's corners: all four are
now `[0, 0, 0, 0]`.

**Circular masks.** A portrait cutout forced into `border-radius: 50%` has
its top and bottom sliced off. Where a cutout is the subject, the frame
drops the circle and keeps only the shadow.

---

## 4. Type

**Measured.** Mollie pairs a display serif with a sans body and a monospaced
uppercase layer above sections, media and categories. Its display face is
Adamina (Google Fonts, OFL); its body face is Inter (OFL); its operational
face is IBM Plex Mono (OFL).

**Applied.** The same three-part system, using system stacks so no webfont
is downloaded:

| Role | Stack | Reason |
|---|---|---|
| Display | `Georgia, 'Times New Roman', serif` | A high-contrast serif is available on every platform at zero bytes. |
| Body | `system-ui, -apple-system, 'Segoe UI', sans-serif` | Native rendering, zero bytes. |
| Operational labels | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | The mono layer that separates structure from content. |

`docs/AI_MEDIA_PIPELINE.md` requires the menu to be fast on mobile data, and
a QR-scanned menu is usually opened on mobile data. Two webfont families
would cost roughly 60-120 KB before any menu content. The system stacks
deliver the same typographic structure for nothing.

---

## 5. Surface ladder and colour

**Measured.** Milanote defines an explicit four-level ladder: Slate Canvas
`#303b4b` (0) -> Paper White `#ffffff` (1) -> Gallery Gray `#ebedee` (2) ->
Elevated Paper `#ffffff` (3). Mollie uses `#ffffff` / `#f7f4f1` / `#3b281d` /
`#211006` with a single warm accent `#e07122`. Graphite uses hairline
borders `#262626` and `#464646` on near-black, with one warm cue `#ff8833`.

**Applied.** The project's own `docs/DESIGN_SYSTEM.md` palettes supply the
brand colours, and the structure follows the references: a dark ground for
the hero and the orbit navigation, a paper ground for the menu, a muted
surface for alternating chapters, and exactly one warm accent per band.

---

## 6. Motion

**Measured.** `get_motion_dna` on Tengile Malamala returns
`{"libs":["lenis"],"render":[],"scrollModel":"lenis"}` with a census of
`{"gsap-scrolltrigger":0,"css-scroll-timeline":0,"css-view-timeline":0,
"css-keyframe":1,"smil":0}`. The reference implements its motion with
**CSS keyframes and no scroll-trigger library**.

`analyze_hover_census` on Casa Momo reports **40 hover rules** - hover
interactions are a load-bearing part of these sites, not decoration.

**Library.** `motion` v14.12.0 (MIT, React 18/19 compatible). Chosen over
Framer Motion because it is the successor package, MIT, and the
`motion-ref` skill's own verification record names it as the current release
for React 18/19. No second animation runtime is added.

**Parameters come from measured reference configs, not memory.** The
`motion-ref` skill states explicit ranges and TuneShape publishes machine
readable effect configs, so both were used:

| Parameter | Value | Source |
|---|---|---|
| House easing | `[0.22, 1, 0.36, 1]` | The default in TuneShape's `basic-button`, `hover-invert` and `soft-blur-in` configs |
| Spring | stiffness 260, damping 24, mass 1 | TuneShape `basic-button` config |
| Press feedback | scale 0.92, y 2, 420 ms | TuneShape `basic-button` config |
| Hover transition | 220 ms | TuneShape `hover-invert` config |
| Tab indicator | 250 ms on `left` and `width` | `motion-ref` 5.4 |
| Page transition | 520 ms | TuneShape `rail-toc` config |
| Fade in | 200-400 ms | `motion-ref` 13.1 |
| Slide up | 300-500 ms, 20-30 px travel | `motion-ref` 13.2 |
| Scale in | 200-350 ms, start 0.9-0.95 (never 0) | `motion-ref` 13.3 |
| Stagger | 50-100 ms per item, total under 800 ms | `motion-ref` 13.5 |
| Progress bar | 500 ms, ease-in-out | TuneShape `scroll-progress` config |
| Interruption | `retarget` | TuneShape configs; Motion springs do this natively |
| Reduced motion | `instant` | TuneShape `basic-button`; matched by `MotionConfig reducedMotion="user"` |

**What it enables that CSS keyframes alone could not:**

- **Shared element transition ("magic move")** in the Orbital Menu. The
  selected dish image is measured at its marker on the ellipse and animates
  into the focal zone, so the viewer can see where it came from. This is the
  web equivalent of `react-native-magic-move`, implemented by measuring the
  source and destination and animating the delta. The measurement has to
  happen *before* the selection commits, because Motion reads `initial`
  values only when the element mounts.
- **Interruptible springs** rather than fixed tweens, so an interrupted
  animation continues from its current velocity.
- **Scroll-linked parallax** on the hero via `useScroll` / `useTransform`.
- **Page turns** via `AnimatePresence`, where the outgoing page rotates out
  in the direction of travel.
- **Overlapping transitions** with `mode="popLayout"`, so the incoming dish
  flies in while the outgoing one fades. `mode="wait"` would have made a
  routine tap take about 800 ms, over the 500 ms budget for an interaction.

**Motion patterns added** from the reference categories:

| Pattern | Reference | Where |
|---|---|---|
| Reading progress bar | `motion-ref` 7.2 | Every published menu |
| Scroll reveal, triggered once | `motion-ref` 7.1 | Editorial chapters, signature dishes, endless-table rows |
| Image reveal by clip-path wipe | `motion-ref` 7.5 | Editorial hero |
| Sliding tab indicator | `motion-ref` 5.4 | Magazine category tabs |
| Light sweep | `motion-ref` 11.6 | Signature dish cards |
| Breathing glow | `motion-ref` 11.2 | Active orbital marker |
| Press feedback | TuneShape `basic-button` | Page turn controls, category tabs |

**Hover.** Every interactive element has a hover treatment: images scale
inside their frame, list rows slide, the CTA lifts, the arrow nudges, and
markers brighten. The published menu now carries **30 hover rules**, against
40 on the Casa Momo reference.

### Two shadow bugs worth recording

Both were found by capturing the real build, not by reading code:

1. **`box-shadow` on a transparent PNG draws a rectangle.** A cutout sat
   inside a visible white box because the shadow follows the element's border
   box, not the image's alpha. The fix is `filter: drop-shadow()`, which
   traces the alpha channel. The same bug was then found on the orbital
   marker, where the glow was painting a rectangle around the button; the
   glow was moved onto the round thumbnail.
2. **Motion overwrites CSS transforms.** The ingredient hero was mispositioned
   because Motion writes `transform` inline, wiping the CSS
   `translate(-50%, -50%)` used for centring. The offset is now expressed
   with Motion's own `x` / `y` values.

---

## 7. The numbered orbital category navigation

**Reference.** `docs/INSPIRATION.md` section 1 describes the Wove mobile
navigation: "restrained pale grey background, monochrome typography, small
wordmark top-left, close control top-right, thin elliptical orbit entering
from left, tiny orbit markers and one prominent active black marker,
oversized active '01', bold title and light supporting copy beside it, other
numbers receding in muted grey, generous negative space and asymmetry."

**Applied.** A thin elliptical ring, markers positioned by ellipse geometry
as a percentage of the stage so they stay on the ring at any size, one
prominent active marker (filled, scaled, with the number above it so a
low marker never collides with the ring), the oversized active number and
bold title beside the orbit with generous negative space.

**Bug found by capture:** the markers were positioned in raw viewBox units
while the SVG scaled to the container, so they drifted off the ellipse. They
are now positioned as percentages of the stage.

---

## 8. Ingredients are owner facts

**Reference.** `docs/INSPIRATION.md` section 3: "Ingredients only from
owner data or owner-approved suggestions. No random floating PNGs and never
infer ingredients from pixels."

**Applied.** The Ingredient Universe template reads
`menu_items.owner_ingredients_json` only. The studio now has an
**ingredients** field so the owner can supply them. When an item has no
ingredients, the template shows the item's own name as the single subject
rather than inventing ingredients.

---

## 9. Accessibility (WCAG 2.2 AA)

**Measured** with `analyze_accessibility` against this project's own build.

The first audit of the redesigned build reported real failures:

| Finding | Measured | Threshold | Fix |
|---|---|---|---|
| Mono labels and counters in `--tpl-muted` | 2.38:1 | 4.5:1 | Text now uses `--tpl-muted-ink`, which resolves to `--tpl-text-2` |
| Accent numerals in `--tpl-accent` | 3.12:1 | 4.5:1 | Text now uses `--tpl-accent-ink`, `color-mix(in srgb, accent 68%, text)` |
| Footer text | 2.69:1 | 4.5:1 | Footer now uses `--text-secondary` |
| Images missing `width`/`height` | 1 of 1 | 0 | Every item photo renders its intrinsic size, so the browser reserves the space and the page does not shift |

After the fixes the **worst contrast pair on the page measures 8.11:1**, and
the image audit reports `missingWidthAttr: 0`, `missingHeightAttr: 0`,
`broken: 0`, `missingAlt: 0`.

Headings are `1 -> 2 -> 3` with no skips, every image has alt text, the
document declares `lang="en"` and has a title, and no focusable element has a
positive `tabindex`.

**Focus rings.** `.tpl :focus` draws an outline in `--tpl-accent-ink` with a
3 px offset, and the studio uses `:focus-visible` with an
`@supports not selector(:focus-visible)` fallback so keyboard focus is never
invisible.

Note on measurement: the audit tool reports `outlineRuleCount: 0` for this
page, but that is an artefact of the automation context - the browser window
does not hold focus (`document.hasFocus()` is false), so `:focus` cannot
match. The rule was confirmed present in the loaded stylesheet, and the
computed outline on a focused element resolves to the initial value for the
same reason.

---

## 10. Image delivery

**Measured** with `analyze_images` against this project's own build.

The first audit reported the cutout as `oversized` and the payload as a
980 KB PNG. `docs/AI_MEDIA_PIPELINE.md` asks for "responsive WebP
derivatives", and WebP carries an alpha channel, so a cutout can be WebP
instead of PNG.

**Applied.** Cutouts are encoded as WebP with alpha. The measured payload for
the same 680x1020 cutout went from **980 KB to 32 KB**, about a 30x
reduction, which is the difference between a menu that loads on mobile data
and one that does not.

The server does not trust the client to flag a cutout. It sniffs the encoded
file: a PNG with IHDR colour type 4 or 6 carries alpha, and a WebP whose
first chunk is `VP8X` with the alpha flag set (0x10) carries alpha. Either
way the asset is treated as a cutout.

---

## 11. Verification performed

| Check | Method | Result |
|---|---|---|
| Reference band structure | `analyze_page_structure` on 3 award-winning sites | 17/28/1 bands measured |
| This build's band structure | `analyze_page_structure` on `localhost:5173` | Measured before and after the redesign |
| Reference motion | `get_motion_dna` | css-keyframe motion, no scroll-trigger library |
| Reference hover | `analyze_hover_census` | 40 hover rules |
| Design systems | `refero_get_design_md` on 4 styles | Palette roles, type pairing, surface ladders |
| This build, visually | `capture_live_site` on `localhost:5173` | Full-page capture at 1440x900 and 390x844, all 5 templates, reviewed as images |
| Accessibility | `analyze_accessibility` on `localhost:5173` | Worst contrast 8.11:1, no missing alt, no missing dimensions |
| Image delivery | `analyze_images` on `localhost:5173` | Cutout 980 KB -> 32 KB (WebP), no broken images |
| Cutout alpha | Pixel sampling of the rendered PNG | Corners `[0,0,0,0]`, faint band 6% -> 1% |
| Type check | `tsc -b` (web) and `tsc -p tsconfig.json` (api) | Clean |
| Production build | `vite build` | Clean, code-split |
| Functional | `apps/api/scripts/e2e-client-journey.mjs` | 81/81 |
