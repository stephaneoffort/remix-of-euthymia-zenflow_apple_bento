import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    let redirected = false;
    let unsubscribe: (() => void) | undefined;

    const doRedirect = () => {
      if (redirected) return;
      redirected = true;
      setStatus('success');
      toast.success('Email confirmé ! Bienvenue sur Euthymia.');
      setTimeout(() => navigate('/', { replace: true }), 1500);
    };

    // Check if session is already established (Supabase may have processed the hash)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        doRedirect();
        return;
      }

      // Listen for the auth event triggered when Supabase processes the URL hash/code
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          doRedirect();
        } else if (event === 'PASSWORD_RECOVERY') {
          navigate('/reset-password', { replace: true });
        }
      });
      unsubscribe = () => subscription.unsubscribe();
    });

    const timeout = setTimeout(() => {
      if (!redirected) setStatus('error');
    }, 7000);

    return () => {
      clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="text-center space-y-4 max-w-xs">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
            <p className="text-muted-foreground text-sm">Vérification de votre email…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="font-semibold text-foreground text-lg">Email confirmé !</p>
            <p className="text-muted-foreground text-sm">Redirection en cours…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="font-semibold text-foreground">Lien expiré ou invalide</p>
            <p className="text-muted-foreground text-sm">
              Ce lien de confirmation a peut-être déjà été utilisé ou a expiré.
            </p>
            <Button variant="outline" onClick={() => navigate('/auth', { replace: true })}>
              Retour à la connexion
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
