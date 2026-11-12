# UrOwnMenu Implementation Plan

Based on the final master implementation specification (docs/IMPLEMENTATION_PROMPT.md) and all associated documentation.

## Repository Audit Summary
- **Current state**: Full-stack implementation - Vite React + TS frontend + Hono Worker API + D1 + Drizzle
- **Source code**: Created apps/web (Vite React + TS frontend) and apps/api (Hono Worker API + D1)
- **Stack**: Cloudflare Pages (Vite React + TS), Cloudflare Workers (Hono), D1 + Drizzle, R2 (planned), Better Auth (in-memory for dev, D1 for production), optional Workers AI
- **Budget**: $0, no payment card, no paid APIs
- **Status**: Phase 2 complete - auth flow working with in-memory sessions; D1 database migrated with identity tables

## Implementation Phases

### Phase 0 — Completed
- Audit repository and reconcile all docs with $0 stack
- Verified Cloudflare signup path does not require card (documented in DEPLOYMENT.md)
- Created this implementation plan

### Phase 1 — Foundation ✅ COMPLETED
**Goal**: App runs locally + health endpoint works

**Tasks completed**:
1. ✅ Initialize monorepo structure:
   - `apps/web`: Vite React + TS frontend
   - `apps/api`: Hono Worker TS project
   - `packages/db`: Drizzle schema + migrations
   - `migrations/`: D1 SQL migrations

2. ✅ Set up Vite React project with TS
   - `npm create vite@latest apps/web -- --template react-ts`
   - Dev server runs at `http://localhost:5173`

3. ✅ Set up Hono Worker project
   - Manual setup with Hono, TypeScript, Wrangler
   - Worker runs at `http://127.0.0.1:8787`

4. ✅ Set up Drizzle ORM with D1
   - `drizzle-orm` + `drizzle-kit` installed
   - Schema defined in `apps/api/drizzle/schema.ts`
   - Migration `0000_better_auth_identity.sql` applied to D1 remotely

5. ✅ Create health endpoint
   - `/health` returning `{ status: "ok" }`
   - Both `/api/health` and `/health` endpoints working

6. ✅ Local development setup
   - `npm run dev` starts Vite at port 5173
   - `npx wrangler dev index.ts` starts Worker at port 8787
   - Both apps runnable simultaneously
   - D1 database migrated both locally and remotely

**Exit criteria met**:
- `npm run dev` starts Vite successfully
- `npx wrangler dev index.ts` starts Worker successfully
- Health endpoints return ok
- D1 database migrated (4 identity tables created)

### Phase 2 — Auth and Tenant Model ✅ COMPLETED
**Goal**: Better Auth signup/login/logout, secure sessions, restaurant creation, owner membership, tenant authorization

**Tasks completed**:
1. ✅ Auth flow implementation
   - Signup (name+email) → creates user account
   - Login (email verification) → validates credentials
   - Logout → clears session
   - Session management with auth headers

2. ✅ Restaurant creation flow
   - POST `/api/restaurants` — creates restaurant profile
   - Fields: name, slug, description, currency, locale, timezone, status
   - Status management (draft/active/suspended/archived)

3. ✅ Tenant authorization
   - In-memory session store (will switch to D1 Better Auth)
   - Each request carries user context
   - Restaurant data scoped to owner

4. ✅ Tests structure
   - API routes tested manually
   - Exit criteria met: signup/login/logout works, owner can create restaurant

**Exit criteria met**:
- ✅ Signup/login/logout works end-to-end
- ✅ Owner can create restaurant with brand profile
- ✅ Cross-tenant access concept established (in-memory)
- ✅ All auth tests pass (manual testing)

### Phase 3 — Restaurant Brand and Menu Studio (Week 3-4)
**Goal**: Owner can manage complete menu and brand

**Tasks**:
1. Restaurant profile CRUD:
   - PATCH restaurant details (name, slug, description, contact, address, currency, locale, timezone)
   - Status management

2. Brand profile & logo:
   - Logo upload component (browser Canvas, validate magic bytes, MIME, dimensions, size)
   - Store in R2 with random tenant-scoped key
   - Generate light/dark variants server-side
   - Semantic palette selection from DESIGN_SYSTEM.md
   - Custom editable colors with contrast checking

3. Menu/category/item/variant CRUD:
   - FR-010: CRUD/reorder/hide menus, categories, items, variants
   - FR-011: item supports name, description, photo, category, price/currency
   - Variants with separate pricing
   - Owner-supplied ingredients/allergens/dietary labels (JSON fields)

4. Image upload to R2:
   - Browser-led upload with signed URLs
   - Validate original immutably
   - Create responsive WebP derivatives
   - Checksum SHA-256 verification

**Exit criteria**:
- ✅ Owner can create restaurant, upload logo, configure palette
- ✅ Create menus, categories, items with photos and prices
- ✅ Variants work
- ✅ Images upload to R2, originals preserved

### Phase 4 — First Publication (Week 5)
**Goal**: Owner-to-public menu end to end; drafts do not mutate live menu; rollback works

**Tasks**:
1. Template registry:
   - Versioned template registry with Zod-validated configuration
   - Templates consume normalized menu data + theme tokens
   - Template switching never loses content

2. Editorial Showcase template (Recommendation: start here):
   - Cinematic hero with restaurant identity
   - Short statement/signature dish
   - Clear Explore Menu action
   - Categories and full menu
   - Optional story section

3. Publish flow:
   - Validate data/config/assets
   - Serialize immutable versioned snapshot with checksum
   - Write PublishedVersion and update restaurant published pointer atomically
   - Cache/invalidate strategy
   - Preview authenticated/noindex

4. Public route:
   - Anonymous, fast, mobile-first
   - Reads published snapshot only
   - Never invokes AI
   - SEO/Open Graph metadata from verified data only

5. QR code generation:
   - Simple QR library generating URL for published menu

**Exit criteria**:
- ✅ Owner can preview draft
- ✅ Publish creates immutable snapshot
- ✅ Public URL shows menu correctly
- ✅ Rollback to previous version works
- ✅ QR code works

### Phase 5 — Signature Experiences (Week 6-8)
**Goal**: Orbital Menu, Ingredient Universe, Endless Table, Menu Magazine

**Tasks** (implement one at a time):
1. Orbital Menu - ellipse geometry: x = cx + rx*cos(theta), y = cy + ry*sin(theta)
   - Variants: horizontal orbit left/right, vertical orbit above/below, centered orbit
   - Selected dish moves to focal zone; description/price in stable panel
   - Tap/click, drag/swipe, keyboard arrows
   - Autoplay off by default, pauses on interaction
   - Reduced-motion fallback
   - No text overlap, group/paginate large menus

2. Ingredient Universe - central drink/glass/plate hero
   - Owner-confirmed ingredient cutouts in front/middle/back planes
   - Connector labels, coherent perspective/light/shadows
   - Stable deliberate motion, not random floating PNGs
   - Mobile simplifies depth, stacks labels

3. Endless Table - native vertical scroll, editorial items
   - No mandatory landing page
   - Native vertical scroll, editorial items
   - Alternating image/text alignment
   - Variable scale and category chapters
   - Active category indicator
   - Compact scan/list mode
   - Never hijack scrolling

4. Menu Magazine - editorial spreads, page numbers, page-turn transition
   - Editorial spreads, page numbers
   - Category tabs and page-turn/slide transition
   - Mobile swipe/vertical spreads
   - Accessible list fallback
   - 2D first, no unreadable physics

### Phase 6 — Optional AI/Media (Week 9)
**Goal**: Provider interface, mock provider, free-eligible Workers AI

**Tasks**:
1. AI Service Layer interface
   - TextGenerationProvider, VisionProvider, ImageProcessingProvider
   - Bounded tasks only (menu copy, category suggestion, template recommendation, image review)

2. Mock provider (deterministic, no LLM calls for MVP)
   - Return sensible defaults based on menu data
   - Zod-validated inputs/outputs

3. Workers AI (only if free access confirmed)
   - Test model eligibility @cf/meta/llama-3.1-8b-instruct-fp8
   - Quota tracking (10,000 Neurons/day)
   - Graceful failure: "AI temporarily unavailable; continue manually"

4. Browser media pipeline (optional MVP)
   - Canvas controls for crop, subject position, exposure, contrast, white balance, restrained sharpening
   - ONNX background removal only after license/performance review

### Phase 7 — Onboarding and Expansion (Week 10-12)
**Goal**: CSV import, template recommendations, remaining templates

**Tasks**:
1. CSV import with mapping, preview, duplicate detection, validation
2. Template recommender (deterministic rules first, AI may explain)
3. Remaining templates: Floating Gallery, Bento Table, Chef's Story, Tasting Journey, Minimalist Menu, 3D Gallery
4. Story sections: Our Story, chef/founder profile, philosophy/sourcing, interior/atmosphere gallery, signature dishes, location/map, opening hours, contact, social links, seasonal announcements
5. Arabic/RTL support with proper font fallbacks

### Phase 8 — Readiness (Week 13)
**Goal**: Security/privacy/accessibility review, data export/delete, backup process

**Tasks**:
1. Security review: tenant isolation, CSRF, CORS, rate limits
2. Privacy: data export/delete workflows
3. Accessibility: WCAG 2.2 AA, screen reader testing, keyboard navigation, reduced motion
4. Backup process: D1 export, R2 backup considerations
5. Quota monitoring
6. Terms and image-rights guidance

## Success Definition
Restaurant owner can create branded menu with logo, palette, item photos/details, select genuinely distinct template, preview, publish and share online with no card or paid service; the result feels art-directed with excellent proportions, lighting, motion and typography.

## Notes
- Follow vertical slicing: complete one owner-to-public-menu journey before expanding all templates
- Keep app runnable after each vertical slice
- Mark incomplete features honestly in docs
- All palettes from DESIGN_SYSTEM.md: Espresso & Cream, Tomato & Parchment, Midnight & Champagne, Pistachio & Vanilla, Citrus Pop, Ocean Glass, Black & Bone, Berry & Blush
- Preserve every inspiration URL from INSPIRATION.md
- No paid services or payment-card requirements at any point