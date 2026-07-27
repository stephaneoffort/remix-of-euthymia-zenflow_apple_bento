-- 1. Storage : l'écriture dans task-attachments doit viser une tâche de mon organisation
DROP POLICY IF EXISTS "auth insert app buckets own" ON storage.objects;
CREATE POLICY "auth insert app buckets own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  owner = auth.uid()
  AND (
    (bucket_id = 'task-attachments' AND public.task_in_my_org((storage.foldername(name))[1]))
    OR bucket_id = ANY (ARRAY['avatars','chat-attachments'])
  )
);

DROP POLICY IF EXISTS "auth update app buckets own" ON storage.objects;
CREATE POLICY "auth update app buckets own" ON storage.objects
FOR UPDATE TO authenticated
USING (
  owner = auth.uid()
  AND (
    (bucket_id = 'task-attachments' AND public.task_in_my_org((storage.foldername(name))[1]))
    OR bucket_id = ANY (ARRAY['avatars','chat-attachments'])
  )
)
WITH CHECK (
  owner = auth.uid()
  AND (
    (bucket_id = 'task-attachments' AND public.task_in_my_org((storage.foldername(name))[1]))
    OR bucket_id = ANY (ARRAY['avatars','chat-attachments'])
  )
);

-- 2. Helper : l'entité référencée par une pièce jointe tierce est-elle dans mon organisation ?
CREATE OR REPLACE FUNCTION public.entity_in_my_org(_entity_type text, _entity_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _entity_type = 'task' THEN public.task_in_my_org(_entity_id)
    WHEN _entity_type = 'project' THEN public.project_in_my_org(_entity_id)
    WHEN _entity_type = 'space' THEN public.space_in_my_org(_entity_id)
    ELSE true
  END
$$;

REVOKE EXECUTE ON FUNCTION public.entity_in_my_org(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.entity_in_my_org(text, text) TO authenticated;

-- 3. Pièces jointes tierces : vérifier l'entité référencée à l'écriture
DROP POLICY IF EXISTS "Users can create their own canva attachments" ON public.canva_attachments;
CREATE POLICY "Users can create their own canva attachments" ON public.canva_attachments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.entity_in_my_org(entity_type, entity_id));

DROP POLICY IF EXISTS "Users manage own drive attachments" ON public.drive_attachments;
DROP POLICY IF EXISTS "drive_attachments_all" ON public.drive_attachments;
CREATE POLICY "drive_attachments_select" ON public.drive_attachments
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "drive_attachments_insert" ON public.drive_attachments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.entity_in_my_org(entity_type, entity_id));
CREATE POLICY "drive_attachments_update" ON public.drive_attachments
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND public.entity_in_my_org(entity_type, entity_id));
CREATE POLICY "drive_attachments_delete" ON public.drive_attachments
FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own dropbox attachments" ON public.dropbox_attachments;
CREATE POLICY "Users can create their own dropbox attachments" ON public.dropbox_attachments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.entity_in_my_org(entity_type, entity_id));

DROP POLICY IF EXISTS "notion_attachments_insert" ON public.notion_attachments;
CREATE POLICY "notion_attachments_insert" ON public.notion_attachments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.entity_in_my_org(entity_type, entity_id));

DROP POLICY IF EXISTS "Users can create their own miro attachments" ON public.miro_attachments;
CREATE POLICY "Users can create their own miro attachments" ON public.miro_attachments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.entity_in_my_org(entity_type, entity_id));

DROP POLICY IF EXISTS "Users can create their own keep attachments" ON public.keep_attachments;
CREATE POLICY "Users can create their own keep attachments" ON public.keep_attachments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.entity_in_my_org(entity_type, entity_id));

DROP POLICY IF EXISTS "Users can update their own keep attachments" ON public.keep_attachments;
CREATE POLICY "Users can update their own keep attachments" ON public.keep_attachments
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND public.entity_in_my_org(entity_type, entity_id));

DROP POLICY IF EXISTS "Users can create their own zoom meetings" ON public.zoom_meetings;
CREATE POLICY "Users can create their own zoom meetings" ON public.zoom_meetings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.entity_in_my_org(entity_type, entity_id));