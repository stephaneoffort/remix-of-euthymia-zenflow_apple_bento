import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface Props {
  onConnected?: () => void;
}

const BREVO_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/brevo-api`;

const BrevoConnectionForm = React.forwardRef<HTMLFormElement, Props>(function BrevoConnectionForm({ onConnected }, ref) {
  const [apiKey, setApiKey] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setLoading(true);
    try {
      console.log("API key entered:", apiKey);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Non authentifié. Reconnectez-vous.");
        return;
      }

      const res = await fetch(BREVO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "save_api_key",
          api_key: apiKey.trim(),
        }),
      });

      console.log("Response status:", res.status);
      const data = await res.json();
      console.log("Brevo response:", data);

      if (data.error) {
        toast.error(`Erreur : ${data.error}`);
      } else if (data.success) {
        toast.success(`Brevo connecté ✅ — ${data.account?.email ?? ''}`);
        onConnected?.();
      } else {
        toast.error("Réponse inattendue du serveur");
      }
    } catch (err: any) {
      console.error("Brevo connect error:", err);
      toast.error(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="brevo-key" className="text-sm font-medium text-foreground">
          Clé API Brevo
        </Label>
        <div className="relative">
          <Input
            id="brevo-key"
            type={show ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="xkeysib-..."
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <a
          href="https://app.brevo.com/settings/keys/api"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Trouver ma clé API <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Comment trouver ta clé API :</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Va sur app.brevo.com</li>
          <li>Clique sur ton nom → SMTP & API</li>
          <li>Onglet « API Keys »</li>
          <li>Clique « Generate a new API key »</li>
          <li>Copie la clé et colle-la ici</li>
        </ol>
      </div>

      <Button type="submit" disabled={loading || !apiKey.trim()} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Connecter Brevo
      </Button>
    </form>
  );
});

export default BrevoConnectionForm;