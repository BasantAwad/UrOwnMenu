# Architecture and Data Model

## Stack

Next.js App Router, React, TypeScript, Tailwind/CSS variables; Motion for React, GSAP selectively, Three.js/R3F only for real 3D; Supabase PostgreSQL/Auth/Storage/RLS; FastAPI AI/media worker; Pillow/OpenCV; Zod/Pydantic; Vitest/Playwright/pytest. Deploy Next.js on Vercel and FastAPI on a separate Python-capable host. Begin as modular monolith plus worker; no microservice sprawl.

## Logical architecture

Owner -> Next.js Menu Studio -> Supabase Auth and server APIs -> PostgreSQL and object storage. Public visitor/QR -> Next.js public route -> template registry/renderer -> published snapshot and optimized image CDN. AI job table -> FastAPI worker -> pretrained providers and image operations -> derived media storage and job status.

## Suggested repository structure

apps/web/app/(marketing), (auth), studio, m/[restaurantSlug]; apps/web/features/{restaurants,menus,media,branding,templates,publishing}; services/ai-worker/app/{api,core,jobs,providers,pipelines}; packages/{contracts,template-kit,ui}; supabase/{migrations,seed.sql}; docs/.

## Template engine contract

Each versioned template declares id, version, supported menu types, configuration schema, capabilities (story, horizontal/vertical navigation, WebGL, reduced motion), and renderer component. It receives normalized restaurant/menu data, theme tokens, template configuration and accessibility preferences. It does not mutate menu content or fetch arbitrary data. Validate config with Zod.

## Publishing

Public page must not render mutable draft rows. Validate content/assets/config; serialize immutable snapshot; save PublishedVersion; transactionally update restaurant published pointer; invalidate cache; retain previous snapshot for rollback. Draft preview is authenticated and noindex. Public route reads published snapshot only.

## Security

Supabase RLS for all tenant data plus repeated server authorization. Never trust browser-supplied restaurant_id. Validate asset ownership before linking. Public fields are explicit allowlist. Validate uploads by content/MIME/size/dimensions; sanitize SVG; rate-limit auth/AI/upload/publish; keep keys server-side; audit publication and membership changes.

## Performance

Dynamically import template-specific motion/3D; do not ship Three.js to non-3D templates. Responsive images, modern formats, lazy load below fold, preload hero/selected only, pause offscreen motion, keep semantic HTML usable if animation fails, test mid-range Android and slow mobile networks.
