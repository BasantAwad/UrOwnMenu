-- UrOwnMenu - Cloudflare D1 schema (SQLite dialect)
-- Idempotent: safe to re-run on a fresh or existing local database.

PRAGMA foreign_keys = ON;

-- ============ Identity ============

CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  email_verified TEXT,
  image TEXT,
  password TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "session" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "account" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at TEXT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "verification" (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ Restaurant core ============

CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  owner_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  description TEXT,
  phone TEXT,
  email TEXT,
  website_url TEXT,
  address_text TEXT,
  map_url TEXT,
  currency_code TEXT NOT NULL DEFAULT 'EGP' CHECK(length(currency_code)=3),
  locale TEXT NOT NULL DEFAULT 'en',
  timezone TEXT NOT NULL DEFAULT 'Africa/Cairo',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','suspended','archived')),
  published_version_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restaurant_memberships (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(restaurant_id,user_id)
);

CREATE TABLE IF NOT EXISTS brand_profiles (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  palette_key TEXT,
  theme_tokens_json TEXT NOT NULL DEFAULT '{}',
  typography_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ Menu authoring ============

CREATE TABLE IF NOT EXISTS menus (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  menu_type TEXT NOT NULL DEFAULT 'main',
  locale TEXT NOT NULL DEFAULT 'en',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1 CHECK(is_visible IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0 CHECK(byte_size>=0),
  checksum_sha256 TEXT NOT NULL DEFAULT '',
  asset_role TEXT NOT NULL DEFAULT 'menu_item'
    CHECK(asset_role IN ('logo','cover','menu_item','category','gallery','other')),
  processing_status TEXT NOT NULL DEFAULT 'ready'
    CHECK(processing_status IN ('original','processing','ready','failed','rejected')),
  data_url TEXT,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_description TEXT,
  long_description TEXT,
  price_minor INTEGER CHECK(price_minor IS NULL OR price_minor>=0),
  currency_code TEXT NOT NULL DEFAULT 'EGP' CHECK(length(currency_code)=3),
  primary_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK(is_featured IN (0,1)),
  is_available INTEGER NOT NULL DEFAULT 1 CHECK(is_available IN (0,1)),
  is_visible INTEGER NOT NULL DEFAULT 1 CHECK(is_visible IN (0,1)),
  owner_ingredients_json TEXT NOT NULL DEFAULT '[]',
  owner_allergens_json TEXT NOT NULL DEFAULT '[]',
  owner_dietary_labels_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ Site config + publishing ============

CREATE TABLE IF NOT EXISTS site_configurations (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL DEFAULT 'editorial-showcase',
  template_version TEXT NOT NULL DEFAULT '1.0.0',
  theme_tokens_json TEXT NOT NULL DEFAULT '{}',
  template_config_json TEXT NOT NULL DEFAULT '{}',
  enabled_sections_json TEXT NOT NULL DEFAULT '[]',
  config_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS published_versions (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot_schema_version INTEGER NOT NULL DEFAULT 1,
  snapshot_json TEXT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  template_key TEXT NOT NULL,
  template_version TEXT NOT NULL DEFAULT '1.0.0',
  published_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(restaurant_id, version_number)
);

-- ============ Indexes ============

CREATE INDEX IF NOT EXISTS idx_memberships_user ON restaurant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_menus_restaurant ON menus(restaurant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_menu ON menu_categories(menu_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_items_category ON menu_items(category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_assets_restaurant ON media_assets(restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_published_restaurant ON published_versions(restaurant_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_session_user ON "session"(user_id);
