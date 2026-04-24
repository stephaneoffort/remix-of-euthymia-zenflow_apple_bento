-- Replace the SELECT policy on chat_channels to also allow the creator
DROP POLICY IF EXISTS channels_select ON public.chat_channels;

CREATE POLICY channels_select ON public.chat_channels
FOR SELECT
TO authenticated
USING (
  type = 'public'
  OR created_by = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.chat_channel_members
    WHERE chat_channel_members.channel_id = chat_channels.id
      AND chat_channel_members.user_id = auth.uid()
  )
);