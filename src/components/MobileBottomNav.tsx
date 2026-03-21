import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, List, Calendar, BarChart3, MessageCircle, Menu, Plus, Home, Network, ChevronDown } from 'lucide-react';
import { ViewType, Priority, PRIORITY_LABELS } from '@/types';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const VIEW_ICONS: Record<ViewType, React.ReactNode> = {
  kanban: <LayoutGrid className="w-5 h-5" />,
  list: <List className="w-5 h-5" />,
  calendar: <Calendar className="w-5 h-5" />,
  workload: <BarChart3 className="w-5 h-5" />,
  mindmap: <Network className="w-5 h-5" />,
};

const VIEW_LABELS: Record<ViewType, string> = {
  kanban: 'Kanban',
  list: 'Liste',
  calendar: 'Agenda',
  workload: 'Charge',
  mindmap: 'Mind Map',
};

export default function MobileBottomNav() {
  const { selectedView, setSelectedView, setSidebarCollapsed, addTask, selectedProjectId, getListsForProject, projects, spaces } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { totalUnread } = useChatNotifications();
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Quick add form state
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('normal');
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
      assigneeIds: [],
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

  const views: ViewType[] = ['list', 'kanban', 'calendar', 'workload', 'mindmap'];

  // Build project options with space names
  const projectOptions = projects.map(p => {
    const space = spaces.find(s => s.id === p.spaceId);
    return { id: p.id, label: space ? `${space.name} › ${p.name}` : p.name };
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {/* Menu / Sidebar */}
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 text-muted-foreground active:text-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Menu</span>
        </button>

        {/* View switcher */}
        <Sheet open={viewSheetOpen} onOpenChange={setViewSheetOpen}>
          <SheetTrigger asChild>
            <button
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 transition-colors ${
                isHome && !isChat ? 'text-primary' : 'text-muted-foreground'
              } active:text-foreground`}
            >
              {VIEW_ICONS[selectedView]}
              <span className="text-[10px] font-medium">{VIEW_LABELS[selectedView]}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
            <div className="pt-2 pb-4">
              <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
              <p className="text-sm font-semibold text-foreground mb-3 px-1">Changer de vue</p>
              <div className="grid grid-cols-2 gap-2">
                {views.map(v => (
                  <button
                    key={v}
                    onClick={() => {
                      setSelectedView(v);
                      setViewSheetOpen(false);
                      if (!isHome) navigate('/');
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      selectedView === v
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-muted/50 text-foreground hover:bg-muted'
                    }`}
                  >
                    {VIEW_ICONS[v]}
                    {VIEW_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>

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
          <DrawerContent className="pb-safe">
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

                <div className="flex gap-2">
                  <Select value={newProjectId} onValueChange={setNewProjectId}>
                    <SelectTrigger className="flex-1 h-10">
                      <SelectValue placeholder="Projet…" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectOptions.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
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

                <Button
                  onClick={handleQuickAddSubmit}
                  disabled={!newTitle.trim() || !newProjectId}
                  className="w-full h-11 text-base"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Créer la tâche
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Home */}
        <button
          onClick={() => { if (!isHome) navigate('/'); }}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 transition-colors ${
            isHome ? 'text-primary' : 'text-muted-foreground'
          } active:text-foreground`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Accueil</span>
        </button>

        {/* Chat */}
        <button
          onClick={() => navigate('/chat')}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 relative transition-colors ${
            isChat ? 'text-primary' : 'text-muted-foreground'
          } active:text-foreground`}
        >
          <div className="relative">
            <MessageCircle className="w-5 h-5" />
            {totalUnread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Chat</span>
        </button>
      </div>
    </div>
  );
}
