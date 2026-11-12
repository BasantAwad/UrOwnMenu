# Template Catalog and Visual Specifications

Templates are different visual systems, not color skins. All consume normalized menu data and must define desktop/tablet/mobile, touch, keyboard, reduced-motion, loading, empty, error, and static fallback states.

## 1. Orbital Menu

**Best for:** pizza, burgers, round plates, donuts, pastries, pancakes, signature dishes. A circular/elliptical orbit of products. Selected dish moves into a focal zone; description, title, price, category remain in a stable adjacent panel. Variants: horizontal orbit left/right, vertical orbit above/below, centered orbit. Select by tap/click, drag/swipe, keyboard arrows. Optional autoplay off by default and pauses on interaction. Calculate positions from ellipse geometry; selected item must not overlap text. Use scale/opacity/depth/z-order sparingly. Group or paginate large menus; never shrink dozens of nodes into unreadable ring.

## 2. Ingredient Universe

**Best for:** coffee, mocktails, juice, smoothies, specialty drinks, dishes with confirmed ingredients. Hero drink/glass/plate with ingredients on separate depth planes, labels and connector lines. Scroll/drag rotates composition; selecting ingredient highlights it; selecting another drink transitions hero and ingredient arrangement. Use 2.5D first. Stable anchor positions, coherent scale, perspective, lighting and shadows. Ingredients only from owner data or owner-approved suggestions. No random floating PNGs.

## 3. Editorial Showcase

**Best for:** premium restaurants, chef-led brands, modern cafés. Cinematic hero, brand statement, signature dish, optional story, then category navigation and full conventional menu. Choreographed image reveal, text stagger, subtle parallax, no forced scroll lock. Recommended first complete template.

## 4. Endless Table / Continuous Menu

**Best for:** photo-rich menus, clients who want no separate landing page. Native vertical scroll through editorial item sections with alternating image/text alignment, variable scale and category chapters. Active category indicator; compact scan/list mode. Never hijack scrolling.

## 5. Menu Magazine

**Best for:** cafés, bakeries, patisseries, seasonal and tasting menus. Editorial spreads, page numbers, category labels, images and details. Page turn/slide, click/tap page edge, keyboard, swipe. Mobile uses swipe or vertical spreads. Always offer category jump and accessible list fallback. Start with refined 2D page transition; realistic curl is optional.

## 6. Floating Gallery

**Best for:** desserts, drinks, casual dining, signature products. Layered product cutouts, controlled overlap, contact shadows and subtle parallax; text stays anchored. Swipe/drag selection; hover depth desktop-only.

## 7. Bento Table

**Best for:** mixed menus and smaller catalogs. Asymmetric editorial grid with varied tile sizes; featured status is owner-selected, never inferred. Tile opens detail panel/sheet; responsive reflow.

## 8. Chef's Story

**Best for:** chef-owned, family-run, identity-led venues. Narrative and chef/founder profile woven with signature dishes, while complete menu index remains one tap away.

## 9. Tasting Journey

**Best for:** set menus, degustation, seasonal courses. Course number, dish, description, owner-provided pairing notes and progress indicator. Step and native scroll navigation; jump to any course; do not imply fixed order unless configured.

## 10. Minimalist Menu

**Best for:** fine dining, modern cafés, typography-first brands. Typeset category/item lists, selective imagery, clear price alignment, whitespace, fast category switching and minimal motion.

## 11. 3D Gallery

**Best for:** few signature products. Spatial carousel, central focus, adjacent depth; drag/swipe/keyboard. WebGL failure falls back to CSS/DOM carousel; no device motion sensor requirement.

## 12. Future: Sauce / Layer Exploded View

For burgers, layered cakes, sandwiches, parfaits and specialty drinks. Ingredient layers separate along axis with owner-confirmed labels. Scrubber/selection reveals layers; static illustration fallback. Not a claim about exact recipe quantities.

## 13. Future: Seasonal Storyboard

Seasonal menus and limited collections. Visual chapters, full-bleed photography, seasonal palette, chapter rail desktop/vertical story mobile. Direct menu index always available.

## 14. Café Pedestal (built, from Drinko reference)

**Best for:** coffee shops, drink bars and juice spots. Plaster-sand hero pierced by huge white type with the signature drink staged on a stone plinth; pill category tabs selecting the visible set; cream product cards with white photo insets (whole image, never cropped); price and Signature mark; `More` toggle; pastel signature band at the foot. No cart and no invented discounts — the owner's data only.

## 15. Mosaïque (built, from AKME reference)

**Best for:** desserts, patisseries, drink brands with strong photography. A dark-gallery wall of square poster tiles in alternating grounds (camel, maroon, deep red, cream). Photo tiles stage the dish on a radial key light; text tiles carry folio numerals, serif name, description and price. Wordmark top corner; the featured tile carries a gold inner border.

## 16. Ingredient Story (built, owner-requested)

**Best for:** desserts and drinks. Every item is a full-viewport chapter whose background is macro photography of the item's **hero ingredient** — the owner marks it per item (`main_ingredient`, defaulting to the first listed ingredient; never inferred from pixels). Macro photography is resolved at publish time from Openverse (CC0/PDM/CC-BY/CC-BY-SA only) with Wikimedia Commons as a licensed fallback, stored in R2, and credited in the public footer. Layouts alternate between a full-bleed cover chapter and a split composition where the dish floats across the seam (the pistachio-macaron reference) with the ingredient name set across the divide.

## Recommendation inputs

Menu type, item/category count, photo coverage and quality, owner mood, story enabled, course-based flag, preferred orientation, mobile QR emphasis. Recommend up to three with reasons: drink plus confirmed ingredients -> Ingredient Universe; pizza and round photography -> Orbital; fine dining restrained palette -> Minimalist/Editorial; large photo-rich menu without landing -> Endless Table; bakery seasonal story -> Menu Magazine. Owner always decides.

## Shared requirements

Long text, missing photos, one item, many items, hidden price, variants, owner-provided dietary notes, QR/mobile use, reduced motion, keyboard, screen reader, loading/error/empty states, and fast readable fallback.

## 17. Art-direction layer (shared by every template)

Photographs are not dropped into fixed slots. Each stored image carries
measured facts (`photo_meta`: focal point, frame ratio, mean luminance,
contrast, coverage, treatment) and each template reads them:

- **Placement.** `object-position` follows the measured focal point, so a
  dish photographed low in frame stays visible in a `cover` crop.
- **Scrims.** Type over photography gets a band sized by measured luminance
  and contrast: `.is-dark`, `.is-mid`, `.is-bright` on the tile or frame. A
  dark plate needs almost no scrim; a bright one gets a taller, denser band.
- **Hero choice.** The leading image is the strongest photograph, not the
  first row in the database.
- **Cutouts.** `contain` in a transparent frame plus
  `filter: drop-shadow()`; never `box-shadow`, which would paint the
  rectangle. The pipeline normalises every cutout (trim, 90% fill, optical
  centre, feather, square pad) before storage, so the subject's visual size
  is consistent across templates.
- **No photograph.** A deterministic SVG plate study fills the slot: seeded
  from the item, tinted from the palette, transparent ground, `meet` scaling.
  It is linework on the page, not a card or a placeholder initial.
- **Missing media columns.** A course with no photo does not reserve the
  media column in the Editorial list; the name keeps the full width.

### Editorial Showcase specifics

- Hero media column ratio comes from the hero's frame (`--hero-text` /
  `--hero-media`).
- Signature row adapts to 1, 2 or 3+ featured items: one spans the page, two
  become an even pair, three or more use the asymmetric feature plus
  supporting rows.
- Chapter bands alternate ground and bleed to the viewport edges; a filled
  box inset by the menu padding would read as a floating white rectangle.
- Media frames position their image absolutely, so a portrait photograph is
  contained by the frame rather than setting its height.
