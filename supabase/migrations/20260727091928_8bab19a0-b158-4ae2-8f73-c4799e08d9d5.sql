DROP POLICY IF EXISTS "own rows" ON public.brevo_connections;

DROP POLICY IF EXISTS "brevo_campaigns_own" ON public.brevo_campaigns;
CREATE POLICY "brevo_campaigns_own" ON public.brevo_campaigns
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND public.entity_in_my_org(entity_type, entity_id));

DROP POLICY IF EXISTS "brevo_contacts_own" ON public.brevo_contacts;
CREATE POLICY "brevo_contacts_own" ON public.brevo_contacts
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND public.entity_in_my_org(entity_type, entity_id));

DROP POLICY IF EXISTS "brevo_entity_campaigns_own" ON public.brevo_entity_campaigns;
CREATE POLICY "brevo_entity_campaigns_own" ON public.brevo_entity_campaigns
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND public.entity_in_my_org(entity_type, entity_id));