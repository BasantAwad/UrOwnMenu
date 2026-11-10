# AI Service Layer — free-first implementation

## Constraint
$0, no payment card, no paid APIs, no trial credits. Core platform works with AI disabled. Hosted free inference is quota-limited and can change; over-quota fails gracefully without billing.

## Architecture
Frontend -> authenticated Hono Worker -> task router -> provider adapter -> optional Cloudflare Workers AI -> Zod validation -> D1 AI job record -> owner approval. This is an application-owned service layer, not a separate paid Python server. Keep adapters so FastAPI/Ollama can be added later.

## Bounded specialist agents (not autonomous agents)
1. Menu Copy Assistant: rewrite only owner-provided facts; draft only.
2. Menu Organizer: suggest categories/order based on supplied names/descriptions.
3. Template Recommender: deterministic rules first; AI may explain top 3.
4. Visual Review Assistant: optional vision model suggests crop/quality/alt text.
5. Media Preparation: deterministic browser code, not an LLM agent.
No unrestricted shell/filesystem/database/publishing tools or arbitrary loops.

## Model policy
Workers AI free allocation documented as 10,000 Neurons/day. Select only model IDs confirmed free for this account at implementation time. Candidate text model: `@cf/meta/llama-3.1-8b-instruct-fp8` or a smaller free-eligible option. Candidate vision model: `@cf/llama-3.2-11b-vision-instruct` only if Free access is confirmed. Check live catalog: https://developers.cloudflare.com/workers-ai/models/ . Some models require Workers Paid; never use them. No Hugging Face hosted inference dependency.
Future local-only candidates (not MVP hosting): Qwen3-4B, Qwen3-VL-4B, rembg with individually licensed weights, Real-ESRGAN. These require local compute or later hosting.

## Tasks
- POST /api/ai/menu-copy
- POST /api/ai/category-suggestions
- POST /api/ai/template-recommendation
- POST /api/ai/image-review
- GET /api/ai/jobs/:id
- POST /api/ai/jobs/:id/approve
- POST /api/ai/jobs/:id/reject
For MVP, keep calls short and bounded; do not invent a long-running queue if unnecessary.

## Image preparation
1. Preserve immutable original.
2. Validate file signature, MIME, dimensions and size; normalize EXIF.
3. Create responsive WebP derivatives.
4. Browser Canvas controls: crop, subject position, exposure, contrast, white balance, restrained sharpening.
5. Optional ONNX background removal only after exact weight license, browser RAM, download size and performance are checked. Load only on explicit request; show progress/cancel.
6. Compare before/after; owner approves.
7. Approved cutout becomes CSS 2.5D asset with stable shadow, perspective and subtle parallax.

## Moving object levels
Level 1: cutout + CSS 2.5D transforms/shadows/parallax (MVP).
Level 2: cautiously layered depth and subtle displacement with flat fallback.
Level 3: future image-to-3D. A single photo cannot reveal hidden sides; generated mesh is approximate/decorative, explicit approval only. Never replace factual dish image.
AI generation disabled in MVP because it can change dish identity, ingredients, toppings, shape and quantity. Future generated art must be separate background/campaign material with real dish foreground locked.

## Safety, privacy and quotas
AI never certifies ingredients, allergens, nutrition, dietary suitability, prices or availability. Owner-provided facts authoritative. Do not send private customer photos to third-party model unless disclosed and approved. Model IDs allowlisted server-side. Input/output Zod schemas, timeout, rate limits, max sizes, audit trail and owner approval. On quota/429/timeout show “AI temporarily unavailable; continue manually.” Never ask for card or auto-upgrade.
