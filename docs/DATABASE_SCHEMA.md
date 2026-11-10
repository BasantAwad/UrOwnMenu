# Database Schema — Cloudflare D1 / SQLite

Use Drizzle ORM and versioned D1 SQL migrations. Better Auth owns identity/session tables; generate its D1-compatible schema first and ensure the identity table is named user (adjust FK targets if not). Never store passwords manually.

## ER diagram

~~~mermaid
erDiagram
 USER ||--o{ RESTAURANT_MEMBERSHIP : joins
 RESTAURANT ||--o{ RESTAURANT_MEMBERSHIP : has
 RESTAURANT ||--|| BRAND_PROFILE : owns
 RESTAURANT ||--o{ MENU : has
 MENU ||--o{ MENU_CATEGORY : contains
 MENU_CATEGORY ||--o{ MENU_ITEM : contains
 MENU_ITEM ||--o{ MENU_ITEM_VARIANT : offers
 RESTAURANT ||--o{ MEDIA_ASSET : stores
 RESTAURANT ||--o{ SITE_CONFIGURATION : configures
 RESTAURANT ||--o{ PUBLISHED_VERSION : publishes
 RESTAURANT ||--o{ AI_JOB : requests
 RESTAURANT ||--o{ AUDIT_LOG : records
 RESTAURANT ||--o{ RESTAURANT_SECTION : presents
~~~

## Core entities and relationships
- User 1—N RestaurantMembership N—1 Restaurant; roles owner/editor/viewer.
- Restaurant 1—1 BrandProfile; 1—N Menu, MediaAsset, SiteConfiguration, PublishedVersion, AIJob, AuditLog and RestaurantSection.
- Menu 1—N Category 1—N MenuItem 1—N MenuItemVariant.
- MediaAsset may reference its source asset for derivatives.

## Conventions
UUID strings generated server-side; ISO-8601 UTC timestamps; money as integer minor units plus ISO 4217 currency (never float); JSON validated with shared Zod schemas; tenant queries always scoped and authorized server-side. Public visitors read immutable published snapshots only. No customer order/payment data in MVP.

## Initial D1 schema

Apply Better Auth's generated identity migration first. This migration references user(id); if adapter schema differs, adjust consistently.

~~~sql
PRAGMA foreign_keys = ON;
CREATE TABLE restaurants (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE COLLATE NOCASE, owner_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT, description TEXT, phone TEXT, email TEXT, website_url TEXT, address_text TEXT, map_url TEXT, currency_code TEXT NOT NULL DEFAULT 'EGP' CHECK(length(currency_code)=3), locale TEXT NOT NULL DEFAULT 'en', timezone TEXT NOT NULL DEFAULT 'Africa/Cairo', status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','suspended','archived')), published_version_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE restaurant_memberships (id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')), created_at TEXT NOT NULL, UNIQUE(restaurant_id,user_id));
CREATE TABLE brand_profiles (id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE, primary_logo_asset_id TEXT, light_logo_asset_id TEXT, dark_logo_asset_id TEXT, icon_asset_id TEXT, palette_key TEXT, theme_tokens_json TEXT NOT NULL DEFAULT '{}', typography_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE menus (id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT, menu_type TEXT NOT NULL DEFAULT 'main', locale TEXT NOT NULL DEFAULT 'en', is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)), sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE menu_categories (id TEXT PRIMARY KEY, menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT, image_asset_id TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_visible INTEGER NOT NULL DEFAULT 1 CHECK(is_visible IN (0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE media_assets (id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, source_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL, storage_key TEXT NOT NULL UNIQUE, original_filename TEXT, mime_type TEXT NOT NULL, width INTEGER, height INTEGER, byte_size INTEGER NOT NULL CHECK(byte_size>=0), checksum_sha256 TEXT NOT NULL, asset_role TEXT NOT NULL CHECK(asset_role IN ('logo','cover','menu_item','category','gallery','cutout','thumbnail','generated_background','other')), processing_status TEXT NOT NULL DEFAULT 'original' CHECK(processing_status IN ('original','processing','ready','failed','rejected')), provenance_json TEXT NOT NULL DEFAULT '{}', created_by TEXT REFERENCES user(id) ON DELETE SET NULL, created_at TEXT NOT NULL);
CREATE TABLE menu_items (id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE, name TEXT NOT NULL, short_description TEXT, long_description TEXT, price_minor INTEGER CHECK(price_minor IS NULL OR price_minor>=0), currency_code TEXT NOT NULL DEFAULT 'EGP' CHECK(length(currency_code)=3), primary_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL, is_featured INTEGER NOT NULL DEFAULT 0 CHECK(is_featured IN (0,1)), is_available INTEGER NOT NULL DEFAULT 1 CHECK(is_available IN (0,1)), is_visible INTEGER NOT NULL DEFAULT 1 CHECK(is_visible IN (0,1)), owner_ingredients_json TEXT NOT NULL DEFAULT '[]', owner_allergens_json TEXT NOT NULL DEFAULT '[]', owner_dietary_labels_json TEXT NOT NULL DEFAULT '[]', tags_json TEXT NOT NULL DEFAULT '[]', sort_order INTEGER NOT NULL DEFAULT 0, archived_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE menu_item_variants (id TEXT PRIMARY KEY, menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE, name TEXT NOT NULL, price_minor INTEGER CHECK(price_minor IS NULL OR price_minor>=0), currency_code TEXT NOT NULL DEFAULT 'EGP' CHECK(length(currency_code)=3), is_available INTEGER NOT NULL DEFAULT 1 CHECK(is_available IN (0,1)), sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE restaurant_sections (id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, section_type TEXT NOT NULL CHECK(section_type IN ('story','chef','philosophy','gallery','location','hours','contact','social','announcement','signature')), title TEXT, body TEXT, content_json TEXT NOT NULL DEFAULT '{}', is_enabled INTEGER NOT NULL DEFAULT 1 CHECK(is_enabled IN (0,1)), sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE site_configurations (id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, template_key TEXT NOT NULL, template_version TEXT NOT NULL, theme_tokens_json TEXT NOT NULL DEFAULT '{}', template_config_json TEXT NOT NULL DEFAULT '{}', enabled_sections_json TEXT NOT NULL DEFAULT '[]', config_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE published_versions (id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, version_number INTEGER NOT NULL, snapshot_schema_version INTEGER NOT NULL DEFAULT 1, snapshot_json TEXT NOT NULL, checksum_sha256 TEXT NOT NULL, template_key TEXT NOT NULL, template_version TEXT NOT NULL, published_by TEXT REFERENCES user(id) ON DELETE SET NULL, created_at TEXT NOT NULL, UNIQUE(restaurant_id,version_number));
CREATE TABLE ai_jobs (id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, requester_user_id TEXT REFERENCES user(id) ON DELETE SET NULL, source_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL, task_type TEXT NOT NULL CHECK(task_type IN ('menu_copy','category_suggestion','template_recommendation','image_review','alt_text','background_removal','image_enhancement')), provider_key TEXT NOT NULL, model_id TEXT, input_json TEXT NOT NULL DEFAULT '{}', output_json TEXT, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','succeeded','failed','rejected','approved','quota_exceeded')), error_code TEXT, approval_status TEXT NOT NULL DEFAULT 'not_required' CHECK(approval_status IN ('not_required','pending','approved','rejected')), created_at TEXT NOT NULL, completed_at TEXT);
CREATE TABLE audit_logs (id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, actor_user_id TEXT REFERENCES user(id) ON DELETE SET NULL, action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
CREATE INDEX idx_memberships_user ON restaurant_memberships(user_id);
CREATE INDEX idx_menus_restaurant ON menus(restaurant_id,sort_order);
CREATE INDEX idx_categories_menu ON menu_categories(menu_id,sort_order);
CREATE INDEX idx_items_category ON menu_items(category_id,sort_order);
CREATE INDEX idx_variants_item ON menu_item_variants(menu_item_id,sort_order);
CREATE INDEX idx_assets_restaurant ON media_assets(restaurant_id,created_at);
CREATE INDEX idx_sections_restaurant ON restaurant_sections(restaurant_id,sort_order);
CREATE INDEX idx_published_restaurant ON published_versions(restaurant_id,version_number DESC);
CREATE INDEX idx_ai_jobs_restaurant ON ai_jobs(restaurant_id,created_at DESC);
CREATE INDEX idx_audit_restaurant ON audit_logs(restaurant_id,created_at DESC);
CREATE INDEX idx_restaurants_published ON restaurants(published_version_id);
~~~

## Required invariants
1. Verify linked assets belong to the same restaurant; foreign keys alone do not guarantee tenant equality.
2. Create restaurant, owner membership and brand profile transactionally.
3. Publish by writing validated immutable snapshot and updating published pointer atomically.
4. Snapshot includes only public restaurant profile, logo/theme, active menus/categories/items/variants, enabled story sections and template configuration. Exclude private email, memberships, AI prompts and audit logs.
5. Hidden price and null price are different states; store price visibility in site config.
6. Ingredients/allergens/dietary labels are owner-supplied facts with provenance.
7. Add data export/deletion workflows before onboarding real customers.
