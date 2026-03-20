import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export function usePresence() {
  const { teamMemberId } = useAuth();
  const [onlineMembers, setOnlineMembers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!teamMemberId) return;

    const channel = supabase.channel('online-presence', {
      config: { presence: { key: teamMemberId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>(Object.keys(state));
        setOnlineMembers(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ member_id: teamMemberId, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamMemberId]);

  return { onlineMembers, isOnline: (id: string) => onlineMembers.has(id) };
}
