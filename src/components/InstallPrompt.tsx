import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa-install-dismissed';

export default function InstallPrompt() {
  const isMobile = useIsMobile();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const ua = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIOS(ios);

    // On iOS, show manual instructions after a delay
    if (ios && isMobile) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }

    // On Android/desktop, wait for the browser install event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (isMobile) {
        setTimeout(() => setVisible(true), 2000);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setVisible(false));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isMobile]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  if (!visible || !isMobile) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-xl border border-border bg-card p-4 shadow-lg flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-card-foreground">Installer Euthymia</p>
          {isIOS ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              Appuyez sur <strong>Partager</strong> (↑) puis <strong>« Sur l'écran d'accueil »</strong>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Accédez à l'app directement depuis votre écran d'accueil
            </p>
          )}
          {!isIOS && deferredPrompt && (
            <Button size="sm" className="mt-2 h-8 text-xs gap-1.5" onClick={handleInstall}>
              <Download className="w-3.5 h-3.5" />
              Installer
            </Button>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
