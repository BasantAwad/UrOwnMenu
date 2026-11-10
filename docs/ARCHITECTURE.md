# Architecture and Data Model

## Stack

Next.js App Router, React, TypeScript, Tailwind/CSS variables; Motion for React, GSAP selectively, Three.js/R3F only for true 3D; Supabase PostgreSQL/Auth/Storage/RLS; FastAPI AI Service Layer and worker; Pillow/OpenCV; ONNX Runtime for suitable local models; Pydantic/Pydantic AI; Zod; Vitest/Playwright/pytest. Deploy Next.js on Vercel and FastAPI/worker on a separate Python-capable host. Begin as a modular monolith plus worker; no microservice sprawl.

## Logical architecture

Owner -> Next.js Menu Studio -> Supabase Auth and server APIs -> PostgreSQL and object storage.

Public visitor/QR -> Next.js public route -> template registry/renderer -> immutable published snapshot and optimized image CDN. Public requests never trigger model inference.

AI path: Next.js server -> authenticated FastAPI AI Service Layer -> typed task router -> pipeline (deterministic image ops, local vision/text model, segmentation/upscaling) -> job queue -> output storage -> owner approval UI.

## AI service design

- FastAPI owns stable internal AI endpoints; frontend never calls Hugging Face model endpoints directly.
- Use Pydantic schemas for strict input/output contracts and task-specific validation.
- Use Pydantic AI only for bounded model-assisted tasks (copy draft, visual analysis, categorization); local Ollama models are supported. Deterministic Python functions handle image transforms, permissions, publishing and storage.
- Ollama is the initial easiest local inference runtime; keep an adapter interface to permit vLLM or llama.cpp later.
- No general-purpose autonomous agent with unrestricted filesystem, shell, SQL, or publishing tools.
- AI tasks are asynchronous, idempotent, cancellable, rate-limited and approval-gated.
- Model registry stores model ID/revision, runtime, license review, task capability, hardware requirements and enabled flag.
- The website must remain useful when AI is disabled or unavailable.

## Suggested repository structure

apps/web/app/(marketing), (auth), studio, m/[restaurantSlug]; apps/web/features/{restaurants,menus,media,branding,templates,publishing}; services/ai-service/app/{api,core,models,providers,jobs,pipelines}; packages/{contracts,template-kit,ui}; supabase/{migrations,seed.sql}; docs/.

## Template engine contract

Each versioned template declares id, version, supported menu types, configuration schema, capabilities (story, horizontal/vertical navigation, WebGL, reduced motion), and renderer component. It receives normalized restaurant/menu data, theme tokens, template configuration and accessibility preferences. It does not mutate menu content or fetch arbitrary data. Validate config with Zod.

## Publishing

Public page must not render mutable draft rows. Validate content/assets/config; serialize immutable snapshot; save PublishedVersion; transactionally update restaurant published pointer; invalidate cache; retain previous snapshot for rollback. Draft preview is authenticated and noindex. Public route reads published snapshot only.

## Security

Supabase RLS for all tenant data plus repeated server authorization. Never trust browser-supplied restaurant_id. Validate asset ownership before linking. Public fields are explicit allowlist. Validate uploads by content/MIME/size/dimensions; sanitize SVG; rate-limit auth/AI/upload/publish; keep secrets server-side; audit publication and membership changes. AI workers receive scoped asset references, not unrestricted storage access.

## Performance

Dynamically import template-specific motion/3D; do not ship Three.js to non-3D templates. Responsive images, modern formats, lazy load below fold, preload hero/selected only, pause offscreen motion, keep semantic HTML usable if animation fails, test mid-range Android and slow mobile networks. AI inference never blocks public page rendering.
