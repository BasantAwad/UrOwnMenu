# Template Briefs

Concrete designs for the templates that are not yet upgraded. Each brief takes
a **mechanism** from `docs/INSPIRATION.md` and rebuilds it from the venue's own
world, so none of these is a copy of a reference. They are written to be handed
to a coding AI one at a time.

Read `docs/AI_BUILDER_PLAYBOOK.md` first. The finished example to match in
quality is **Ingredient Story** (`src/templates.tsx` + `src/story.css`).

All fonts are free (Google Fonts). All colours are starting tokens; the owner's
palette still maps onto `--bg --surface --ink --accent` via `paletteVars`.
Every brief obeys the same data rule: **only owner data**. No invented
ingredients, prices, claims or reviews.

---

## How to hand a brief to another AI

Paste this, then paste one brief below it.

```
You are upgrading ONE template in the UrOwnMenu repo (React 19 + Vite, apps/web).

Read first, in order:
  1. docs/AI_BUILDER_PLAYBOOK.md   (the loop, the harness, image rules, depth recipe)
  2. docs/DESIGN_SYSTEM.md         (tokens, palettes)
  3. the finished example: IngredientStory in apps/web/src/templates.tsx and src/story.css
  4. the brief below

Rules:
  - Work in the harness (node scripts/harness.mjs shoot <key> at 390, 820, 1440). Look at the PNGs.
  - Before code, write your token plan and ASCII wireframe, then attack it for default-looking choices.
  - Do not touch other templates. Put styles in a new src/<name>.css scoped to a root class.
  - Keep the template key and the TemplateRenderer contract unchanged.
  - Use owner data only. Missing photo, price, or description must look intentional.
  - Cutouts use filter: drop-shadow, never box-shadow. Nothing stretched.
  - Finish with the Definition of done checklist in the playbook, and attach screenshots.

Brief:
  <paste one section below>
```

Fill-in blank for a new template you invent:

```
Name / key:
Venue it suits:                    (a real kind of place, not "restaurants")
Mechanism taken from the reference: (what it DOES for the diner)
Object from the venue's world:      (the physical thing the menu becomes)
Single constraint:                  (one colour pair, one axis of motion, one material)
Signature moment:                   (the thing someone describes to a friend)
Palette (4-6 hex, named):
Type (roles + families):
Wireframe (ASCII, mobile + desktop):
Depth / light rule:
Motion: trigger, start, end, easing, duration, reduced-motion behaviour
Data rules and fallbacks:
Reject if:
```

---

## 1. Orbital Menu → "Lazy Susan"

**Key:** `orbital-menu` · **Suits:** shared-plate places (Chinese, mezze, tapas, dim sum)

**Mechanism taken:** the Wove ring and the food wheel make choosing feel like
turning something. **Object:** the rotating tray at the centre of a shared
table. **Constraint:** one axis of motion (rotation), one light.

```
 desktop                                    mobile
 +--------------------------------------+   +-----------------+
 |  Category tabs (text, left)          |   |  tabs (scroll)  |
 |                                      |   |                 |
 |        .--- plate ---.               |   |   ( plate )     |
 |      /   plate   plate \   <- ellipse|   |  ( plate )( pl )|
 |     |  plate  [ACTIVE]  |    seen at |   |      [ACTIVE]   |
 |      \   plate   plate /     ~62deg  |   |   name  price   |
 |        '--- plate ---'               |   |   description   |
 |   active dish name, price, text -->  |   +-----------------+
 +--------------------------------------+
```

- **Geometry:** items sit on a circle in a 3D-tilted plane (`rotateX(62deg)`,
  `perspective: 1400px`). Plates nearer the viewer are larger and sharper;
  far plates smaller, dimmer, slightly blurred (real depth, so blur is earned).
- **Table:** a wooden or lacquer disc (CSS conic + radial gradients, no image),
  a thin rim highlight, and a soft cast shadow on the tablecloth below.
- **Active item** rests at the bottom-front. Its copy sits beside the table,
  not on it.
- **Palette:** `#16231F` deep jade, `#E9DCC3` rice paper, `#B5452B` lacquer red,
  `#C9A24B` brass, `#0C1512` shadow.
- **Type:** Young Serif (names), Hanken Grotesk (body). Prices in tabular figures.
- **Light:** one overhead lamp; a warm radial on the table, strongest at centre.
- **Signature moment:** drag or swipe turns the tray with inertia and a tiny
  overshoot; the dish that arrives at the front lifts 8px as it settles.
- **Motion:** trigger drag, wheel, arrow keys. Rotation by a spring
  (`stiffness 120, damping 18`); snaps to the nearest item on release. Reduced
  motion: no inertia, instant snap, and a visible Previous/Next pair.
- **Wove-style thin ellipse** is used once, only as the category index above
  the table, with the active category as the single bright marker.
- **Fallbacks:** under 5 items, plates are placed on a smaller arc and the rest
  of the table is empty and still looks like a table. No photo: the generated
  plate (`GeneratedPlate`).
- **Reject if:** plates float on a flat ellipse with no table; the ring is a
  decorative line unrelated to what rotates; every plate is the same size.

---

## 2. Ingredient Universe → "Apothecary Cabinet"

**Key:** `ingredient-universe` · **Suits:** juice bars, tea rooms, herbal and
health cafés, anywhere ingredients are the product

**Mechanism taken:** rotating drink with floating ingredients. **Object:** a
labelled specimen cabinet. **Constraint:** everything sits on a shelf plane.

```
 +-----------------------------------------------+
 | cabinet frame (wood grain via CSS)            |
 | +-------+ +-------+ +-------+ +-------+       |
 | | jar   | | jar   | | jar   | | jar   |  shelf 1 = category 1
 | | label | | label | | label | | label |       |
 | +=======+ +=======+ +=======+ +=======+  <- shelf plane, shadow beneath
 | +-------+ +-------+ +-------+                 |
 | ...                                  shelf 2  |
 +-----------------------------------------------+
   tap a jar -> it lifts out, rotates, and its drawer opens:
   name, price, description, owner-listed ingredients as small specimen cards
```

- Each **item is a jar or bottle** shape (CSS, clipped, glass highlight). The
  item's cutout photo, if any, sits inside it; otherwise the generated plate
  is replaced by a coloured liquid fill derived from the item's `main_ingredient`
  hue (`proceduralMacro` hue map).
- **Ingredients** come only from the owner's `ingredients` field. Each is a
  specimen card pinned beside the opened jar with a thin leader line.
- **Palette:** `#E8E0CF` paper label, `#2B3A2F` pine, `#7A8B5C` sage glass,
  `#B8432F` wax seal, `#1B1A17` shelf shadow, `#D9B35E` brass hinge.
- **Type:** Newsreader (labels, with optical sizing), Atkinson Hyperlegible
  (body, high legibility on small cards).
- **Light:** a window from the upper left; glass highlights and shelf shadows
  all fall to the lower right.
- **Signature moment:** tap a jar, it lifts out, turns 180 degrees, the label
  swings round to the menu text.
- **Motion:** shared-element transition (`layoutId`) from shelf to detail,
  420ms, `cubic-bezier(.2,.8,.2,1)`. Reduced motion: cross-fade 120ms.
- **Fallbacks:** no ingredients listed → show only name, price, description and
  no specimen cards (do not invent). More than 4 items per shelf → shelves
  scroll horizontally with a visible edge fade.
- **Reject if:** ingredients float randomly with no shelf or leader line; any
  ingredient shown that the owner did not enter.

---

## 3. Editorial Showcase → "Cover Story"

**Key:** `editorial-showcase` · **Suits:** fine dining, wine bars, tasting menus

**Mechanism taken:** aesthetic hero first, menu second. **Object:** a magazine
cover that you walk through. **Constraint:** one oversized masthead, one hero.

```
 hero (100svh)                    then: the menu
 +---------------------------+    +-----------------------------+
 |  R  E  S  T  O            |    | Course name (set large)     |
 |   [ dish cutout overlaps  |    | item ........ price         |
 |     two masthead letters, |    | description                 |
 |     letters behind & in   |    |                             |
 |     front of the dish ]   |    +-----------------------------+
 |  cover line, season       |
 +---------------------------+
```

- The **venue name** is the masthead, set at 22 to 30vw. The hero dish is placed
  so it overlaps the letters: one letter is **in front** of the dish (a second
  copy of the letter clipped by the dish's alpha via CSS mask), the rest behind.
  This interleave is the whole idea; do it exactly or choose another hero.
- Below: a normal readable menu in two columns on desktop. Item names large,
  prices right aligned in tabular figures, descriptions at 60ch.
- **Palette:** `#F3EFE8` is banned here (too default). Use `#E6E1D6` bone with
  `#0F3D3E` deep teal ink, `#C8553D` poppy as the only accent, `#1A1A1A` text,
  `#BFB8A8` rule.
- **Type:** Playfair Display is banned (default). Use **Bodoni Moda** for the
  masthead and names, **Public Sans** for body.
- **Light:** soft top-left; dish gets a cast shadow onto the bone ground.
- **Signature moment:** on load the masthead letters rise 6% while the dish
  settles from slightly larger to final size over 900ms, once.
- **Motion:** single page-load sequence only; nothing else animates on scroll.
  Reduced motion: final state immediately.
- **Fallbacks:** no hero photo → masthead alone with a large generated plate
  overlapping it; venue name longer than 14 characters → set on two lines,
  `fitVw` like the Story word.
- **Reject if:** the dish simply sits under a headline; two-column layout with
  hairline rules everywhere (the broadsheet default).

---

## 4. Endless Table → "Long Table"

**Key:** `endless-table` · **Suits:** family-style, trattorias, communal tables

**Mechanism taken:** continuous scrolling menu. **Object:** a very long table
seen from above that you walk along. **Constraint:** one scroll axis, plates
placed as on a real table.

```
 scroll down = walk the table
 +------------------------------+
 |  ===== tablecloth ========   |
 |   [place card: Starters]     |
 |        (plate)   (plate)     |
 |   (plate)                    |
 |   [place card: Mains]        |
 |     (plate)    (plate)       |
 |  ============================|
 +------------------------------+
```

- Plates are seen **top-down**, placed with small random-but-seeded offsets and
  rotations (seed from the item id, so it is stable). Cutout photos work best
  top-down; a side-on dish must be flagged and gets the framed treatment.
- **Place cards** (folded paper cards) are the category headings. Item text sits
  on a small napkin or card beside each plate.
- **Tablecloth:** a woven texture from two repeating gradients, with a runner
  stripe down the middle in the accent colour.
- **Palette:** `#F1E7D3` linen, `#9C3B2E` brick, `#3E5B4A` olive, `#2A2118` oak,
  `#D6A84F` candle.
- **Type:** Bricolage Grotesque (names), Literata (descriptions).
- **Light:** a candle at one end; plates nearer it are warmer.
- **Signature moment:** the table scrolls slightly slower than the page (a 0.85x
  parallax) while the plates drift, so it feels like walking beside it.
- **Reduced motion:** normal scroll, no parallax.
- **Fallbacks:** one item → one plate centred with a full place setting drawn
  in CSS; no photos → generated plates, which are already top-down capable.
- **Reject if:** plates form a CSS grid with equal spacing; cutouts are cropped.

---

## 5. Magazine → "Riso Zine"

**Key:** `magazine` · **Suits:** street food, burger joints, bars, youth venues

**Mechanism taken:** page-turn magazine. **Object:** a two-colour risograph
zine. **Constraint:** two inks plus paper, nothing else.

```
 spread (desktop)                       mobile: one page at a time
 +-------------+--------------+         +-------------+
 | big halftone|  CATEGORY    |         | halftone    |
 | dish, ink A |  item  price |         | dish        |
 |  slightly   |  text (ink B)|         |  item price |
 |  misregistd |              |         +-------------+
 +-------------+--------------+
```

- **Two inks:** every photo becomes a duotone (ink A shadows, paper highlights)
  with **halftone dots** via CSS `radial-gradient` mask or an SVG filter. Ink B
  text sits slightly misregistered (1 to 2px offset) against ink A shapes.
- **Fold:** a centre gutter shadow and a subtle page-curl shading on the turning
  page. Turning uses a 3D `rotateY` with `transform-origin` at the spine.
- **Palette:** paper `#F2EBDD` is banned; use `#EFE6D2` newsprint only if the
  inks are strong. Ink A `#E4572E` (flame), ink B `#1E3A8A` (blueprint),
  overprint `#4B2A5A` where they overlap (`mix-blend-mode: multiply`), paper
  `#EFE6D2`.
- **Type:** Rubik Mono One for headings only, **Space Grotesk is banned**; use
  **Familjen Grotesk** for body, plus hand-set price tags.
- **Signature moment:** drag the corner and the page folds with the duotone
  inks showing through the back.
- **Motion:** drag with pointer; 3D rotate, 600ms settle,
  `cubic-bezier(.3,.7,.2,1)`. Reduced motion: horizontal swipe, no 3D, instant.
- **Fallbacks:** no photo → large halftone pattern in the item's ink pair; one
  item per page is acceptable; odd page count leaves a quiet inside cover.
- **Reject if:** colours are more than two inks plus the overprint; photos are
  left in full colour; page turn works only with buttons.

---

## 6. Floating Gallery → "Hanging Mobile"

**Key:** (new) `floating-gallery` · **Suits:** modern cafés, dessert bars, galleries

**Mechanism taken:** floating gallery of dishes. **Object:** a Calder-style
hanging mobile. **Constraint:** everything hangs from a thread.

```
        |
     .--+--.            each arm balances; items hang on threads
   --o-----o--          tap an item: its thread shortens, it swings to the
   |         |          front and its label drops from it
  (dish)   --+--
          (dish)(dish)
```

- Arms are thin lines (`border` or SVG), threads vertical, items hang by their
  top centre. A gentle **pendulum sway** (CSS, 5 to 8 degree amplitude, offset
  phases by item id) sells the weight.
- Categories are separate mobiles; swipe sideways between them.
- **Palette:** `#F7F3EE` is banned. Use `#D9E4E1` mist, `#143642` deep sea,
  `#E86A4F` coral, `#F2B33D` marigold, `#2B2B2B` wire.
- **Type:** Fraunces is the Story template's; use **DM Serif Display** for names,
  **Albert Sans** for body.
- **Light:** soft, from above; each item casts a small shadow onto a back wall
  that moves slightly opposite to the item (shadow parallax).
- **Reduced motion:** no sway; arms and items are static but still hang.
- **Fallbacks:** under 3 items, one arm only; no photo → a coloured disc.
- **Reject if:** items just float with no thread or arm.

---

## 7. Bento Table

**Key:** (new) `bento-table` · **Suits:** Japanese, Korean, lunch boxes, set meals

**Mechanism taken:** bento grid. **Object:** a real lunch box with compartments.

```
 +----------------------------------+
 | +---------+ +------+ +----------+ |  one box = one set menu or category
 | | main    | | side | | side     | |  compartments differ in size and shape
 | |         | +------+ +----------+ |  because the food does
 | +---------+ +------------------+  |
 |            | rice             |  |
 |            +------------------+  |
 +----------------------------------+
   lid slides off on first scroll
```

- Compartments are **different sizes and corner radii** by role (rounded
  corners for rice, square for main), with a dividing wall that has real
  thickness (inner shadow plus top highlight).
- **Palette:** `#1F1A17` lacquer, `#C23B22` vermilion, `#EDE6D6` rice,
  `#6B7F3A` matcha, `#C9B79C` bamboo.
- **Type:** Shippori Mincho (names, supports kanji if the owner uses it),
  Zen Kaku Gothic New (body).
- **Signature moment:** the lid, a shaded slab, slides aside 480ms on first
  scroll, revealing the compartments with a 60ms stagger.
- **Reduced motion:** lid already open.
- **Reject if:** equal-size rounded cards (the SaaS bento).

---

## 8. Chef's Story → "Kitchen Pass"

**Key:** (new) `chefs-story` · **Suits:** open-kitchen restaurants, chef-led venues

**Mechanism taken:** story-led menu. **Object:** the order rail above the pass,
with printed tickets. **Constraint:** everything is a ticket.

```
 |  |  |  |  |  |   <- rail with clips
 +--+ +--+ +--+
 |T1| |T2| |T3|     each ticket = a dish; torn top edge, monospace-free
 | name  price |     typewriter look from a real face, not a "tech mono"
 | the owner's |
 | own note    |
 +----+  tickets overlap and curl slightly
```

- The **owner's chef note** per item (the existing description field) is the
  story. If the owner wrote none, the ticket shows only name and price; never
  generate a backstory.
- Ticket paper is a thin grey-cream with a perforation edge (`mask`), faint
  thermal-print fade at the bottom.
- **Palette:** `#26282B` steel pass, `#E9E4D6` ticket paper, `#D64933` order red,
  `#1B1D1F` ink, `#8E9AA3` rail.
- **Type:** **Special Elite** for ticket text (a typewriter, not a code font),
  **Archivo Narrow** for names and prices.
- **Signature moment:** tickets print: slide down from the rail, one after
  another at 90ms, on first view only.
- **Reduced motion:** tickets present from the start.
- **Reject if:** fake kitchen jargon, fake order numbers presented as real data.

---

## 9. Tasting Journey → "Transit Line"

**Key:** (new) `tasting-journey` · **Suits:** tasting menus, flights, omakase, wine pairings

**This one is a true sequence, so numbering is correct here.** It is the one
template where numbered stops belong.

```
 mobile (vertical line)           desktop (horizontal scroll or diagonal)
  o 1  Amuse                       o---o---o---o---o---o
  |    name  text                  1   2   3   4   5   6
  o 2  First course                active stop opens a card below
  |
  o 3  ...
```

- A route line with **stations**, like a transit map. Each course is a stop; the
  line colour changes by section (starters, mains, dessert).
- A "you are here" marker follows scroll position; passing a stop fills it.
- **Palette:** `#0E2A47` night, `#F4F1E8` is banned; use `#E8E1CE` ticket,
  `#F25C54` line red, `#2EA7A0` line teal, `#F7B32B` line amber, `#0A1A2E` deep.
- **Type:** **Fira Sans Condensed** for station names, **Source Serif 4** for text.
- **Signature moment:** the line draws itself as the diner scrolls (stroke-dashoffset
  tied to scroll progress).
- **Reduced motion:** the full line is drawn from the start.
- **Fallbacks:** under 3 courses → a short line with a "terminus" marker.
- **Reject if:** numbers on a non-sequence menu.

---

## 10. Minimalist → "Specimen Ledger"

**Key:** (new) `minimal-ledger` · **Suits:** specialty coffee, natural wine, small plates

**Mechanism taken:** minimal menu with refined interaction. **Object:** a typeset
ledger where the **type itself** is the image. **Constraint:** one typeface, one
ink, one accent.

```
 Aeropress ....................... 38
 Cortado .......................... 42      <- hover/focus a row:
 Flat white ....................... 44         the item's photo follows the cursor
 Pour over ........................ 52         in a small tall slit; the row's weight
                                               animates on a variable font axis
```

- One **variable font** (e.g. Fraunces is taken; use **Recursive** or **Roboto Flex**
  or **Anybody**) whose `wght` and `wdth` axes animate on hover and as a scroll
  scrubber across rows.
- Leader dots are real (`border-bottom: dotted`), not hairlines; prices in
  tabular figures aligned on the right.
- **Palette:** `#ECEAE4` paper, `#1C1C1A` ink, `#2F5D50` the only accent (focus
  and active row). Everything else is ink at 55% and 25%.
- **Signature moment:** the cursor-follow image reveal. On touch, tap opens an
  inline photo under the row.
- **Reduced motion:** weight changes instantly; image reveal still works.
- **Fallbacks:** no photo → the row still reacts with the weight change.
- **Reject if:** an image grid; a hero; any decoration.

---

## 11. Layer Exploded View → "Anatomy"

**Key:** (new) `anatomy` · **Suits:** burgers, sandwiches, layered desserts, cocktails

**Mechanism taken:** sauce/layer exploded view. **Object:** a technical
exploded-view drawing, scrubbed by scroll.

```
 scroll scrubs the explosion
   assembled   ->   layers separate vertically with leader lines
   [bun]            ---- bun        (owner-entered ingredient)
   [patty]          ---- patty
   [cheese]         ---- cheese
   [bun]            ---- bun
```

- Works **only when the owner enters ordered ingredients** per item. If there is
  no ordered list, the item shows assembled with no explosion (do not guess
  layers, and do not invent ingredients).
- Layers are the owner's cutouts if they provided layer photos; otherwise
  procedural CSS layers coloured from the ingredient hue map.
- **Palette:** `#EEE9DD` blueprint paper is banned; use `#13222B` ink-blue
  ground, `#E8E2D0` line, `#F2994A` amber, `#7FD1AE` mint highlight.
- **Type:** **Barlow Condensed** for labels, **Manrope** for text.
- **Signature moment:** scroll progress maps to layer separation with leader
  lines and labels appearing in sequence.
- **Reduced motion:** exploded state shown statically.
- **Reject if:** fake layers, fake ingredients.

---

## 12. Seasonal Storyboard → "Contact Sheet"

**Key:** (new) `contact-sheet` · **Suits:** seasonal menus, pop-ups, weekly specials

**Mechanism taken:** seasonal storyboard. **Object:** a film contact sheet with
frames, grease-pencil marks and a selected frame.

```
 +----+----+----+----+
 | 1  | 2  | 3  | 4  |   frames are the owner's items; a red grease-pencil
 +----+----+----+----+   circle marks "this week's pick" if the owner flagged one
 | 5  | 6  | 7  | 8  |   tap a frame: enlarges like a loupe over the sheet
 +----+----+----+----+
```

- Film edge with sprocket holes (CSS mask) and frame numbers. **Frame numbers are
  allowed because contact sheets are numbered.**
- A "season" heading uses the owner's season label only.
- **Palette:** `#1A1A1C` film base, `#C9B28A` amber edge print, `#E04E39`
  grease pencil, `#F0E8D8` highlight, `#6E7C86` steel.
- **Type:** **Oswald** for edge print, **Newsreader** for text.
- **Signature moment:** the loupe.
- **Reject if:** a generic photo grid with a film-strip icon.

---

## 13. 3D Gallery → "Vitrine"

**Key:** (new) `vitrine` · **Suits:** patisserie, chocolatiers, cake shops

**Mechanism taken:** 3D gallery. **Object:** a glass display case with a turntable
shelf. **Constraint:** real perspective on a few items, not a full 3D scene.

- CSS 3D (`perspective`, `rotateY`) on a glass box: front panel with reflections
  (`linear-gradient` bands), a brass base, a spot light from above.
- One item at a time rotates on a turntable; others wait in the cabinet.
- **Palette:** `#1C1417` velvet, `#E7C9A0` champagne glass, `#B76E79` rose gold,
  `#F5EFE6` is banned; use `#EBD9C2` cream tag, `#7A2E3B` raspberry.
- **Type:** **Cormorant Garamond** is the default fine-dining look; use
  **Gloock** for names and **Figtree** for text.
- **Signature moment:** the glass catches the light as you turn the item; the
  reflection band slides across the front panel with the rotation angle.
- **Reduced motion:** no turntable; a Previous/Next control with a cross-fade.
- **Fallbacks:** only works well with cutouts; otherwise use framed photos in
  the case (arch frame) and drop the turntable.
- **Reject if:** a heavy WebGL dependency for a menu.

---

## Upgrade notes for templates that exist

### Café Pedestal (`cafe`)
- Make the pedestal a real object: top face (ellipse with highlight), side
  (gradient), and a floor contact shadow tied to the same light as the dish.
- Plinths vary in height by price rank so the shelf has rhythm.
- Check each cutout with `normaliseCutout`; apply one `autoEnhance` strength to
  the whole set.

### Mosaïque (`mosaic`)
- Tile sizes follow the image ratio, not a fixed grid; use `photo_meta` focal
  point for crops. A tile with no photo becomes a typographic tile with the item
  name set to fill it, not a grey box.
- Stagger the grid so no two tiles of the same size touch.
- Grade all tiles with one `autoEnhance` strength and a shared duotone shadow
  tint so the mosaic reads as one print.

---

## Choosing palettes and fonts so templates do not look alike

Each template above has its own pairing. Keep these rules when you adapt one:

- No two templates share the same display face.
- No template uses `#F4F1EA` cream with a terracotta accent, or near-black
  with acid green.
- If the owner's palette is applied, only `--accent` and `--bg` change; the
  type pairing and the signature moment stay.

## Build order (highest return first)

1. Orbital Menu → Lazy Susan (most visible, already broken)
2. Ingredient Universe → Apothecary Cabinet (broken in the same way)
3. Editorial Showcase → Cover Story
4. Magazine → Riso Zine
5. Endless Table → Long Table
6. Café Pedestal and Mosaïque upgrades
7. New templates in the order the owners ask for them
