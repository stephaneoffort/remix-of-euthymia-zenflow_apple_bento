import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface TranscriptionQuality {
  confidence: number | null;
  requestedLanguage: string;
  detectedLanguage: string;
  detectedScript?: string;
  languageMismatch: boolean;
}

const LANG_LABELS: Record<string, string> = {
  fr: 'Français', en: 'Anglais', es: 'Espagnol', de: 'Allemand', it: 'Italien',
  pt: 'Portugais', zh: 'Chinois', ja: 'Japonais', ko: 'Coréen', ru: 'Russe',
  ar: 'Arabe', he: 'Hébreu', latin: 'Latin', unknown: 'Inconnu',
};

export function langLabelFor(code?: string | null): string {
  if (!code) return 'Inconnu';
  return LANG_LABELS[code] ?? code.toUpperCase();
}

/**
 * Compact badge showing detected language + confidence % for a transcription.
 * Red/warning state when the detected language differs from the requested one
 * or when confidence is low — useful to spot Chinese-hallucination cases.
 */
export function TranscriptionQualityBadge({ quality, className = '' }: {
  quality: TranscriptionQuality;
  className?: string;
}) {
  const pct = quality.confidence == null ? null : Math.round(quality.confidence * 100);
  const low = pct != null && pct < 60;
  const warn = quality.languageMismatch || low;

  const detected = langLabelFor(quality.detectedLanguage);
  const requested = langLabelFor(quality.requestedLanguage);

  return (
    <div
      className={
        `inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] ` +
        (warn
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border bg-muted/60 text-foreground/80') +
        ' ' + className
      }
      title={
        (quality.languageMismatch
          ? `Langue détectée (${detected}) différente de la langue demandée (${requested}).`
          : `Langue détectée : ${detected}. Langue demandée : ${requested}.`) +
        (pct != null ? ` Confiance : ${pct}%.` : '')
      }
    >
      {warn ? <AlertTriangle className="w-3 h-3 shrink-0" /> : <CheckCircle2 className="w-3 h-3 shrink-0" />}
      <span className="font-medium">{detected}</span>
      {pct != null && (
        <>
          <span aria-hidden className="opacity-40">·</span>
          <span className="tabular-nums">{pct}%</span>
          <span className="relative h-1 w-10 rounded-full bg-foreground/10 overflow-hidden">
            <span
              className={`absolute inset-y-0 left-0 ${warn ? 'bg-destructive' : 'bg-primary'}`}
              style={{ width: `${Math.max(4, pct)}%` }}
            />
          </span>
        </>
      )}
      {quality.languageMismatch && (
        <span className="opacity-80">≠ {requested}</span>
      )}
    </div>
  );
}
