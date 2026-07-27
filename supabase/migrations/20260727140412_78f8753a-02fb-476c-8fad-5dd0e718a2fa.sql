-- 1) Helper: does a channel belong to my current org?
CREATE OR REPLACE FUNCTION public.channel_in_my_org(_channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_channels c
    WHERE c.id = _channel_id
      AND NOT (c.org_id IS DISTINCT FROM public.current_org_id())
  )
$$;

REVOKE ALL ON FUNCTION public.channel_in_my_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.channel_in_my_org(uuid) TO authenticated, service_role;

-- 2) chat_messages: enforce org scoping on read
DROP POLICY IF EXISTS messages_select ON public.chat_messages;
CREATE POLICY messages_select ON public.chat_messages
FOR SELECT TO authenticated
USING (
  public.channel_in_my_org(channel_id)
  AND EXISTS (
    SELECT 1 FROM public.chat_channels c
    WHERE c.id = chat_messages.channel_id
      AND (c.type = 'public' OR public.is_channel_member(c.id, auth.uid()))
  )
);

-- 3) chat_channel_members: cannot join a channel from another org
DROP POLICY IF EXISTS members_insert ON public.chat_channel_members;
CREATE POLICY members_insert ON public.chat_channel_members
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.channel_in_my_org(channel_id));

-- 4) Internal email-queue functions: not callable by anonymous visitors
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, PUBLIC;

-- 5) Pin search_path on functions that lacked it
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path TO '';
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path TO '';
ALTER FUNCTION public.delete_email(text, bigint) SET search_path TO '';
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path TO '';