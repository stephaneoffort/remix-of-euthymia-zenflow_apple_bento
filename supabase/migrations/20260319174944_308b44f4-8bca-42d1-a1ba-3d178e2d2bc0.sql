
-- Add avatar_url column to team_members
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload to avatars bucket
CREATE POLICY "Anyone can upload avatars" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow public read access to avatars
CREATE POLICY "Avatars are publicly accessible" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'avatars');

-- Allow users to update their own avatars
CREATE POLICY "Users can update own avatars" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars');

-- Allow users to delete own avatars
CREATE POLICY "Users can delete own avatars" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars');
