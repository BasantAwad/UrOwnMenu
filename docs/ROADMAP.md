# Roadmap and Definition of Done

## Phase 0 — Validate
Confirm first target segment, create prototypes for Editorial Showcase/Orbital/Ingredient Universe, test real menus/photos with owners, validate naming and scope.

## Phase 1 — Foundation
Next.js/TypeScript, Supabase auth/schema/RLS, restaurant profile, client logo upload, palette editor, menu/category/item CRUD, original media upload. Exit: owner can create restaurant and add items securely.

## Phase 2 — First publication
Template registry, semantic design tokens, complete Editorial Showcase or Minimalist Menu, public renderer, draft preview, immutable published snapshot, public slug, QR. Exit: owner-to-public menu works end to end; draft doesn't mutate live version; rollback works.

## Phase 3 — Signature experiences
Orbital Menu, Ingredient Universe 2.5D, Endless Table, mobile-specific layouts, keyboard/touch/reduced motion, real-device profiling. Exit: templates are genuinely distinct and usable.

## Phase 4 — AI/media
FastAPI worker, provider adapters, deterministic derivatives, quality analysis/crop/alt text, background removal, 2.5D cutout, owner review, optional generative scene edit after preservation testing. Exit: original retained, approval required, cost tracked, retries safe.

## Phase 5 — Onboarding and expansion
CSV import, template recommendations, Menu Magazine, Bento, Floating Gallery, Chef's Story, Tasting Journey, story sections, gallery, hours/location/contact, multi-language/RTL.

## Phase 6 — Commercial readiness
Custom domains/SSL, billing only after pricing validation, quotas, admin, backups, monitoring, privacy/terms/image rights/provider disclosures, accessibility/security review.

## Definition of done for every template
Uses normalized data; config schema validated; one/many item, long text, missing photo, variants and hidden prices handled; intentional desktop/tablet/mobile; keyboard/touch/screen reader/reduced motion; optimized responsive images; profiled animation on real phone; static fallback for WebGL/page effects; optional story sections; no overflow or clipped content.

## First tickets
1 Scaffold app and environment validation. 2 Supabase schema/RLS. 3 Auth/restaurant creation. 4 Logo and palette settings. 5 Menu/category/item CRUD. 6 Secure media upload. 7 Template registry. 8 First complete template. 9 Draft preview/publish snapshots. 10 Public menu and QR. 11 E2E owner-to-publication. 12 Orbital. 13 AI job service after publishing works.
