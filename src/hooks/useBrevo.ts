import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIntegrations } from '@/hooks/useIntegrations';

const BREVO_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/brevo-api`;

export function useBrevo() {
  const { isActive } = useIntegrations();
  const [profile, setProfile] = useState<any>(null);

  const call = useCallback(async (body: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const result = await call({ action: 'test' });
      if (result.connected) setProfile(result.account);
      return result;
    } catch {
      return null;
    }
  }, [call]);

  useEffect(() => {
    if (isActive('brevo')) fetchProfile();
  }, [isActive, fetchProfile]);

  const saveApiKey = useCallback(async (apiKey: string) => {
    const result = await call({ action: 'save_api_key', api_key: apiKey });
    if (result.success) setProfile(result.account);
    return result;
  }, [call]);

  const listLists = useCallback(() => call({ action: 'list_lists' }), [call]);
  const searchContacts = useCallback((query: string) => call({ action: 'search_contacts', query }), [call]);
  const attachContact = useCallback(
    (email: string, firstName: string, lastName: string, entityType: string, entityId: string, listIds?: number[]) =>
      call({ action: 'attach_contact', email, first_name: firstName, last_name: lastName, entity_type: entityType, entity_id: entityId, list_ids: listIds }),
    [call]
  );
  const listContacts = useCallback(
    (entityType: string, entityId: string) => call({ action: 'list_contacts', entity_type: entityType, entity_id: entityId }),
    [call]
  );
  const detachContact = useCallback((contactId: string) => call({ action: 'detach_contact', contact_id: contactId }), [call]);
  const listCampaigns = useCallback(() => call({ action: 'list_campaigns' }), [call]);
  const campaignStats = useCallback((campaignId: number) => call({ action: 'campaign_stats', campaign_id: campaignId }), [call]);
  const sendTransactional = useCallback(
    (toEmail: string, toName: string, subject: string, htmlContent: string) =>
      call({ action: 'send_transactional', to_email: toEmail, to_name: toName, subject, html_content: htmlContent }),
    [call]
  );
  const listTemplates = useCallback(() => call({ action: 'list_templates' }), [call]);
  const listNewsletters = useCallback(() => call({ action: 'list_newsletters' }), [call]);
  const linkNewsletter = useCallback(
    (params: { entity_type: string; entity_id: string; campaign_id?: number; campaign_name?: string; campaign_url?: string; custom_url?: string; label?: string }) =>
      call({ action: 'link_newsletter', ...params }),
    [call]
  );
  const getLinkedNewsletters = useCallback(
    (entityType: string, entityId: string) => call({ action: 'get_linked_newsletters', entity_type: entityType, entity_id: entityId }),
    [call]
  );
  const unlinkNewsletter = useCallback((linkId: string) => call({ action: 'unlink_newsletter', link_id: linkId }), [call]);

  return {
    profile, saveApiKey, fetchProfile,
    listLists, searchContacts,
    attachContact, listContacts, detachContact,
    listCampaigns, campaignStats,
    sendTransactional, listTemplates,
    listNewsletters, linkNewsletter, getLinkedNewsletters, unlinkNewsletter,
  };
}
