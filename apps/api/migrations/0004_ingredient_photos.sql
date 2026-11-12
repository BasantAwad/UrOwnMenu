-- UrOwnMenu - owner-chosen hero ingredient + resolved ingredient photography.
--
-- main_ingredient: the ingredient the owner marks as the "hero" of an item.
--   Used by the Ingredient Story template as the section's background photo.
--   Never inferred; set by the owner per item.
--
-- ingredient_photos: cache of macro photography resolved from Openverse
--   (CC0/PDM/CC-BY/CC-BY-SA only) and Wikimedia Commons (with extmetadata),
--   keyed by a normalised slug of the ingredient name. Stored in R2 when
--   available so published menus never hotlink third parties. The licence
--   and creator are stored so the public menu can show attribution.

ALTER TABLE menu_items ADD COLUMN main_ingredient TEXT;

CREATE TABLE IF NOT EXISTS ingredient_photos (
  slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  image_key TEXT,
  image_url TEXT,
  source TEXT NOT NULL,          -- 'openverse' | 'commons'
  source_url TEXT,               -- landing/attribution page
  license TEXT NOT NULL DEFAULT 'unknown',
  license_url TEXT,
  creator TEXT,
  width INTEGER,
  height INTEGER,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
