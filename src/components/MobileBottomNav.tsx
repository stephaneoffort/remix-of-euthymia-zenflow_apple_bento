import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, List, Calendar, BarChart3, MessageCircle, Menu, Plus, Filter, Home, GitFork } from 'lucide-react';
import { ViewType } from '@/types';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const VIEW_ICONS: Record<ViewType, React.ReactNode> = {
  kanban: <LayoutGrid className="w-5 h-5" />,
  list: <List className="w-5 h-5" />,
  calendar: <Calendar className="w-5 h-5" />,
  workload: <BarChart3 className="w-5 h-5" />,
  mindmap: <BarChart3 className="w-5 h-5" />,
};

const VIEW_LABELS: Record<ViewType, string> = {
  kanban: 'Kanban',
  list: 'Liste',
  calendar: 'Agenda',
  workload: 'Charge',
  mindmap: 'Carte',
};

export default function MobileBottomNav() {
  const { selectedView, setSelectedView, setSidebarCollapsed, addTask, selectedProjectId, getListsForProject } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { totalUnread } = useChatNotifications();
  const [viewSheetOpen, setViewSheetOpen] = useState(false);

  const isChat = location.pathname === '/chat';
  const isHome = location.pathname === '/';

  const handleQuickAdd = () => {
    const lists = selectedProjectId ? getListsForProject(selectedProjectId) : [];
    const listId = lists[0]?.id || 'l1';
    // We'll just open the sidebar for now or trigger add
    // For simplicity, navigate home and the user can add from there
    if (!isHome) navigate('/');
  };

  const views: ViewType[] = ['list', 'kanban', 'calendar', 'workload', 'mindmap'];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {/* Menu / Sidebar */}
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 text-muted-foreground active:text-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Menu</span>
        </button>

        {/* View switcher */}
        <Sheet open={viewSheetOpen} onOpenChange={setViewSheetOpen}>
          <SheetTrigger asChild>
            <button
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 transition-colors ${
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

        {/* Home */}
        <button
          onClick={() => { if (!isHome) navigate('/'); }}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 transition-colors ${
            isHome ? 'text-primary' : 'text-muted-foreground'
          } active:text-foreground`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Accueil</span>
        </button>

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
