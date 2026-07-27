DROP POLICY IF EXISTS "user_logos_select" ON storage.objects;
CREATE POLICY "user_logos_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'user-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);