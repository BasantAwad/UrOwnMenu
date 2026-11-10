# UrOwnMenu

A zero-budget-first, template-driven platform that turns restaurant menus into distinctive, art-directed interactive websites.

## Vision
Restaurant owners create a profile, upload their logo, choose a palette, add menu items (name, description, clear photo, category and price), select a creative template, preview and publish a mobile-first menu website with shareable URL and QR. The differentiator is food-aware composition, proportion, depth, lighting, typography, whitespace and purposeful motion — not generic repeated cards.

## Read first
- docs/PRODUCT_SPEC.md
- docs/INSPIRATION.md — every original inspiration link and visual interpretation
- docs/DESIGN_SYSTEM.md — palettes, logo, typography and layout
- docs/TEMPLATES.md — template catalog
- docs/MOTION_AND_INTERACTION.md — geometry, motion, 2.5D/3D and accessibility
- docs/ARCHITECTURE.md — selected $0 stack and migration plan
- docs/DATABASE_SCHEMA.md — ER diagram and D1 schema
- migrations/0001_initial.sql — initial D1 migration
- docs/AI_MEDIA_PIPELINE.md — free-first AI Service Layer
- docs/MODEL_CATALOG.md — model candidates and license gates
- docs/DEPLOYMENT.md — no-card deployment strategy
- docs/ROADMAP.md
- docs/IMPLEMENTATION_PROMPT.md — final master prompt for coding agent

## Selected $0-first stack
React + TypeScript + Vite (Cloudflare Pages); Hono + TypeScript (Cloudflare Workers Free); D1 + Drizzle; R2 Standard; Better Auth; optional free-eligible Workers AI; browser Canvas/Web Workers and optional ONNX; Motion for React, GSAP selectively, Three.js only for optional true 3D; Zod, Vitest, Playwright.

No paid APIs, GPU host, FastAPI hosting, Supabase, Neon, Render, paid trials or custom domain required for MVP. Keep provider interfaces migration-ready for later FastAPI/Ollama or PostgreSQL/S3.

## Templates
Editorial Showcase, Orbital Menu, Ingredient Universe, Endless Table, Menu Magazine, Floating Gallery, Bento Table, Chef's Story, Tasting Journey, Minimalist Menu, 3D Gallery. Future: Sauce/Layer Exploded View and Seasonal Storyboard.

## Budget policy
No card, paid billing, auto-upgrade or paid fallback. Free quotas are limited and may change. If signup or activation asks for a card, stop. AI optional; public menu and CRUD work without AI. See docs/DEPLOYMENT.md.

## MVP exclusions
Ordering, checkout, payments, delivery, reservations, POS, inventory, loyalty, customer accounts and custom domains.

## Status
Documentation and architecture foundation. Implement in vertical slices; complete one owner-to-public-menu journey before expanding all templates.

Repository: https://github.com/BasantAwad/UrOwnMenu
