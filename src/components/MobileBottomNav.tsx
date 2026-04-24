import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, Menu, Plus, Home, Mic } from 'lucide-react';
import { Priority, PRIORITY_LABELS } from '@/types';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MobileBottomNavProps {
  onOpenVoice?: () => void;
}

export default function MobileBottomNav({ onOpenVoice }: MobileBottomNavProps) {
  const { setSidebarCollapsed, addTask, selectedProjectId, selectedSpaceId, getListsForProject, projects, spaces, quickFilter } = useApp();
  const { teamMemberId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { totalUnread } = useChatNotifications();
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const initialSpaceId = (() => {
    const proj = projects.find(p => p.id === selectedProjectId);
    return proj?.spaceId || selectedSpaceId || spaces[0]?.id || '';
  })();

  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('normal');
  const [newSpaceId, setNewSpaceId] = useState<string>(initialSpaceId);
  const [newProjectId, setNewProjectId] = useState<string>(selectedProjectId || '');

  const isChat = location.pathname === '/chat';
  const isHome = location.pathname === '/';

  const handleQuickAddSubmit = () => {
    const targetProjectId = newProjectId || selectedProjectId;
    if (!newTitle.trim() || !targetProjectId) return;

    const lists = getListsForProject(targetProjectId);
    const listId = lists[0]?.id;
    if (!listId) return;

    addTask({
      title: newTitle.trim(),
      description: '',
      status: 'todo',
      priority: newPriority,
      dueDate: null,
      startDate: null,
      assigneeIds: quickFilter === 'my_tasks' && teamMemberId ? [teamMemberId] : [],
      tags: [],
      parentTaskId: null,
      listId,
      comments: [],
      attachments: [],
      timeEstimate: null,
      timeLogged: null,
      aiSummary: null,
    });

    setNewTitle('');
    setNewPriority('normal');
    setQuickAddOpen(false);
    if (!isHome) navigate('/');
  };

  const visibleSpaces = spaces.filter(s => !s.isArchived);
  const projectsForSpace = projects.filter(p => p.spaceId === newSpaceId && !p.isArchived);

  // Sync project si l'espace change
  React.useEffect(() => {
    if (!newSpaceId) return;
    if (!projectsForSpace.find(p => p.id === newProjectId)) {
      setNewProjectId(projectsForSpace[0]?.id || '');
    }
  }, [newSpaceId, projects]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14 px-2">
        {/* Home */}
        <button
          onClick={() => { if (!isHome) navigate('/'); }}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 transition-colors ${
            isHome && !isChat ? 'text-primary' : 'text-muted-foreground'
          } active:text-foreground`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Accueil</span>
        </button>

        {/* Quick Add - central prominent button */}
        <Drawer open={quickAddOpen} onOpenChange={(open) => {
          setQuickAddOpen(open);
          if (open && !newProjectId && selectedProjectId) {
            setNewProjectId(selectedProjectId);
          }
        }}>
          <DrawerTrigger asChild>
            <button className="flex items-center justify-center w-12 h-12 -mt-5 rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform">
              <Plus className="w-6 h-6" />
            </button>
          </DrawerTrigger>
          <DrawerContent className="pb-[env(safe-area-inset-bottom)]">
            <div className="px-4 pt-2 pb-6">
              <DrawerTitle className="text-base font-semibold text-foreground mb-4">Nouvelle tâche</DrawerTitle>

              <div className="space-y-3">
                <Input
                  autoFocus
                  placeholder="Titre de la tâche…"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleQuickAddSubmit(); }}
                  className="text-base h-11"
                />

                <Select value={newSpaceId} onValueChange={setNewSpaceId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Espace…" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleSpaces.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Select value={newProjectId} onValueChange={setNewProjectId} disabled={!newSpaceId}>
                    <SelectTrigger className="flex-1 h-10">
                      <SelectValue placeholder="Projet…" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectsForSpace.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={newPriority} onValueChange={v => setNewPriority(v as Priority)}>
                    <SelectTrigger className="w-[120px] h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['low', 'normal', 'high', 'urgent'] as Priority[]).map(p => (
                        <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleQuickAddSubmit}
                    disabled={!newTitle.trim() || !newProjectId}
                    className="flex-1 h-11 text-base"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Créer la tâche
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setQuickAddOpen(false); if (onOpenVoice) setTimeout(onOpenVoice, 350); }}
                    className="h-11 px-4"
                    title="Dicter une tâche"
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Chat */}
        <button
          onClick={() => navigate('/chat')}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 relative transition-colors ${
            isChat ? 'text-primary' : 'text-muted-foreground'
          } active:text-foreground`}
        >
          <div className="relative">
            <MessageCircle className="w-5 h-5" />
            {totalUnread > 0 && (
              <span data-numeric className="font-numeric tabular-nums absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Chat</span>
        </button>

        {/* Menu / Sidebar */}
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 text-muted-foreground active:text-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </div>

    </div>
  );
}
