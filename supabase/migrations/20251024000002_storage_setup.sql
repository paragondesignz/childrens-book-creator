-- Create storage buckets for the application

-- Bucket for temporary child/pet photos (auto-delete after 24 hours)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'temp-uploads',
  'temp-uploads',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Bucket for generated PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-pdfs',
  'generated-pdfs',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Bucket for generated images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-images',
  'generated-images',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for temp-uploads bucket
-- Users can upload their own files
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'temp-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can read their own files
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'temp-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'temp-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for generated-pdfs bucket
-- Users can read their own PDFs
CREATE POLICY "Users can read own PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-pdfs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Service role can insert PDFs
CREATE POLICY "Service can insert PDFs"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'generated-pdfs');

-- Storage policies for generated-images bucket
-- Users can read their own images
CREATE POLICY "Users can read own images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Service role can insert images
CREATE POLICY "Service can insert images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'generated-images');

-- Create a function to auto-delete old temp uploads (older than 24 hours)
CREATE OR REPLACE FUNCTION delete_old_temp_uploads()
RETURNS void AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'temp-uploads'
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to run cleanup daily (requires pg_cron extension)
-- Note: This requires the pg_cron extension to be enabled in Supabase
-- You can enable it in the Database settings or via SQL:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- SELECT cron.schedule(
--   'delete-old-temp-uploads',
--   '0 2 * * *', -- Run at 2 AM daily
--   'SELECT delete_old_temp_uploads();'
-- );
