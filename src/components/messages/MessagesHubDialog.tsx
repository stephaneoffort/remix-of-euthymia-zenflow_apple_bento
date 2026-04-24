import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MessageCircle, AtSign, Mail, ArrowLeft } from 'lucide-react';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import MentionsPanel from './MentionsPanel';
import EmailHub from './EmailHub';

const db = supabase as any;

type ActiveTile = 'home' | 'mentions' | 'email';

interface MessagesHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTile?: ActiveTile;
}

export default function MessagesHubDialog({ open, onOpenChange, initialTile = 'home' }: MessagesHubDialogProps) {
  const navigate = useNavigate();
  const { teamMemberId } = useAuth();
  const { totalUnread: chatUnread } = useChatNotifications();
  const { totalUnread: emailUnread } = useEmailAccounts();
  const [activeTile, setActiveTile] = useState<ActiveTile>(initialTile);

  // Sync to initialTile whenever the dialog is (re)opened
  useEffect(() => {
    if (open) setActiveTile(initialTile);
  }, [open, initialTile]);

  const { data: mentionsCount = 0 } = useQuery<number>({
    queryKey: ['mentions-count', teamMemberId],
    queryFn: async () => {
      if (!teamMemberId) return 0;
      const { count } = await db
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .contains('mentioned_member_ids', [teamMemberId]);
      return count || 0;
    },
    enabled: !!teamMemberId && open,
  });

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) setActiveTile(initialTile);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl h-[600px] p-0 gap-0 overflow-hidden flex flex-col bg-popover text-popover-foreground">
        {activeTile === 'home' ? (
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-xl font-semibold">Messages</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Tous vos espaces de communication au même endroit
              </p>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 p-6">
              <Tile
                icon={<MessageCircle className="w-7 h-7" />}
                title="Chat d'équipe"
                description="Conversations en temps réel"
                count={chatUnread}
                color="from-blue-500 to-cyan-500"
                onClick={() => { onOpenChange(false); navigate('/chat'); }}
              />
              <Tile
                icon={<AtSign className="w-7 h-7" />}
                title="Mes mentions"
                description="Quand on vous interpelle"
                count={mentionsCount}
                color="from-violet-500 to-purple-500"
                onClick={() => setActiveTile('mentions')}
              />
              <Tile
                icon={<Mail className="w-7 h-7" />}
                title="Email"
                description="Vos boîtes mail externes"
                count={emailUnread}
                color="from-amber-500 to-orange-500"
                onClick={() => setActiveTile('email')}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b border-border flex items-center">
              <button
                onClick={() => setActiveTile('home')}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
              >
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {activeTile === 'mentions' && <MentionsPanel />}
              {activeTile === 'email' && <EmailHub />}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Tile({
  icon, title, description, count, color, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  count: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-start text-left p-5 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-lg transition-all overflow-hidden"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-5 transition-opacity`} />
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} text-white flex items-center justify-center mb-3 shadow-sm`}>
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
      {count > 0 && (
        <span className="absolute top-3 right-3 min-w-[24px] h-6 px-2 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
