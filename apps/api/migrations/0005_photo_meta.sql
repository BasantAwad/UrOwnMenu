-- UrOwnMenu - art-direction metadata for item photography.
--
-- Background removal and cropping change what an image *is*, but templates
-- also need to know how to place it: where the subject's focal point sits,
-- how bright the frame is (so type over it can pick a scrim), how much of
-- the frame the subject fills, and whether the stored file is a trimmed
-- cutout or a full photograph.
--
-- Stored as one JSON document per item. A missing row (or null) means "not
-- measured yet": templates fall back to a safe centre crop, never to a
-- guessed focal point.

ALTER TABLE menu_items ADD COLUMN photo_meta_json TEXT;
