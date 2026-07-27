import React, { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2, ImagePlus } from 'lucide-react';

export const AVATAR_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 Mo
export const AVATAR_MIN_SIZE_PX = 64;
const AVATAR_TARGET_PX = 512;
const TEN_YEARS = 60 * 60 * 24 * 3650;

/** Extrait le chemin objet d'une URL signée Supabase Storage du bucket avatars. */
export function extractAvatarPath(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/object\/(?:sign|public)\/avatars\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Fichier image illisible ou corrompu')); };
    img.src = url;
  });
}

/** Recadre au centre et redimensionne en carré 512px, sortie WebP. */
async function normalizeImage(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file; // conserve l'animation
  const img = await readImage(file);
  if (img.width < AVATAR_MIN_SIZE_PX || img.height < AVATAR_MIN_SIZE_PX) {
    throw new Error(`Image trop petite (minimum ${AVATAR_MIN_SIZE_PX}×${AVATAR_MIN_SIZE_PX} px)`);
  }
  const side = Math.min(img.width, img.height);
  const size = Math.min(side, AVATAR_TARGET_PX);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/webp', 0.9));
  return blob ?? file;
}

interface Props {
  /** Identifiant du membre, utilisé dans le nom du fichier. */
  memberId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  /** Couleur de repli + initiales affichées sans photo. */
  fallbackColor: string;
  initials: string;
  disabled?: boolean;
}

export default function AvatarUploader({ memberId, value, onChange, fallbackColor, initials, disabled }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): string | null => {
    if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
      return 'Format non pris en charge (JPG, PNG, WebP ou GIF uniquement)';
    }
    if (file.size > AVATAR_MAX_BYTES) {
      return `Image trop lourde (${(file.size / 1024 / 1024).toFixed(1)} Mo) — 2 Mo maximum`;
    }
    if (file.size === 0) return 'Fichier vide';
    return null;
  };

  const handleFile = useCallback(async (file: File) => {
    const invalid = validate(file);
    if (invalid) { toast.error(invalid); return; }

    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Session expirée, reconnectez-vous');

      const blob = await normalizeImage(file);
      const ext = blob.type === 'image/gif' ? 'gif' : 'webp';
      const path = `${uid}/${memberId}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: '3600' });
      if (upErr) throw upErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from('avatars')
        .createSignedUrl(path, TEN_YEARS);
      if (signErr) throw signErr;

      // Nettoyage de l'ancienne image (best effort)
      const oldPath = extractAvatarPath(value);
      if (oldPath && oldPath !== path) {
        await supabase.storage.from('avatars').remove([oldPath]).catch(() => undefined);
      }

      onChange(signed?.signedUrl ?? null);
      toast.success('Photo chargée — pensez à enregistrer');
    } catch (err: any) {
      toast.error(err?.message?.includes('row-level security')
        ? "Vous n'avez pas le droit de modifier cette photo"
        : err?.message || "Échec de l'envoi de l'image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [memberId, value, onChange]);

  const handleRemove = async () => {
    const oldPath = extractAvatarPath(value);
    onChange(null);
    if (oldPath) {
      await supabase.storage.from('avatars').remove([oldPath]).catch(() => undefined);
    }
    toast.success('Photo retirée — pensez à enregistrer');
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={`flex items-center gap-4 rounded-lg border border-dashed p-3 transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-border'
        }`}
      >
        {value ? (
          <img src={value} alt="Avatar du membre" className="w-16 h-16 rounded-full object-cover shrink-0" />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
            style={{ backgroundColor: fallbackColor }}
            aria-hidden
          >
            {initials}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={AVATAR_ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading || disabled} onClick={() => fileRef.current?.click()}>
              {uploading
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : value ? <Upload className="w-4 h-4 mr-2" /> : <ImagePlus className="w-4 h-4 mr-2" />}
              {uploading ? 'Envoi…' : value ? 'Changer la photo' : 'Ajouter une photo'}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={uploading || disabled} onClick={handleRemove}>
                <Trash2 className="w-4 h-4 mr-2" />
                Retirer
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Glissez-déposez une image ou parcourez — JPG, PNG, WebP, GIF · 2 Mo max · {AVATAR_MIN_SIZE_PX}px minimum.
          </p>
        </div>
      </div>
    </div>
  );
}
