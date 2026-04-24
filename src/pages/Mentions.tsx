import { useApp } from '@/context/AppContext';
import { useThemeMode } from '@/context/ThemeContext';
import { useIsMobile } from '@/hooks/use-mobile';
import AppSidebar from '@/components/AppSidebar';
import SidebarNM from '@/components/SidebarNM';
import MobileBottomNav from '@/components/MobileBottomNav';
import MentionsPanel from '@/components/messages/MentionsPanel';
import { PanelLeft, AtSign } from 'lucide-react';

export default function MentionsPage() {
  const { sidebarCollapsed, setSidebarCollapsed } = useApp();
  const { designMode } = useThemeMode();
  const isMobile = useIsMobile();

  return (
    <div className={`flex h-[100dvh] relative overflow-hidden ${designMode === 'neumorphic' ? 'nm-chat' : ''}`}>
      {!isMobile && !sidebarCollapsed && (
        designMode === 'neumorphic' ? <SidebarNM /> : <AppSidebar />
      )}
      {!isMobile && sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="absolute top-3 left-3 z-50 p-1.5 rounded-md bg-card/80 backdrop-blur-md border border-border hover:bg-muted transition-colors"
          title="Afficher la barre latérale"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
      )}

      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <header className="h-14 shrink-0 border-b border-border bg-card flex items-center px-4 gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <AtSign className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-foreground text-sm">Mes mentions</h1>
            <p className="text-[11px] text-muted-foreground">Quand on vous interpelle dans des commentaires</p>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          <MentionsPanel />
        </div>
      </div>

      {isMobile && <MobileBottomNav />}
    </div>
  );
}
