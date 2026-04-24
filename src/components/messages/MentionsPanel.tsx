import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useState } from 'react';
import { AtSign, MessageSquare, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const db = supabase as any;

interface MentionRow {
  id: string;
  content: string;
  created_at: string;
  task_id: string;
  author_id: string;
}

export default function MentionsPanel() {
  const { user, teamMemberId } = useAuth();
  const { tasks, teamMembers, setSelectedTaskId } = useApp();

  const { data: mentions = [], isLoading } = useQuery<MentionRow[]>({
    queryKey: ['my-mentions', teamMemberId],
    queryFn: async () => {
      if (!teamMemberId) return [];
      const { data, error } = await db
        .from('comments')
        .select('id, content, created_at, task_id, author_id')
        .contains('mentioned_member_ids', [teamMemberId])
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as MentionRow[];
    },
    enabled: !!teamMemberId,
  });

  const getTask = (id: string) => tasks.find(t => t.id === id);
  const getMember = (id: string) => teamMembers.find(m => m.id === id);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AtSign className="w-5 h-5 text-primary" />
          Mes mentions
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {mentions.length} commentaire{mentions.length !== 1 ? 's' : ''} où vous êtes mentionné
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && (
          <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
        )}
        {!isLoading && mentions.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <AtSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune mention pour l'instant</p>
            <p className="text-xs mt-1">Vous serez notifié ici quand on vous @mentionne dans un commentaire.</p>
          </div>
        )}
        <div className="space-y-2">
          {mentions.map(m => {
            const task = getTask(m.task_id);
            const author = getMember(m.author_id);
            return (
              <button
                key={m.id}
                onClick={() => task && setSelectedTaskId(task.id)}
                className="w-full text-left p-3 rounded-lg bg-card hover:bg-muted border border-border transition-colors group"
              >
                <div className="flex items-start gap-3">
                  {author && (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: author.avatarColor }}
                    >
                      {author.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {author?.name || 'Inconnu'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 line-clamp-2 mb-2"
                       dangerouslySetInnerHTML={{ __html: m.content }} />
                    {task && (
                      <div className="flex items-center gap-1 text-xs text-primary opacity-70 group-hover:opacity-100">
                        <MessageSquare className="w-3 h-3" />
                        <span className="truncate">{task.title}</span>
                        <ArrowRight className="w-3 h-3 ml-auto" />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
