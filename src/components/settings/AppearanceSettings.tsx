import React, { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ImageUp, Trash2, Loader2 } from 'lucide-react';
import {
  useUserLogo,
  notifyUserLogoChanged,
  USER_LOGOS_BUCKET,
  ZENFLOW_LOGO,
  LOGO_MAX_BYTES,
  LOGO_ACCEPTED_TYPES,
} from '@/hooks/useUserLogo';

/**
 * Section « Apparence » : logo personnel de l'utilisateur.
 * Préférence individuelle, indépendante de l'équipe active.
 */
export default function AppearanceSettings() {
  const { user } = useAuth();
  const { logoUrl, storedPath, hasCustomLogo, loading } = useUserLogo();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  /** Contrôle client du type et de la taille avant tout envoi */
  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!LOGO_ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Format non supporté : utilisez PNG, JPEG ou WebP');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error('Fichier trop volumineux : 2 Mo maximum');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const cancelPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
  };

  /** Téléverse le logo dans <auth.uid()>/… puis nettoie l'ancien fichier */
  const handleUpload = async () => {
    if (!user || !pendingFile) return;
    setBusy(true);
    try {
      const ext = pendingFile.type === 'image/png' ? 'png' : pendingFile.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${user.id}/logo-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(USER_LOGOS_BUCKET)
        .upload(path, pendingFile, { contentType: pendingFile.type, upsert: false });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ logo_url: path } as never)
        .eq('id', user.id);
      if (dbErr) throw dbErr;

      // Suppression de l'ancien logo pour éviter les orphelins
      if (storedPath && storedPath !== path) {
        await supabase.storage.from(USER_LOGOS_BUCKET).remove([storedPath]);
      }

      cancelPreview();
      notifyUserLogoChanged();
      toast.success('Logo mis à jour');
    } catch (err) {
      toast.error((err as Error).message || 'Échec du téléversement');
    } finally {
      setBusy(false);
    }
  };

  /** Retour au logo ZenFlow par défaut */
  const handleRemove = async () => {
    if (!user) return;
    setBusy(true);
    try {
      if (storedPath) {
        await supabase.storage.from(USER_LOGOS_BUCKET).remove([storedPath]);
      }
      const { error } = await supabase
        .from('profiles')
        .update({ logo_url: null } as never)
        .eq('id', user.id);
      if (error) throw error;

      cancelPreview();
      notifyUserLogoChanged();
      toast.success('Logo ZenFlow par défaut restauré');
    } catch (err) {
      toast.error((err as Error).message || 'Échec de la suppression');
    } finally {
      setBusy(false);
    }
  };

  const shown = previewUrl ?? (loading ? ZENFLOW_LOGO : logoUrl);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Apparence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Personnalisez le logo affiché dans votre barre latérale. Cette préférence
          est individuelle et s'applique quelle que soit l'équipe active.
        </p>

        <div className="flex items-center gap-4">
          {/* Zone de dimensions fixes : contain pour ne jamais déformer la mise en page */}
          <div className="w-20 h-20 shrink-0 rounded-xl border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
            <img
              src={shown}
              alt="Aperçu du logo"
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = ZENFLOW_LOGO;
              }}
            />
          </div>

          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                type="file"
                accept={LOGO_ACCEPTED_TYPES.join(',')}
                className="hidden"
                onChange={handleSelect}
              />
              <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => inputRef.current?.click()}>
                <ImageUp className="w-4 h-4" />
                Choisir une image
              </Button>

              {pendingFile && (
                <>
                  <Button size="sm" disabled={busy} onClick={handleUpload} className="gap-1.5">
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    Valider
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={cancelPreview}>
                    Annuler
                  </Button>
                </>
              )}

              {hasCustomLogo && !pendingFile && (
                <Button variant="ghost" size="sm" className="gap-1.5 text-destructive" disabled={busy} onClick={handleRemove}>
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, JPEG ou WebP — 2 Mo maximum. Le format SVG n'est pas accepté.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
