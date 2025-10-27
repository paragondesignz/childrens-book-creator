-- Make generated-pdfs and generated-images buckets public
-- These contain generated content (not sensitive child photos) and need to be accessible via public URLs

UPDATE storage.buckets
SET public = true
WHERE id IN ('generated-pdfs', 'generated-images');

-- Note: temp-uploads remains private (false) as it contains actual child photos
