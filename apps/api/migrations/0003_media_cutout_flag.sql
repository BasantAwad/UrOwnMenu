-- UrOwnMenu - record whether a media asset is a background-removed cutout.
--
-- A cutout has a transparent background, so templates must render it without
-- a surface fill and give it a stable contact shadow instead. A normal photo
-- fills its frame. The templates need to know which is which.

ALTER TABLE media_assets ADD COLUMN is_cutout INTEGER NOT NULL DEFAULT 0;
