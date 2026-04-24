import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const db = supabase as any;

export interface EmailAccount {
  id: string;
  user_id: string;
  account_type: 'gmail' | 'imap';
  email_address: string;
  display_name: string | null;
  label: string | null;
  color: string;
  imap_host: string | null;
  imap_port: number | null;
  imap_secure: boolean;
  imap_username: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  smtp_username: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_error: string | null;
  unread_count: number;
  oauth_access_token?: string | null;
  oauth_refresh_token?: string | null;
  oauth_token_expiry?: string | null;
}

export interface EmailMessage {
  id: string;
  account_id: string;
  external_id: string;
  folder: string;
  from_address: string;
  from_name: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string | null;
  preview: string | null;
  body_text: string | null;
  body_html: string | null;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  attachments: any[];
  received_at: string;
}

export function useEmailAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const accountsQuery = useQuery<EmailAccount[]>({
    queryKey: ['email-accounts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await db
        .from('email_accounts')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as EmailAccount[];
    },
    enabled: !!user,
  });

  const totalUnread =
    accountsQuery.data?.reduce((sum, a) => sum + (a.unread_count || 0), 0) || 0;

  const addImapAccount = useMutation({
    mutationFn: async (payload: {
      email_address: string;
      display_name?: string;
      imap_host: string;
      imap_port: number;
      imap_secure: boolean;
      imap_username?: string;
      imap_password: string;
      smtp_host: string;
      smtp_port: number;
      smtp_secure: boolean;
      smtp_username?: string;
      smtp_password?: string;
    }) => {
      if (!user) throw new Error('Non authentifié');
      const { data, error } = await db.from('email_accounts').insert({
        user_id: user.id,
        account_type: 'imap',
        ...payload,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      toast.success('Compte email ajouté');
    },
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('email_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
      toast.success('Compte supprimé');
    },
  });

  const syncAccount = useMutation({
    mutationFn: async (account: EmailAccount) => {
      const { data: { session } } = await supabase.auth.getSession();
      const endpoint =
        account.account_type === 'gmail' ? 'gmail-sync' : 'imap-fetch';
      const body =
        account.account_type === 'gmail'
          ? { account_id: account.id, limit: 25 }
          : { account_id: account.id, folder: 'INBOX', limit: 30 };
      const res = await fetch(
        `https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Échec de synchronisation');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
    },
    onError: (e: any) => toast.error(e.message || 'Sync échouée'),
  });

  // Connect another Gmail account via OAuth (multi-account)
  const connectGmail = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Session expirée');
      return;
    }
    const url = `https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/gmail-account-oauth/authorize?token=${encodeURIComponent(session.access_token)}`;
    window.location.href = url;
  };

  // Auto-import legacy gmail_connections row → email_accounts (one-shot)
  const importLegacyGmail = useMutation({
    mutationFn: async () => {
      if (!user) return null;
      const { data: legacy } = await db
        .from('gmail_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!legacy?.email) return null;

      // Already imported?
      const { data: existing } = await db
        .from('email_accounts')
        .select('id')
        .eq('user_id', user.id)
        .ilike('email_address', legacy.email)
        .maybeSingle();
      if (existing) return null;

      const { data, error } = await db
        .from('email_accounts')
        .insert({
          user_id: user.id,
          account_type: 'gmail',
          email_address: legacy.email,
          display_name: legacy.display_name || legacy.email,
          oauth_access_token: legacy.access_token,
          oauth_refresh_token: legacy.refresh_token,
          oauth_token_expiry: legacy.token_expiry,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
        toast.success('Compte Gmail importé automatiquement');
      }
    },
  });

  return {
    accounts: accountsQuery.data || [],
    isLoading: accountsQuery.isLoading,
    totalUnread,
    addImapAccount,
    deleteAccount,
    syncAccount,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['email-accounts'] }),
  };
}

export function useEmailMessages(accountId: string | null, folder: string = 'INBOX') {
  const { user } = useAuth();
  return useQuery<EmailMessage[]>({
    queryKey: ['email-messages', accountId, folder, user?.id],
    queryFn: async () => {
      if (!user || !accountId) return [];
      const { data, error } = await db
        .from('email_messages')
        .select('*')
        .eq('account_id', accountId)
        .eq('folder', folder)
        .order('received_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as EmailMessage[];
    },
    enabled: !!user && !!accountId,
  });
}

export async function sendEmail(payload: {
  account_id: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  html?: string;
  in_reply_to?: string;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/imap-send-smtp`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Échec d'envoi");
  }
  return res.json();
}

export async function emailAction(payload: {
  account_id: string;
  message_id: string;
  action: 'mark_read' | 'mark_unread' | 'delete';
}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/imap-action`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Action échouée');
  }
  return res.json();
}
