# Zero-budget deployment guide

Goal: deploy online for $0, no payment card, no trial credits, no paid upgrade and no accidental billing. This is a free-first plan, not a guarantee that providers never change terms.

## Accounts/services
1. Existing GitHub repository.
2. Cloudflare Free account. Documented signup flow asks for email/password then email verification: https://developers.cloudflare.com/fundamentals/account/create-account/. If signup or enabling a required product asks for card/payment method, stop and report. Do not fake details or bypass.
3. Cloudflare Pages for frontend (`*.pages.dev`).
4. Workers Free for API (`*.workers.dev`).
5. D1 for database.
6. R2 Standard for media.
7. Workers AI only if free access is enabled for account and selected model is free-eligible.

## Documented quotas (check current docs before deploy)
- Workers Free: 100,000 requests/day, 10 ms CPU/invocation.
- D1 Free: 10 databases, 500 MB/database, 5 GB/account, 7-day Time Travel, 50 SQL queries/Worker invocation.
- R2 Standard: 10 GB-month, 1M Class A/month, 10M Class B/month, internet egress free.
- Workers AI: 10,000 Neurons/day; over-quota operations fail on Free. Some models require Workers Paid.
Sources: https://developers.cloudflare.com/workers/platform/limits/ ; https://developers.cloudflare.com/d1/platform/limits/ ; https://developers.cloudflare.com/r2/pricing/ ; https://developers.cloudflare.com/workers-ai/platform/pricing/

## Deployment layout
- `apps/web`: Vite React -> Pages, build `npm run build`, output `apps/web/dist` (adapt workspace scripts).
- `apps/api`: Hono Worker -> Workers via Wrangler.
- `packages/contracts`: shared Zod types.
- `packages/db`: Drizzle schema/repositories.
- `migrations/`: D1 SQL migrations.
- `wrangler.jsonc`: bindings only; no secrets.
- `.env.example` / `.dev.vars.example`: names/placeholders only.

## First deploy sequence
1. Verify Cloudflare account; stop if card requested.
2. Connect GitHub to Pages; configure build and output directory.
3. Deploy Worker health endpoint.
4. Create D1 database; bind as `DB`; run Better Auth-generated identity migration then app migrations locally and remotely.
5. Create R2 Standard bucket; bind as `MEDIA`.
6. Enable Workers AI only if Free plan access requires no card; bind as `AI`; smoke-test a free-eligible model.
7. Set Better Auth base URL and secret using Worker secrets, never commit.
8. Configure CORS for exact Pages origin.
9. Smoke-test signup, login, restaurant creation, photo upload, menu CRUD, publish snapshot and anonymous public route.
10. Record deployed URLs, actual limits and date in `docs/DEPLOYMENT_STATUS.md`.

## Usage protection
- Initial upload cap e.g. 8 MB; resize in browser; allow JPEG/PNG/WebP.
- Daily AI quotas per user/restaurant; max prompt/image sizes and timeouts.
- R2 Standard only; no Infrequent Access.
- Cache public snapshots/assets; avoid N+1 D1 queries.
- AI disabled by feature flag until tested; no generation in MVP.
- Manual monitoring; no paid monitoring.
- Export/backup D1 and R2; Time Travel is not an independent backup.

## Graceful degradation
AI quota exhausted -> manual workflow. R2 quota reached -> stop uploads and explain; no paid fallback. D1/Worker quota reached -> fail safely and preserve draft. Never trigger billing.

## Later migration
When budget exists: PostgreSQL, S3, FastAPI AI service, local Ollama/vLLM models, custom domain, stronger queues/observability. Not required for MVP.
