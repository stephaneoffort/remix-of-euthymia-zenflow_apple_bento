import { useApp } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { useThemeMode } from '@/context/ThemeContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';
import AppSidebar from '@/components/AppSidebar';
import SidebarNM from '@/components/SidebarNM';
import MobileBottomNav from '@/components/MobileBottomNav';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TimerTab from '@/components/time/TimerTab';
import EntriesTab from '@/components/time/EntriesTab';
import SummaryTab from '@/components/time/SummaryTab';
import { PanelLeft, Timer, ArrowLeft } from 'lucide-react';

export default function TimePage() {
  const { sidebarCollapsed, setSidebarCollapsed } = useApp();
  const { currentOrg } = useOrg();
  const { designMode } = useThemeMode();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  return (
    <div className={`flex h-[100dvh] relative overflow-hidden ${designMode === 'neumorphic' ? 'nm-chat' : ''}`}>
      {!isMobile && !sidebarCollapsed && (designMode === 'neumorphic' ? <SidebarNM /> : <AppSidebar />)}
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
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Retour aux tâches"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Timer className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-semibold text-foreground text-sm">Temps</h1>
            <p className="text-[11px] text-muted-foreground truncate">
              {currentOrg ? `Équipe ${currentOrg.name}` : 'Suivi du temps'}
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Retour aux tâches
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-4 sm:p-6 pb-24">
            {/* key = équipe active : tout le module se recharge à la bascule d'équipe */}
            <Tabs defaultValue="timer" key={currentOrg?.id ?? 'none'}>
              <TabsList className="mb-4">
                <TabsTrigger value="timer">Chronomètre</TabsTrigger>
                <TabsTrigger value="entries">Relevés</TabsTrigger>
                <TabsTrigger value="summary">Synthèse</TabsTrigger>
              </TabsList>
              <TabsContent value="timer">
                <TimerTab />
              </TabsContent>
              <TabsContent value="entries">
                <EntriesTab />
              </TabsContent>
              <TabsContent value="summary">
                <SummaryTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {isMobile && <MobileBottomNav />}
    </div>
  );
}
