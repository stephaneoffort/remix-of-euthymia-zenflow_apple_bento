import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useIntegrations, INTEGRATION_CONFIG, type IntegrationKey } from '@/hooks/useIntegrations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Plus, Link2, Unplug } from 'lucide-react';
import BrevoConnectionForm from '@/components/brevo/BrevoConnectionForm';

const CONNECT_URLS: Partial<Record<IntegrationKey, string>> = {
  google_drive: 'https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/google-drive-oauth/authorize',
  zoom: 'https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/zoom-oauth/authorize',
  canva: 'https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/canva-oauth/authorize',
  gmail: 'https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/gmail-oauth/authorize',
  miro: 'https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/miro-oauth/authorize',
  dropbox: 'https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/dropbox-oauth/authorize',
};

const ALL_KEYS: IntegrationKey[] = ['google_drive', 'dropbox', 'gmail', 'google_meet', 'zoom', 'canva', 'miro', 'brevo'];

export default function IntegrationsSettings() {
  const { integrations, loading, toggleEnabled, updateConnected, disconnect, refetch } = useIntegrations();
  const [connInfo, setConnInfo] = useState<Record<string, { email?: string; display_name?: string }>>({});
  const [selectedKey, setSelectedKey] = useState<IntegrationKey | null>(null);
  const [brevoFormOpen, setBrevoFormOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState<IntegrationKey | null>(null);
  const [connInfoVersion, setConnInfoVersion] = useState(0);

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
        .from('miro_connections').select('email, display_name, team_name').eq('user_id', user.id).limit(1);
      if (miroData?.[0]) info.miro = { email: miroData[0].email, display_name: miroData[0].display_name || miroData[0].team_name };

      const { data: dropboxData } = await (supabase as any)
        .from('dropbox_connections').select('email, display_name').eq('user_id', user.id).limit(1);
      if (dropboxData?.[0]) info.dropbox = { email: dropboxData[0].email, display_name: dropboxData[0].display_name };

      const { data: calData } = await (supabase as any)
        .from('calendar_accounts').select('label, calendar_id').eq('user_id', user.id).eq('provider', 'google').eq('is_active', true).limit(1);
      if (calData?.[0]) {
        const calLabel = calData[0].label || calData[0].calendar_id || 'Google Calendar';
        info.google_meet = { display_name: calLabel };
      }

      setConnInfo(info);
    })();

    // OAuth callback detection
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
      setSelectedKey(null);
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
    setConfirmDisconnect(null);
    setSelectedKey(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const selectedConfig = selectedKey ? INTEGRATION_CONFIG[selectedKey] : null;
  const selectedStatus = selectedKey ? integrations[selectedKey] : null;
  const selectedInfo = selectedKey ? connInfo[selectedKey] : null;
  const selectedConnected = selectedStatus?.is_connected ?? false;

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

      <div className="mb-3">
        <h2 className="text-base font-semibold text-foreground">Mes intégrations</h2>
        <p className="text-sm text-muted-foreground">
          Clique sur une intégration pour la connecter ou voir ses informations.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {ALL_KEYS.map(key => {
          const config = INTEGRATION_CONFIG[key];
          const status = integrations[key];
          const connected = status?.is_connected ?? false;

          return (
            <button
              key={key}
              onClick={() => setSelectedKey(key)}
              className={`group relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 text-left ${
                connected
                  ? 'border-green-500/30 bg-green-500/5 hover:border-green-500/50'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              {connected && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center ring-2 ring-background">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </span>
              )}
              <img src={config.icon} alt={config.label} className="w-10 h-10 rounded shrink-0" loading="lazy" />
              <div className="text-center w-full min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{config.label}</p>
                <p className={`text-[11px] mt-0.5 ${connected ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {connected ? 'Connecté' : 'Non connecté'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedKey && !confirmDisconnect} onOpenChange={(v) => { if (!v) setSelectedKey(null); }}>
        <DialogContent className="sm:max-w-md">
          {selectedConfig && selectedKey && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <img src={selectedConfig.icon} alt={selectedConfig.label} className="w-8 h-8 rounded" />
                  {selectedConfig.label}
                  {selectedConnected && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connectée
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription>{selectedConfig.description}</DialogDescription>
              </DialogHeader>

              {selectedConnected ? (
                <div className="space-y-3 py-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Compte connecté</p>
                    {selectedInfo?.email && (
                      <p className="text-sm text-foreground">📧 {selectedInfo.email}</p>
                    )}
                    {selectedInfo?.display_name && (
                      <p className="text-sm text-foreground">👤 {selectedInfo.display_name}</p>
                    )}
                    {!selectedInfo?.email && !selectedInfo?.display_name && (
                      <p className="text-sm text-muted-foreground">Connexion active</p>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" onClick={() => setSelectedKey(null)} className="flex-1">
                      Fermer
                    </Button>
                    {selectedKey !== 'google_meet' && (
                      <Button
                        variant="outline"
                        onClick={() => setConfirmDisconnect(selectedKey)}
                        className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                      >
                        <Unplug className="w-4 h-4" />
                        Déconnecter
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  <div className="rounded-lg border border-dashed border-border p-4 text-center">
                    <Link2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-foreground font-medium">Pas encore connectée</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Connecte ton compte pour activer cette intégration.
                    </p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" onClick={() => setSelectedKey(null)} className="flex-1">
                      Annuler
                    </Button>
                    <Button onClick={() => handleConnect(selectedKey)} className="flex-1 gap-1.5">
                      <Plus className="w-4 h-4" />
                      Se connecter
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Disconnect confirmation */}
      <Dialog open={!!confirmDisconnect} onOpenChange={(v) => !v && setConfirmDisconnect(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDisconnect && <img src={INTEGRATION_CONFIG[confirmDisconnect].icon} alt="" className="w-5 h-5" />}
              Déconnecter {confirmDisconnect ? INTEGRATION_CONFIG[confirmDisconnect].label : ''} ?
            </DialogTitle>
            <DialogDescription>
              Tes données existantes liées à cette intégration seront conservées.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmDisconnect(null)} className="flex-1">
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => { if (confirmDisconnect) handleDisconnect(confirmDisconnect); }}
              className="flex-1"
            >
              Déconnecter
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
            setSelectedKey(null);
            refetch();
            setConnInfoVersion(v => v + 1);
          }} />
        </DialogContent>
      </Dialog>
    </>
  );
}
