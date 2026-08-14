REVOKE EXECUTE ON FUNCTION public.channel_in_my_org(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_member_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.entity_in_my_org(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_linked(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.project_in_my_org(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shares_org_with_me(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.space_in_my_org(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.task_in_my_org(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_access_chat_object(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_channels c
    WHERE c.id::text = (storage.foldername(_object_name))[1]
      AND public.channel_in_my_org(c.id)
      AND (
        c.type = 'public'
        OR public.is_channel_member(c.id, auth.uid())
      )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_chat_object(text) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "auth read app buckets scoped" ON storage.objects;
CREATE POLICY "auth read app buckets scoped" ON storage.objects
FOR SELECT TO authenticated
USING (
  (bucket_id = 'task-attachments' AND public.task_in_my_org((storage.foldername(name))[1]))
  OR (bucket_id = 'avatars' AND owner = auth.uid())
  OR (bucket_id = 'chat-attachments' AND (owner = auth.uid() OR public.can_access_chat_object(name)))
);

DROP POLICY IF EXISTS "auth insert app buckets own" ON storage.objects;
CREATE POLICY "auth insert app buckets own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  owner = auth.uid()
  AND (
    (bucket_id = 'task-attachments' AND public.task_in_my_org((storage.foldername(name))[1]))
    OR bucket_id = 'avatars'
    OR (bucket_id = 'chat-attachments' AND public.can_access_chat_object(name))
  )
);