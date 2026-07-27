-- Ajout de WITH CHECK sur toutes les policies UPDATE qui en manquaient,
-- afin d'empêcher la réattribution de propriété (user_id / id / org_id) lors d'une modification.

DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;
CREATE POLICY "Admins can update app settings" ON public.app_settings
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "members_update" ON public.chat_channel_members;
CREATE POLICY "members_update" ON public.chat_channel_members
FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "messages_update" ON public.chat_messages;
CREATE POLICY "messages_update" ON public.chat_messages
FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "custom_statuses_update" ON public.custom_statuses;
CREATE POLICY "custom_statuses_update" ON public.custom_statuses
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND org_id = public.current_org_id())
WITH CHECK (public.has_role(auth.uid(), 'admin') AND org_id = public.current_org_id());

DROP POLICY IF EXISTS "Users update own email accounts" ON public.email_accounts;
CREATE POLICY "Users update own email accounts" ON public.email_accounts
FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own emails" ON public.email_messages;
CREATE POLICY "Users update own emails" ON public.email_messages
FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own figma connection" ON public.figma_connections;
CREATE POLICY "Users update own figma connection" ON public.figma_connections
FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own figma links" ON public.figma_links;
CREATE POLICY "Users update own figma links" ON public.figma_links
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.task_in_my_org(task_id))
WITH CHECK (auth.uid() = user_id AND public.task_in_my_org(task_id));

DROP POLICY IF EXISTS "Users can update own google docs connections" ON public.google_docs_connections;
CREATE POLICY "Users can update own google docs connections" ON public.google_docs_connections
FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own google docs links" ON public.google_docs_links;
CREATE POLICY "Users can update own google docs links" ON public.google_docs_links
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.task_in_my_org(app_task_id))
WITH CHECK (auth.uid() = user_id AND public.task_in_my_org(app_task_id));

DROP POLICY IF EXISTS "Users can update their own Sheets connection" ON public.google_sheets_connections;
CREATE POLICY "Users can update their own Sheets connection" ON public.google_sheets_connections
FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own Sheets links" ON public.google_sheets_links;
CREATE POLICY "Users can update their own Sheets links" ON public.google_sheets_links
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.task_in_my_org(app_task_id))
WITH CHECK (auth.uid() = user_id AND public.task_in_my_org(app_task_id));

DROP POLICY IF EXISTS "Users can update their own keep attachments" ON public.keep_attachments;
CREATE POLICY "Users can update their own keep attachments" ON public.keep_attachments
FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "presence_update" ON public.user_presence;
CREATE POLICY "presence_update" ON public.user_presence
FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);