-- Colonne logo personnel sur le profil utilisateur
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS logo_url text;

-- L'utilisateur doit pouvoir mettre à jour SA propre ligne de profil
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policies de stockage pour le bucket user-logos
-- Lecture : tout utilisateur authentifié (bucket privé, URLs signées côté client)
DROP POLICY IF EXISTS "user_logos_select" ON storage.objects;
CREATE POLICY "user_logos_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'user-logos');

-- Écriture : uniquement dans le dossier <auth.uid()>/
DROP POLICY IF EXISTS "user_logos_insert" ON storage.objects;
CREATE POLICY "user_logos_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "user_logos_update" ON storage.objects;
CREATE POLICY "user_logos_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'user-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'user-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "user_logos_delete" ON storage.objects;
CREATE POLICY "user_logos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-logos' AND (storage.foldername(name))[1] = auth.uid()::text);