import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { INTEGRATION_CONFIG, type IntegrationKey } from '@/hooks/useIntegrations';
import { Settings } from 'lucide-react';

const GUIDE_MESSAGES: Record<IntegrationKey, string> = {
  zoom: 'Tu dois connecter ton compte Zoom personnel dans Settings → Intégrations → Zoom',
  google_drive: 'Connecte ton compte Google Drive dans Settings → Intégrations → Google Drive pour joindre des fichiers',
  canva: 'Connecte ton compte Canva dans Settings → Intégrations → Canva pour lier des designs',
  google_meet: 'Active Google Meet dans Settings → Intégrations pour ajouter des liens Meet',
  gmail: 'Connecte ton compte Gmail dans Settings → Intégrations → Gmail pour lire et envoyer des emails',
  brevo: 'Connecte ton compte Brevo dans Settings → Intégrations → Brevo pour gérer tes newsletters',
  google_chat: 'Connecte ton compte Google Chat dans Settings → Intégrations → Google Chat pour recevoir tes mentions',
};

interface Props {
  integrationKey: IntegrationKey;
  compact?: boolean;
}

export default function IntegrationGuide({ integrationKey, compact }: Props) {
  const navigate = useNavigate();
  const config = INTEGRATION_CONFIG[integrationKey];
  const message = GUIDE_MESSAGES[integrationKey];

  if (compact) {
    return (
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-2 w-full py-2.5 px-3 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
      >
        <img src={config.icon} alt="" className="w-4 h-4 shrink-0" />
        <span className="text-left">{message}</span>
        <Settings className="w-3.5 h-3.5 ml-auto shrink-0" />
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 p-6 border border-dashed border-border rounded-xl text-center">
      <img src={config.icon} alt={config.label} className="w-8 h-8" />
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
      <Button variant="outline" size="sm" onClick={() => navigate('/settings')} className="gap-1.5">
        <Settings className="w-3.5 h-3.5" />
        Aller dans Settings
      </Button>
    </div>
  );
}
