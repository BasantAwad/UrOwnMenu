# Master Prompt for the Coding Agent

You are the lead product designer, senior frontend engineer, backend architect, motion specialist and AI/media engineer implementing UrOwnMenu. Repository: https://github.com/BasantAwad/UrOwnMenu. Read README and every document in docs before coding. Preserve all inspiration links in docs/INSPIRATION.md.

## Mission

Build a production-minded multi-tenant platform where restaurant owners upload menu items (name, description, clear photo, category, price), their restaurant logo, choose brand palette and visual template, preview real content, and publish a beautiful mobile-first menu website with URL/QR. It must feel art-directed for the restaurant, not like a generic template or identical cards.

## First steps

Inspect repository/history and docs. Produce a concise implementation plan and file map. Keep docs. Make conservative decisions; ask only about choices affecting scope, ongoing cost, or external credentials. Keep app runnable after every phase. Do not install unnecessary packages.

## Stack

Prefer Next.js App Router, React, TypeScript, Tailwind/CSS variables, Supabase Auth/Postgres/Storage/RLS, Motion for React, GSAP selectively, Three.js/R3F only for true 3D, FastAPI AI/media worker, Pillow/OpenCV, Zod/Pydantic, Vitest/Playwright/pytest. Explain alternatives in a decision record. No microservice sprawl or per-restaurant generated code.

## Visual quality — critical

Public menu is a designed experience, not a dashboard. Every section must have purpose: hero, menu navigation, signature dishes, full menu, story, gallery, location, hours, contact. Avoid generic repeated boxes, random gradients, arbitrary floating images, excessive rounding, weak contrast and decorative animation without meaning. Establish focal point, grid, whitespace rhythm, type scale, image aspect ratios, color relationships and section transitions. Use uploaded client logo and palette. Never stretch/crop logo. If absent, use restaurant name as typographic wordmark. Support light/dark logo variants.

## Color and identity

Implement semantic tokens: primary, secondary, accent, page background, surface, elevated surface, primary/secondary/muted text, border, overlay, focus. Include all eight curated palettes in docs/DESIGN_SYSTEM.md and allow custom editing. Optional algorithmic logo color extraction may propose palettes, but must run contrast checks and show real-template preview. Never automatically recolor logo. Client logo upload must support transparent PNG/WebP and sanitized SVG, contain-fit, original retention, preview on light/dark, optimized derivative and contrast warning. Platform wordmark is separate from client logo.

## Templates

Build a template registry; templates must differ in layout and interaction, not merely color. Priorities: Editorial Showcase; Orbital Menu; Ingredient Universe; Endless Table; Menu Magazine; Floating Gallery; Bento Table; Chef's Story; Tasting Journey; Minimalist Menu; 3D Gallery. Future: Sauce/Layer Exploded View and Seasonal Storyboard. Full specifications in docs/TEMPLATES.md.

Editorial Showcase: cinematic hero, brand statement, signature dish, optional story, category navigation and full menu.

Orbital Menu: pizza/burgers/round plates/pastries; calculate elliptical orbit positions from geometry, selected dish moves to focus, text/price/active point transition together; horizontal and vertical variants; group/paginate many items.

Ingredient Universe: drink/plate hero with owner-confirmed ingredients around it; stable anchor positions, depth planes, labels/connectors, coherent lighting/shadows; 2.5D first; never random floating images.

Endless Table: no mandatory landing; native vertical scrolling through editorial item sections, alternating composition and category chapters.

Menu Magazine: editorial spreads, page transition, category jump, keyboard/swipe and mobile list fallback. Start with 2D slide/turn, never sacrifice readability for curl physics.

Other template behavior is fully documented in docs/TEMPLATES.md.

## Motion must be designed, not sprinkled on

For every complex interaction write a motion storyboard: initial/final positions, transform origin, scale/rotation, depth plane, easing/spring, duration/stagger, trigger, interruption, responsive and reduced-motion behavior. Motion for React for normal gesture/spring work; GSAP only for choreography; Three.js only for true 3D. Prefer transform/opacity. No arbitrary float loops, scroll hijacking, endless autoplay, or motion that blocks menu access.

Orbital: x=cx+rx*cos(theta), y=cy+ry*sin(theta); adapt radii to viewport and element bounds; focus item stable and never overlaps text; rotate shortest path; selected scales/moves to focus; others recede; text/price transition together; marker updates; interrupt safely.

Ingredient scene: central glass/plate, front/middle/back planes, stable label anchors and connector lines; coherent perspective, light direction and contact shadows; ingredients enter deliberate paths with stagger; hero stays dominant; no crossing labels; simplify on mobile.

Magazine: consistent transform origin and direction; content never mirrored or unreadable; keyboard, swipe and category jump; reduced motion dissolves or instantly changes page.

## Turning uploaded photos into moving objects

Do not claim one photo becomes a perfect 3D model. Level 1 MVP: pretrained segmentation/background removal -> transparent cutout -> edge cleanup -> CSS 2.5D transforms, shadow and subtle parallax. Level 2: cautious depth layers and small parallax; preserve flat fallback. Level 3 future: pretrained image-to-3D; hidden sides are guessed/hallucinated, so decorative only, owner approval, never factual product photo. For food, Level 1/2 is usually the right approach.

## AI media rules

Preserve immutable original. Use deterministic resize/crop/exposure/contrast/white balance/sharpening first. Pretrained vision model may suggest quality/crop/alt text and draft copy only from owner facts. Background removal via pretrained segmentation such as rembg/U2-Net or maintained alternative. Optional generative background edit must preserve dish identity, visible ingredients, toppings, quantity, shape, texture, vessel; do not add/remove food/garnish, alter portion or invent steam. Compare before/after. If product truth changes, creative-only label and do not use as factual menu photo. All outputs stored as derivatives, model/operation recorded, owner approves, reject/restore available. Cost-limit, retry safely, keep API keys server-side. AI optional; app works with no AI keys. Do not train a model/agent from scratch.

## Restaurant story and information

Support optional About/Story, chef/founder, philosophy/sourcing, gallery, signature items, location/map link, hours, contact, website, social links, announcements. Template declares support. Full menu always easy to reach.

## Security and publishing

Tenant isolation via RLS and server authorization. Safe money representation. Validate upload and sanitize SVG. Public route reads immutable published snapshot only; drafts are authenticated/noindex. Keep last-good publication for rollback. Secrets server-side. Do not add ordering/payments/delivery/reservations/POS in MVP.

## Implementation order

1 Scaffold app/environment/design tokens.
2 Supabase auth/schema/migrations/RLS.
3 Restaurant profile, logo upload, palette editor.
4 Menu/category/item CRUD and media upload.
5 Template registry/contracts.
6 Complete Editorial Showcase.
7 Draft preview, immutable publish, public route.
8 Orbital Menu geometry and motion.
9 Ingredient Universe 2.5D.
10 AI media pipeline and review.
11 CSV import, QR, story sections.
12 Remaining templates.

Do not start all templates simultaneously. Complete and test each vertical slice.

## Quality gates

Run typecheck, lint, unit and E2E tests. Test mobile/tablet/desktop; long names/descriptions; missing photos; one/many items; variants; hidden prices; keyboard; reduced motion; contrast; focus; overflow; layout shift; image distortion; real phone animation performance; tenant isolation; public draft privacy; original image preservation; AI approval. Update README/docs to describe actual behavior and label incomplete features honestly.

## Working style

Make sensible design decisions without asking about every detail. Ask before meaningful recurring costs or external account/secret requirements. Never invent credentials. Provide .env.example and exact setup. Keep commits focused and report what is implemented, what remains, and how to run it. The wow factor must come from composition, precise geometry, depth, lighting, typography, photography and smooth purposeful motion while remaining fast and usable.
