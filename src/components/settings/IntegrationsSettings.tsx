import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useIntegrations, INTEGRATION_CONFIG, type IntegrationKey } from '@/hooks/useIntegrations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import BrevoConnectionForm from '@/components/brevo/BrevoConnectionForm';

const CONNECT_URLS: Partial<Record<IntegrationKey, string>> = {
  google_drive: 'https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/google-drive-oauth/authorize',
  zoom: 'https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/zoom-oauth/authorize',
  canva: 'https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/canva-oauth/authorize',
  gmail: 'https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/gmail-oauth/authorize',
  miro: 'https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/miro-oauth/authorize',
};

const CONNECTION_TABLES: Partial<Record<IntegrationKey, string>> = {
  google_drive: 'drive_connections',
  zoom: 'zoom_connections',
  canva: 'canva_connections',
  gmail: 'gmail_connections',
  miro: 'miro_connections',
};

export default function IntegrationsSettings() {
  const { integrations, loading, toggleEnabled, updateConnected, disconnect, refetch } = useIntegrations();
  const [connInfo, setConnInfo] = useState<Record<string, { email?: string; display_name?: string }>>({});
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'connect' | 'disconnect'; key: IntegrationKey } | null>(null);
  const [brevoFormOpen, setBrevoFormOpen] = useState(false);
  const [connInfoVersion, setConnInfoVersion] = useState(0);

  // Fetch connection info for display
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const info: Record<string, { email?: string; display_name?: string }> = {};

      const { data: driveData } = await (supabase as any)
        .from('drive_connections').select('email').eq('user_id', user.id).limit(1);
      if (driveData?.[0]) info.google_drive = { email: driveData[0].email };

      const { data: canvaData } = await (supabase as any)
        .from('canva_connections').select('email, display_name').eq('user_id', user.id).limit(1);
      if (canvaData?.[0]) info.canva = { email: canvaData[0].email, display_name: canvaData[0].display_name };

      const { data: zoomData } = await (supabase as any)
        .from('zoom_connections').select('email, display_name').eq('user_id', user.id).limit(1);
      if (zoomData?.[0]) info.zoom = { email: zoomData[0].email, display_name: zoomData[0].display_name };

      const { data: brevoData } = await (supabase as any)
        .from('brevo_connections').select('account_email, account_name, plan').eq('user_id', user.id).limit(1);
      if (brevoData?.[0]) info.brevo = { email: brevoData[0].account_email, display_name: `${brevoData[0].account_name ?? ''} (${brevoData[0].plan ?? 'free'})` };

      const { data: gmailData } = await (supabase as any)
        .from('gmail_connections').select('email, display_name').eq('user_id', user.id).limit(1);
      if (gmailData?.[0]) info.gmail = { email: gmailData[0].email, display_name: gmailData[0].display_name };

      const { data: miroData } = await (supabase as any)
        .from('miro_connections').select('email, display_name').eq('user_id', user.id).limit(1);
      if (miroData?.[0]) info.miro = { email: miroData[0].email, display_name: miroData[0].display_name };

      // Google Calendar / Meet uses calendar_accounts
      const { data: calData } = await (supabase as any)
        .from('calendar_accounts').select('label, calendar_id').eq('user_id', user.id).eq('provider', 'google').eq('is_active', true).limit(1);
      if (calData?.[0]) {
        const calLabel = calData[0].label || calData[0].calendar_id || 'Google Calendar';
        info.google_meet = { display_name: calLabel };
      }

      setConnInfo(info);
    })();

    // Detect OAuth callback params
    const params = new URLSearchParams(window.location.search);
    const callbacks: [string, IntegrationKey][] = [
      ['drive_connected', 'google_drive'],
      ['zoom_connected', 'zoom'],
      ['canva_connected', 'canva'],
      ['gmail_connected', 'gmail'],
      ['miro_connected', 'miro'],
    ];
    callbacks.forEach(([param, key]) => {
      if (params.get(param) === 'true') {
        updateConnected(key, true);
        toggleEnabled(key, true);
        window.history.replaceState({}, '', window.location.pathname);
        toast.success(`${INTEGRATION_CONFIG[key].label} connecté !`);
      }
    });
  }, [connInfoVersion]);

  const handleConnect = async (key: IntegrationKey) => {
    if (key === 'google_meet') {
      await toggleEnabled('google_meet', true);
      await updateConnected('google_meet', true);
      toast.success('Google Meet activé');
      return;
    }

    if (key === 'brevo') {
      setBrevoFormOpen(true);
      return;
    }

    const url = CONNECT_URLS[key];
    if (!url) return;

    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    if (!user || !session) return;

    if (key === 'zoom' || key === 'gmail' || key === 'miro') {
      window.location.href = `${url}?token=${session.access_token}`;
    } else {
      window.location.href = `${url}?user_id=${user.id}`;
    }
  };

  const handleDisconnect = async (key: IntegrationKey) => {
    await disconnect(key);
    setConnInfo(prev => { const n = { ...prev }; delete n[key]; return n; });
    toast.success(`${INTEGRATION_CONFIG[key].label} déconnecté`);
    setConfirmDialog(null);
  };

  const handleToggle = async (key: IntegrationKey, checked: boolean) => {
    if (checked) {
      // Enable: ask to connect if not yet connected
      await toggleEnabled(key, true);
      if (key !== 'google_meet' && !integrations[key]?.is_connected) {
        setConfirmDialog({ type: 'connect', key });
      } else if (key === 'google_meet') {
        await updateConnected('google_meet', true);
        toast.success('Google Meet activé');
      }
    } else {
      // Disable: confirm dialog
      if (integrations[key]?.is_connected) {
        setConfirmDialog({ type: 'disconnect', key });
      } else {
        await toggleEnabled(key, false);
      }
    }
  };

  const allKeys: IntegrationKey[] = ['google_drive', 'zoom', 'canva', 'google_meet', 'gmail', 'brevo', 'miro'];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Privacy banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5 mb-4">
        <span className="text-lg mt-0.5">🔒</span>
        <div>
          <p className="text-sm font-semibold text-foreground">Tes intégrations sont personnelles</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connecte tes propres comptes Google, Zoom, Canva etc. Tes connexions sont privées — les autres membres ne les voient pas.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Mes intégrations</CardTitle>
          <p className="text-sm text-muted-foreground">
            Active les outils que tu utilises. Chaque membre gère ses propres connexions.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {allKeys.map(key => {
            const config = INTEGRATION_CONFIG[key];
            const status = integrations[key];
            const info = connInfo[key];
            const enabled = status?.is_enabled ?? false;
            const connected = status?.is_connected ?? false;

            return (
              <div
                key={key}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                  enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20'
                }`}
              >
                <img src={config.icon} alt={config.label} className="w-7 h-7 shrink-0 rounded" loading="lazy" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{config.label}</p>
                  {!enabled && (
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  )}
                  {enabled && connected && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Connecté{info?.email ? ` · ${info.email}` : ''}{info?.display_name ? ` (${info.display_name})` : ''}
                    </p>
                  )}
                  {enabled && !connected && key !== 'google_meet' && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Activée — connexion requise
                    </p>
                  )}
                  {enabled && key === 'google_meet' && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Utilise ton compte Google Calendar connecté
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {enabled && !connected && key !== 'google_meet' && (
                    <Button size="sm" variant="outline" onClick={() => handleConnect(key)} className="text-xs gap-1.5">
                      Connecter
                    </Button>
                  )}
                  {enabled && connected && key !== 'google_meet' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDialog({ type: 'disconnect', key })}
                      className="text-xs text-destructive hover:text-destructive"
                    >
                      Déconnecter
                    </Button>
                  )}
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => handleToggle(key, v)}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Connect Dialog */}
      <Dialog open={confirmDialog?.type === 'connect'} onOpenChange={(v) => !v && setConfirmDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog && <img src={INTEGRATION_CONFIG[confirmDialog.key].icon} alt="" className="w-5 h-5" />}
              Connexion requise
            </DialogTitle>
            <DialogDescription>
              Pour activer {confirmDialog ? INTEGRATION_CONFIG[confirmDialog.key].label : ''}, connecte ton compte.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmDialog(null)} className="flex-1">
              Plus tard
            </Button>
            <Button
              onClick={() => { if (confirmDialog) handleConnect(confirmDialog.key); setConfirmDialog(null); }}
              className="flex-1"
            >
              Connecter maintenant
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disconnect Dialog */}
      <Dialog open={confirmDialog?.type === 'disconnect'} onOpenChange={(v) => !v && setConfirmDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog && <img src={INTEGRATION_CONFIG[confirmDialog.key].icon} alt="" className="w-5 h-5" />}
              Désactiver {confirmDialog ? INTEGRATION_CONFIG[confirmDialog.key].label : ''} ?
            </DialogTitle>
            <DialogDescription>
              Tes données existantes liées à cette intégration seront conservées.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmDialog(null)} className="flex-1">
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => { if (confirmDialog) handleDisconnect(confirmDialog.key); }}
              className="flex-1"
            >
              Désactiver
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Brevo API Key Dialog */}
      <Dialog open={brevoFormOpen} onOpenChange={setBrevoFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <img src={INTEGRATION_CONFIG.brevo.icon} alt="Brevo" className="w-5 h-5" /> Connecter Brevo
            </DialogTitle>
            <DialogDescription>
              Entre ta clé API Brevo pour activer l'intégration.
            </DialogDescription>
          </DialogHeader>
          <BrevoConnectionForm onConnected={() => {
            setBrevoFormOpen(false);
            refetch();
            setConnInfoVersion(v => v + 1);
          }} />
        </DialogContent>
      </Dialog>
    </>
  );
}
