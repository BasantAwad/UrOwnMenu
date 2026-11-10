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

## Recommendation inputs

Menu type, item/category count, photo coverage and quality, owner mood, story enabled, course-based flag, preferred orientation, mobile QR emphasis. Recommend up to three with reasons: drink plus confirmed ingredients -> Ingredient Universe; pizza and round photography -> Orbital; fine dining restrained palette -> Minimalist/Editorial; large photo-rich menu without landing -> Endless Table; bakery seasonal story -> Menu Magazine. Owner always decides.

## Shared requirements

Long text, missing photos, one item, many items, hidden price, variants, owner-provided dietary notes, QR/mobile use, reduced motion, keyboard, screen reader, loading/error/empty states, and fast readable fallback.
