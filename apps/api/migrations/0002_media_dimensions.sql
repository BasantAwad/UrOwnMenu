-- UrOwnMenu - add photo dimensions to media assets.
-- The owner frames their photo in the media editor; the templates use the
-- stored dimensions so a dish is never hard-cropped by CSS.

ALTER TABLE media_assets ADD COLUMN width INTEGER;
ALTER TABLE media_assets ADD COLUMN height INTEGER;
