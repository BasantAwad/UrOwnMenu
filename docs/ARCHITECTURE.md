# Architecture — $0 Cloudflare-first and migration-ready

## Hard constraint
Owner has $0, no payment card, no trials, no paid APIs, no paid upgrade or automatic billing. If signup/product activation asks for a card, stop and report; never bypass or enter fake details. Free tiers can change; verify live terms before deployment.

## MVP stack
- Frontend: React + TypeScript + Vite, static deployment on Cloudflare Pages (`*.pages.dev`). Prefer this to Next.js SSR for MVP: avoids depending on a beta Next.js runtime adapter.
- API: TypeScript Cloudflare Workers with Hono.
- Database: Cloudflare D1 (SQLite) + Drizzle ORM + committed migrations.
- Object storage: Cloudflare R2 Standard for originals/derivatives.
- Authentication: Better Auth with D1-compatible Drizzle adapter. Email/password + secure sessions first. Do not require email verification/password-reset mail until a truly free no-card mail route is verified. Never store passwords manually.
- AI: optional Workers AI binding; only model IDs confirmed Free-eligible for this account. 10,000 Neurons/day free allocation; quota exhaustion must fail gracefully, never upgrade.
- Media: browser Canvas APIs, createImageBitmap, Web Workers; optional small commercially-cleared ONNX Runtime Web segmentation model only after size/performance/license review.
- UI: Tailwind or CSS modules + CSS variables; Motion for React; GSAP selectively; Three.js/R3F only for true 3D, dynamically imported.
- Validation/testing: Zod, Vitest, Playwright, Workers Vitest Pool/Miniflare.
- GitHub for source control/CI within free allowance.

No MVP dependency on Vercel, Supabase, Neon, Render, FastAPI hosting, paid inference, GPU hosting, custom domains or paid email.

## Current documented Cloudflare allowances (verify at launch)
Workers Free: 100,000 requests/day and 10 ms CPU per invocation. D1 Free: 10 databases, 500 MB/database, 5 GB/account, 7-day Time Travel, 50 SQL queries per Worker invocation. R2 Standard: 10 GB-month, 1M Class A operations/month, 10M Class B/month, no egress charge. Workers AI: 10,000 Neurons/day. Quotas are limited; exceeding them can fail operations.
Official docs:
- Account signup: https://developers.cloudflare.com/fundamentals/account/create-account/
- Workers: https://developers.cloudflare.com/workers/platform/limits/
- D1: https://developers.cloudflare.com/d1/platform/limits/
- R2: https://developers.cloudflare.com/r2/pricing/
- AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- AI models: https://developers.cloudflare.com/workers-ai/models/
Signup docs describe email/password followed by email verification; this is not a guarantee that every feature/account/region will never ask for payment verification.

## Logical architecture
React/Vite Pages frontend -> HTTPS Hono Worker API -> Better Auth/session + tenant authorization -> Drizzle/D1; asset upload/download -> R2; optional AI task router -> Workers AI; published public route -> immutable snapshot. Public menu never calls AI.

## AI Service Layer
First-party interfaces: TextGenerationProvider, VisionProvider, ImageProcessingProvider, AIJobRepository. Bounded tasks only: menu copy draft grounded in owner facts, category suggestion, template recommendation, image-quality/crop suggestion, alt-text draft. Deterministic rules first. No autonomous agent, unrestricted tools, shell, filesystem, SQL or publishing. Validate all model output with Zod; owner approves copy/derivatives. Never infer/certify ingredients, allergens, nutrition, dietary suitability, price or availability from pixels.

## Identity, tenant security and privacy
Better Auth owns identity/session tables. Roles owner/editor/viewer. Every read/write tenant-scoped server-side; never trust browser restaurant_id. Use secure HttpOnly SameSite cookies, origin/CSRF checks, strict CORS, rate limits, secrets server-side and public-field allowlist. Validate every referenced asset belongs to same restaurant. No customer orders/payments in MVP.

## Publishing
Draft tables are private/mutable. Publish validates assets/config, serializes immutable versioned snapshot, saves PublishedVersion, atomically updates published pointer, invalidates cache. Public reads published snapshot only. Retain versions and support rollback. Preview authenticated/noindex. AI output never auto-published.

## Storage
Immutable original; derivatives have source_asset_id and provenance. Random tenant-scoped storage keys, never raw user filenames. Validate file signature, MIME, size and dimensions. SVG rejected unless sanitized. D1 stores dimensions, mime, bytes, checksum, role and R2 key.

## Migration path
Keep domain interfaces Cloudflare-agnostic:
- D1 repository -> PostgreSQL repository.
- R2 adapter -> S3-compatible storage.
- Workers AI -> Ollama/vLLM via FastAPI or another provider.
- Hono -> FastAPI only if Python is needed.
Use UUID/text IDs, ISO UTC timestamps, JSON schema versions, integer minor-unit prices. Cloudflare is an initial free host, not a permanent lock-in.

## Not in MVP
Payments, ordering, delivery, reservations, POS, inventory, loyalty, customer accounts, custom domains, GPU model hosting, autonomous agents, paid email and paid APIs.
