# Roadmap and Definition of Done

## Phase 0 — Audit and free-host validation
Inspect repository and reconcile all docs with the $0 stack. Verify Cloudflare signup and product activation do not ask for a card. Do not bypass payment prompts. Create a UI prototype for Editorial Showcase, Orbital and Ingredient Universe using owner-provided visual references. Exit: stack and no-card deployment path documented; no paid dependencies.

## Phase 1 — Foundation
React + TypeScript + Vite frontend, Hono Worker API, shared Zod contracts, Drizzle + D1, local development and health endpoint. Generate Better Auth identity migration. Exit: app runs locally and health endpoint works.

## Phase 2 — Auth and tenant model
Better Auth signup/login/logout, secure sessions, restaurant creation, owner membership, tenant authorization and tests. Exit: cross-tenant access tests pass.

## Phase 3 — Restaurant brand and menu studio
Restaurant profile, client logo upload, palettes, menus/categories/items/variants, image upload to R2, immutable originals. Exit: owner can manage a complete menu and brand.

## Phase 4 — First publication
Template registry, complete Editorial Showcase, preview, immutable published snapshots, public slug route and QR. Exit: owner-to-public menu works end to end; drafts do not mutate live menu; rollback works.

## Phase 5 — Signature experiences
Orbital Menu geometry/motion, Ingredient Universe 2.5D, Endless Table and Menu Magazine. Exit: distinct responsive templates work on real mobile devices and respect reduced motion.

## Phase 6 — Optional AI/media
Provider interface, mock provider, free-eligible Workers AI only after account/model test, quotas and approval; browser Canvas media tools; optional browser ONNX segmentation only after license/performance review. Exit: original retained, approval required, no paid fallback, graceful AI-off behavior.

## Phase 7 — Onboarding and expansion
CSV import, template recommendations, Bento, Floating Gallery, Chef's Story, Tasting Journey, Minimalist, optional 3D Gallery, story/gallery/hours/location/contact, Arabic/RTL.

## Phase 8 — Readiness
Security/privacy/accessibility review, data export/delete, backup process, quota monitoring, terms and image-rights guidance. Custom domains, payments and commercial billing only after owner has a budget and explicitly approves.

## Definition of done for every template
Normalized data; validated config; one/many items; long text; missing photos; variants and hidden prices; intentional desktop/tablet/mobile; keyboard/touch/screen reader/reduced motion; optimized responsive images; real-phone performance; static fallback; optional story sections; no clipped content or overflow.

## First implementation tickets
1. Audit and scaffold Vite/Hono/D1.
2. Better Auth schema and tenant authorization.
3. Restaurant and brand profile.
4. Logo upload and palette settings.
5. Menu/category/item/variant CRUD.
6. R2 media upload and validation.
7. Template registry.
8. Editorial Showcase.
9. Draft preview, publish snapshots, public menu and QR.
10. Owner-to-public E2E test.
11. Orbital Menu.
12. Ingredient Universe.
13. AI service abstraction and optional free model only after publication is working.
