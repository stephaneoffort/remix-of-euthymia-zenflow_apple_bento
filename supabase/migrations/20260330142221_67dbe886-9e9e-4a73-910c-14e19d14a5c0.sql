
-- Reinforce RLS on all integration tables with unified _own policies

-- member_integrations (already has policy, drop and recreate for consistency)
DROP POLICY IF EXISTS "member_integrations_own" ON member_integrations;
CREATE POLICY "member_integrations_own" ON member_integrations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- calendar_accounts - drop old granular policies, add unified
DROP POLICY IF EXISTS "Users can view own calendar accounts" ON calendar_accounts;
DROP POLICY IF EXISTS "Users can insert own calendar accounts" ON calendar_accounts;
DROP POLICY IF EXISTS "Users can update own calendar accounts" ON calendar_accounts;
DROP POLICY IF EXISTS "Users can delete own calendar accounts" ON calendar_accounts;
DROP POLICY IF EXISTS "calendar_accounts_own" ON calendar_accounts;
CREATE POLICY "calendar_accounts_own" ON calendar_accounts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- calendar_events
DROP POLICY IF EXISTS "Users can view own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can insert own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can delete own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_own" ON calendar_events;
CREATE POLICY "calendar_events_own" ON calendar_events
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- drive_connections
DROP POLICY IF EXISTS "Users can view own drive connections" ON drive_connections;
DROP POLICY IF EXISTS "Users can insert own drive connections" ON drive_connections;
DROP POLICY IF EXISTS "Users can update own drive connections" ON drive_connections;
DROP POLICY IF EXISTS "Users can delete own drive connections" ON drive_connections;
DROP POLICY IF EXISTS "drive_connections_own" ON drive_connections;
CREATE POLICY "drive_connections_own" ON drive_connections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- drive_attachments
DROP POLICY IF EXISTS "Users can view own drive attachments" ON drive_attachments;
DROP POLICY IF EXISTS "Users can insert own drive attachments" ON drive_attachments;
DROP POLICY IF EXISTS "Users can delete own drive attachments" ON drive_attachments;
DROP POLICY IF EXISTS "drive_attachments_own" ON drive_attachments;
CREATE POLICY "drive_attachments_own" ON drive_attachments
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- zoom_connections
DROP POLICY IF EXISTS "Users can manage own zoom connections" ON zoom_connections;
DROP POLICY IF EXISTS "zoom_connections_own" ON zoom_connections;
CREATE POLICY "zoom_connections_own" ON zoom_connections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- zoom_meetings
DROP POLICY IF EXISTS "zoom_meetings_own" ON zoom_meetings;
CREATE POLICY "zoom_meetings_own" ON zoom_meetings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- canva_connections
DROP POLICY IF EXISTS "Users can view own canva connections" ON canva_connections;
DROP POLICY IF EXISTS "Users can insert own canva connections" ON canva_connections;
DROP POLICY IF EXISTS "Users can update own canva connections" ON canva_connections;
DROP POLICY IF EXISTS "Users can delete own canva connections" ON canva_connections;
DROP POLICY IF EXISTS "canva_connections_own" ON canva_connections;
CREATE POLICY "canva_connections_own" ON canva_connections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- canva_attachments
DROP POLICY IF EXISTS "Users can view own canva attachments" ON canva_attachments;
DROP POLICY IF EXISTS "Users can insert own canva attachments" ON canva_attachments;
DROP POLICY IF EXISTS "Users can delete own canva attachments" ON canva_attachments;
DROP POLICY IF EXISTS "canva_attachments_own" ON canva_attachments;
CREATE POLICY "canva_attachments_own" ON canva_attachments
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- gmail_connections
DROP POLICY IF EXISTS "Users can manage own gmail connections" ON gmail_connections;
DROP POLICY IF EXISTS "gmail_connections_own" ON gmail_connections;
CREATE POLICY "gmail_connections_own" ON gmail_connections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- brevo_connections (already good, just ensure consistency)
DROP POLICY IF EXISTS "brevo_connections_own" ON brevo_connections;
CREATE POLICY "brevo_connections_own" ON brevo_connections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- brevo_entity_campaigns
DROP POLICY IF EXISTS "brevo_entity_campaigns_own" ON brevo_entity_campaigns;
CREATE POLICY "brevo_entity_campaigns_own" ON brevo_entity_campaigns
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- brevo_contacts
DROP POLICY IF EXISTS "brevo_contacts_own" ON brevo_contacts;
CREATE POLICY "brevo_contacts_own" ON brevo_contacts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- brevo_campaigns
DROP POLICY IF EXISTS "brevo_campaigns_own" ON brevo_campaigns;
CREATE POLICY "brevo_campaigns_own" ON brevo_campaigns
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
