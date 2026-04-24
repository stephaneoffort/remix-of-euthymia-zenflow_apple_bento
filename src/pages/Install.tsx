import React, { useEffect, useState } from 'react';
import { Download, Smartphone, Monitor, Apple, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform('ios');
    else if (/android/.test(ua)) setPlatform('android');
    else setPlatform('desktop');

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Download className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Déjà installée ✓</CardTitle>
            <CardDescription>
              Euthymia est installée sur votre appareil. L'app se met à jour automatiquement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Ouvrir l'application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <img src="/pwa-192x192.png" alt="Euthymia" className="w-20 h-20 mx-auto rounded-2xl" />
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Installer Euthymia</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Installez l'application sur votre appareil pour y accéder rapidement. Les mises à jour sont automatiques.
          </p>
        </div>

        {deferredPrompt && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6 text-center">
              <Button size="lg" onClick={handleInstall} className="gap-2">
                <Download className="w-5 h-5" />
                Installer maintenant
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className={platform === 'android' ? 'ring-2 ring-primary' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Android</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Ouvrir dans <strong>Chrome</strong></p>
              <p>2. Menu ⋮ → <strong>« Installer l'application »</strong></p>
              <p>3. Confirmer l'installation</p>
            </CardContent>
          </Card>

          <Card className={platform === 'ios' ? 'ring-2 ring-primary' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Apple className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">iPhone / iPad</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Ouvrir dans <strong>Safari</strong></p>
              <p>2. Appuyer sur <strong>Partager</strong> (↑)</p>
              <p>3. <strong>« Sur l'écran d'accueil »</strong></p>
            </CardContent>
          </Card>

          <Card className={platform === 'desktop' ? 'ring-2 ring-primary' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Chrome className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Windows / Linux</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Ouvrir dans <strong>Chrome</strong> ou <strong>Edge</strong></p>
              <p>2. Cliquer sur l'icône ⊕ dans la barre d'adresse</p>
              <p>3. <strong>« Installer »</strong></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">macOS</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Ouvrir dans <strong>Chrome</strong> ou <strong>Edge</strong></p>
              <p>2. Menu → <strong>« Installer Euthymia »</strong></p>
              <p>3. Confirmer</p>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          L'application se met à jour automatiquement à chaque visite. Aucune action nécessaire.
        </p>
      </div>
    </div>
  );
}
