# UrOwnMenu

A template-driven platform that turns restaurant menus into distinctive, beautifully art-directed, interactive websites.

## Product vision

Restaurant owners add or import menu items, upload clear photos and their restaurant logo, choose a visual experience and brand palette, preview the result, and publish a mobile-first menu website with a shareable URL and QR code. This is not a generic menu builder made of identical cards. The differentiator is food-specific composition, typography, negative space, precise geometry, dimensional illusion, coherent photography, and smooth purposeful motion.

## Read first

- docs/PRODUCT_SPEC.md — product scope, roles, journeys, requirements, data.
- docs/DESIGN_SYSTEM.md — palettes, logo upload, typography, layout, image art direction.
- docs/TEMPLATES.md — all template concepts and behaviors.
- docs/MOTION_AND_INTERACTION.md — geometry, motion choreography, 2.5D/3D, accessibility.
- docs/AI_MEDIA_PIPELINE.md — self-hosted AI Service Layer, local models, image improvement, cutouts and AI safety.
- docs/MODEL_CATALOG.md — model shortlist, license checks, hardware notes and release gates.
- docs/ARCHITECTURE.md — stack, architecture, publishing, security.
- docs/ROADMAP.md — phases and acceptance criteria.
- docs/INSPIRATION.md — every original inspiration URL and visual interpretation.
- docs/IMPLEMENTATION_PROMPT.md — detailed prompt to give the coding agent.

## Recommended stack

Next.js App Router, React, TypeScript, Tailwind CSS and CSS variables; Motion for React; GSAP only for complex choreographies; Three.js/React Three Fiber only for true 3D; Supabase PostgreSQL/Auth/Storage/RLS; FastAPI AI Service Layer with Ollama/Pydantic AI for local pretrained models; Pillow/OpenCV and ONNX Runtime for deterministic/local processing; Zod, Pydantic, Vitest, Playwright, pytest. Begin as a modular monolith plus a separate AI/media worker, not a fleet of microservices.

## Initial template collection

Editorial Showcase, Orbital Menu, Ingredient Universe, Endless Table, Menu Magazine, Floating Gallery, Bento Table, Chef's Story, Tasting Journey, Minimalist Menu, 3D Gallery. Future concepts: Sauce/Layer Exploded View and Seasonal Storyboard.

## MVP

Owner creates a restaurant, uploads logo, chooses palette, creates menus/categories/items, uploads photos, selects a template, previews mobile and desktop, publishes a versioned menu, and shares URL/QR. AI is optional; original content remains usable without AI credentials. The target is self-hosted pretrained models rather than mandatory paid inference APIs.

## Scope boundary

Ordering, checkout, payments, delivery, reservations, POS, inventory, and loyalty are not part of v1. Do not generate arbitrary restaurant-specific source code. Render normalized content through versioned templates and validated configuration.

## Status

Documentation-first foundation. Implement in vertical slices. Finish one end-to-end owner-to-public-menu journey before expanding the template library.

Repository: https://github.com/BasantAwad/UrOwnMenu
