# FINAL MASTER IMPLEMENTATION PROMPT — UrOwnMenu

Repository: https://github.com/BasantAwad/UrOwnMenu
Budget: $0 total. Owner has no payment card. No paid APIs, trials, subscriptions, mandatory billing, automatic upgrades or paid fallback.

You are the senior product architect, creative director, interaction/motion designer, frontend/backend engineer, database engineer, AI integration engineer and QA lead. Before coding, inspect the whole repository and read every document in docs/, especially PRODUCT_SPEC.md, INSPIRATION.md, DESIGN_SYSTEM.md, TEMPLATES.md, MOTION_AND_INTERACTION.md, ARCHITECTURE.md, DATABASE_SCHEMA.md, AI_MEDIA_PIPELINE.md, MODEL_CATALOG.md, DEPLOYMENT.md and ROADMAP.md. Preserve every original inspiration URL. The Wove screenshot is attached in the original product conversation; if it is not in your workspace, use INSPIRATION.md and ask for the image only if exact visual inspection is essential. Pinterest short links may be inaccessible; never hallucinate what they show.

## 1. Product vision
UrOwnMenu is a multi-tenant menu website builder for restaurants, cafés, coffee shops, juice bars, bakeries, dessert shops, pizzerias, burger places, fine dining and food trucks. Owners upload restaurant information, logo, brand palette, menu categories, item names, descriptions, prices and clear photos; select a creative template; preview; and publish a mobile-first menu site with shareable URL and QR.

The differentiator is food-aware art direction: composition, proportion, image dimensions, depth, lighting, typography, whitespace, precise geometry and smooth purposeful motion. This must not look like generic repeated cards. Some clients want aesthetic landing page then conventional menu; some want no landing page and an immersive continuous scroll; some want magazine spreads; others want orbital dishes or drinks with floating ingredients.

## 2. Absolute financial constraint
Owner has $0 and no card. Never request card details, enable paid billing, auto-upgrade, use trial credits as a production plan, or depend on paid APIs. If signup/product activation unexpectedly asks for a card, stop and report; do not bypass or enter fake details. AI is optional; core menu works without it. Respect quotas and fail gracefully. Never claim free tiers are permanent.

Use free-first stack from ARCHITECTURE.md and DEPLOYMENT.md:
- React + TypeScript + Vite static frontend -> Cloudflare Pages.
- TypeScript Hono API -> Cloudflare Workers Free.
- Cloudflare D1 SQLite + Drizzle ORM.
- Cloudflare R2 Standard for images.
- Better Auth with D1-compatible adapter.
- Workers AI only for models confirmed free on this account.
- Browser Canvas/Web Workers and optional small commercially cleared ONNX model for media processing.
- GitHub for source control.
No MVP dependency on Next.js SSR, Vercel, Supabase, Neon, Render, FastAPI hosting, paid inference, GPU host, paid email or custom domains. These may be future migration options only.

## 3. Inspiration — inspect before designing
Read docs/INSPIRATION.md and retain every exact URL:
- Wove mobile screenshot / https://wove.com/ — pale monochrome, elliptical orbit, active marker, large numbered section, negative space. Inspiration for spatial navigation; don't copy identity.
- Food orbit: https://i.pinimg.com/1200x/a6/a3/df/a6a3df148804d2b961da16495f5f1f46.jpg
- Rotating drink + floating ingredients: https://pin.it/6cUOzJgzo
- Aesthetic hero: https://pin.it/2q7qgf3Sr ; https://pin.it/77FSUiu6H ; https://pin.it/2QTrkOGyS
- Continuous scrolling menu: https://pin.it/f0Ykn7XLS ; https://pin.it/7swRilPDK
- Magazine/page-turn: described by owner, no URL.
Inspect if accessible. Pinterest can redirect or require login; don't invent inaccessible visuals. Links are inspiration only, not assets to hotlink or copy.

## 4. Branding, logo and palette
Separate UrOwnMenu platform identity from each restaurant's identity. Platform may use restrained placeholder wordmark until approved. Client logo: upload/preview/replace/remove; primary/light/dark/icon variants; transparent PNG/WebP; SVG only if sanitized server-side (otherwise reject). Contain-fit; never stretch, crop or recolor by default. Preserve original, create optimized derivative, preview on light/dark backgrounds, show contrast warning. If absent, use restaurant name as typographic wordmark, not fabricated emblem.
Implement semantic CSS tokens: primary, secondary, accent, page background, surface, elevated surface, primary/secondary/muted text, border, overlay, focus. Include all palettes in DESIGN_SYSTEM.md: Espresso & Cream, Tomato & Parchment, Midnight & Champagne, Pistachio & Vanilla, Citrus Pop, Ocean Glass, Black & Bone, Berry & Blush. Editable custom colors, contrast checking and real-menu preview. Logo color extraction only proposes palettes; owner chooses. Never auto-recolor logo. Support Arabic/RTL and proper font fallbacks.

## 5. Templates — truly distinct experiences
Versioned template registry; Zod-validated configuration; templates consume normalized menu data + theme tokens. Switching templates must never lose content.
1. Editorial Showcase: cinematic hero, restaurant identity, short statement, signature dish, clear Explore Menu, optional story, categories and full menu.
2. Orbital Menu: pizza/burgers/donuts/round dishes. Active item moves to focal area; description and price in stable panel. Horizontal, vertical, centered variants; real ellipse geometry.
3. Ingredient Universe: central drink/glass or plate; owner-confirmed ingredient cutouts in front/middle/back planes; connector labels, coherent perspective/light/shadows; stable deliberate motion, not random floating PNGs.
4. Endless Table: no mandatory landing; native editorial vertical scroll with alternating image/text, category chapters and category jump.
5. Menu Magazine: editorial spreads, page number, category tabs and page-turn/fold/slide transition; reliable 2D first, no unreadable physics. Mobile swipe/vertical spreads and accessible list fallback.
6. Floating Gallery: layered cutouts, controlled overlap, contact shadows, subtle parallax, anchored text.
7. Bento Table: asymmetric grid, variable tile size, accessible detail.
8. Chef's Story: founder/chef narrative woven with signature dishes; full menu one tap away.
9. Tasting Journey: numbered courses, owner-supplied notes, progress and jump navigation.
10. Minimalist Menu: typography-first, whitespace, price alignment and restrained imagery.
11. 3D Gallery: optional real spatial carousel; dynamically load; CSS/DOM fallback.
Future: Sauce/Layer Exploded View; Seasonal Storyboard.
Recommendation uses menu type, item count, photo coverage, mood, story preference, orientation and course-based setting; returns at most 3 reasons; owner decides.

## 6. Motion and wow factor
Motion is a design system, not random decoration. Every complex interaction specifies initial/final position, transform origin, dimensions, scale/rotation, depth plane, easing/spring, duration, stagger, trigger, interruption, responsive and reduced-motion behavior.
Use Motion for React by default; GSAP only for coordinated timelines; Three.js/R3F only for true 3D and dynamically imported; CSS transforms for lightweight 2.5D. Prefer transform/opacity.
Orbital formula: x=cx+rx*cos(theta), y=cy+ry*sin(theta). Compute radii from viewport and item bounds. Avoid text collisions. On selection rotate shortest path, move selected dish into focus, recede others, synchronize image/title/description/price/marker. Support tap, swipe/drag and keyboard. Autoplay off by default, pause on interaction.
Ingredient scene: central hero dominant; stable anchors, coherent light direction and contact shadows, connector lines; ingredients follow intentional paths; labels appear after objects settle. No crossing text/hero; simplify mobile.
Magazine: consistent hinge/origin/direction, never mirror text; 2D first; swipe/list fallback.
No scroll hijack, forced intro, hover-only information, endless auto-rotation, or animation blocking menu. Respect prefers-reduced-motion. Static fallback always.

## 7. Photo pipeline and moving objects
Preserve original immutably. Validate magic bytes, MIME, dimensions and size; normalize EXIF; create responsive WebP variants. Browser controls: crop, subject position, exposure, white balance, contrast, restrained sharpen.
AI photo processing optional and reviewable: quality/crop suggestion, alt-text draft, conservative enhancement, background removal only with a small browser-compatible commercially cleared model. Owner compares before/after and approves. Never assume wrapper license covers weights.
Moving levels:
- Level 1 MVP: transparent cutout + CSS 2.5D transform, controlled shadow, subtle parallax.
- Level 2: cautious depth layers/small displacement, flat fallback.
- Level 3 future: image-to-3D. One image cannot reveal hidden sides; mesh can hallucinate. Decorative only, explicit owner approval; never factual menu representation.
Disable image generation in MVP: it may alter dish identity, toppings, ingredients or quantity. If future generation is added, create background/campaign art separately while keeping real dish photo locked.

## 8. AI agents and Service Layer
No giant autonomous agent. Production MVP bounded tasks:
- Menu Copy Assistant: draft based only on owner facts.
- Menu Organizer: category/order suggestions.
- Template Recommender: deterministic rules first; AI may explain.
- Visual Review Assistant: optional vision suggestions for crop/quality/alt text.
- Media Preparation: deterministic browser code, not LLM.
Workers AI is optional first provider. Free allocation currently documented as 10,000 Neurons/day; model availability differs and some models require paid plan. Verify exact model/account eligibility. Candidate model IDs are not guarantees. No hosted Hugging Face inference dependency.
Strict Zod inputs/outputs, allowlisted tasks/model IDs, bounded prompts, timeouts, per-user/restaurant quotas, audit records, owner approval. No unrestricted shell/filesystem/SQL/publish tools. AI quota failure must not block menu CRUD or public menus.

## 9. Database, auth and security
Implement docs/DATABASE_SCHEMA.md and migrations/0001_initial.sql. Generate Better Auth D1 identity schema first; app migration references its user table (adjust if generated name differs). Do not hand-roll passwords.
Core entities: users/sessions; restaurants/memberships; brand profiles; menus/categories/items/variants; media assets/derivatives; story sections; site configs; immutable published versions; AI jobs; audit logs.
Money integer minor units + currency, never float. UUID IDs; ISO UTC times. Foreign keys/indexes. Every query tenant-scoped; every mutation server-authorized; never trust client restaurant_id. Verify assets belong to restaurant. Secure HttpOnly SameSite sessions, CSRF/origin checks, strict CORS, rate limits, server-side secrets. Public snapshots exclude private email/memberships/prompts/audit. No ordering/payments/customer data in MVP.

## 10. Owner dashboard and public site
Onboarding: register; create restaurant profile (name/slug/description/contact/address/currency/locale/timezone); upload logo/cover; choose palette; create menus/categories; add item name/description/photo/category/price; optional variants, owner-confirmed ingredients/allergens/dietary notes/tags/availability/featured; choose template; preview phone/tablet/desktop; enable/reorder story/chef/gallery/location/hours/contact/social; publish and generate QR.
Manual item entry first. CSV import later with mapping, preview, duplicate detection and validation. Do not require scraping or PDF extraction.
Public route anonymous, fast, mobile-first, full menu reachable, template-specific hero/story, optimized images and SEO from verified data only. Use shared platform path/subdomain; no custom domain purchase.

## 11. Publishing
Draft changes never alter live site until publish. Validate data/config/assets; serialize immutable versioned snapshot with checksum; write PublishedVersion and update restaurant published pointer atomically; cache/invalidate; retain rollback/unpublish. Preview authenticated/noindex. Public route reads snapshot only and never invokes AI.

## 12. Deployment
Follow docs/DEPLOYMENT.md: Vite static Pages, Hono Worker, D1, R2 Standard, optional Workers AI. Use pages.dev/workers.dev. Keep separate preview/prod resources. Include commands, migrations, bindings, .dev.vars.example, .env.example and troubleshooting. No secrets committed. If any provider asks for card, stop.

## 13. Implementation sequence
0. Audit repository, reconcile docs/stack, report plan.
1. Scaffold Vite React, Hono Worker, shared Zod contracts, Drizzle D1; local dev + health endpoint.
2. Better Auth + identity migration, signup/login/logout, tenant permissions and tests.
3. Restaurant profile, brand profile, logo upload, palettes, media validation/R2 adapter.
4. Menu/category/item/variant CRUD and image uploads.
5. Template registry, normalized contracts, gallery and preview.
6. Complete Editorial Showcase, snapshot publishing and public route, QR.
7. Orbital Menu geometry/motion.
8. Ingredient Universe 2.5D.
9. AI Service Layer interface, mock provider, optional free Workers AI, quotas and approval.
10. Endless Table and Menu Magazine.
11. Remaining templates, CSV, story sections, accessibility/performance.
Do not build every template at once. Keep app runnable after each vertical slice.

## 14. Quality gates
Test auth/session, tenant isolation, roles, upload validation, missing photos, long text, 1/many items, hidden prices, variants, unavailable items, Arabic/RTL, currencies, template switching, orbital no-overlap at phone/tablet/desktop, ingredient label collisions, magazine keyboard/swipe, reduced motion, focus/contrast/screen readers, WebGL/AI/network failure, AI quota/timeouts/approval, original preservation, draft privacy, snapshot rollback and free quota failure behavior.
Run lint, typecheck, unit/integration/Playwright. Update docs to reflect actual implementation only. Mark incomplete features honestly.

## 15. Working style and success definition
First provide repo audit + phased plan. Do not ask routine decisions; ask only for external credentials, recurring costs, card, irreversible data or scope. Never invent secrets or claim deployment without verification. Small coherent commits. Report changed files, tests, URLs only if verified, limitations and next step.
Success: restaurant owner can create branded menu with logo, palette, item photos/details, select genuinely distinct template, preview, publish and share online with no card or paid service; the result feels art-directed with excellent proportions, lighting, motion and typography.
