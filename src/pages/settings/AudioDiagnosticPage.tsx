import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Activity, Mic, RefreshCw, Clock, FileAudio,
  Sliders, BarChart2, Smartphone, CheckCircle2, XCircle,
} from 'lucide-react';

interface AudioDiagnostics {
  timestamp: string;
  duration: number;
  fileSizeBytes: number;
  mimeType: string;
  constraintsOptimized: boolean;
  transcriptionMethod: 'web-speech' | 'server';
  confidence: number | null;
  transcriptLength: number;
  platform: {
    isMobile: boolean;
    hasWebSpeech: boolean;
    userAgent: string;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}

function confidenceColor(v: number): string {
  if (v >= 0.85) return 'text-emerald-600 dark:text-emerald-400';
  if (v >= 0.6)  return 'text-amber-600 dark:text-amber-400';
  return 'text-destructive';
}

function confidenceBarColor(v: number): string {
  if (v >= 0.85) return 'bg-emerald-500';
  if (v >= 0.6)  return 'bg-amber-500';
  return 'bg-destructive';
}

export default function AudioDiagnosticPage() {
  const [diag, setDiag] = useState<AudioDiagnostics | null>(null);
  const navigate = useNavigate();

  const load = () => {
    try {
      const raw = localStorage.getItem('audio_diagnostics');
      setDiag(raw ? (JSON.parse(raw) as AudioDiagnostics) : null);
    } catch {
      setDiag(null);
    }
  };

  useEffect(() => { load(); }, []);

  const openQuickNote = () => {
    navigate('/');
    setTimeout(() => window.dispatchEvent(new Event('quicknote:open')), 150);
  };

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
      <div className="max-w-lg mx-auto p-4 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 px-2 shrink-0">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground text-base leading-tight">Diagnostic audio</h1>
            <p className="text-xs text-muted-foreground">Dernière session d'enregistrement</p>
          </div>
          <Button size="sm" variant="outline" onClick={load} className="gap-1.5 shrink-0 h-8 px-2">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Empty state */}
        {!diag && (
          <Card className="p-8 text-center space-y-4">
            <Activity className="w-10 h-10 mx-auto text-muted-foreground opacity-40" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Aucune session enregistrée</p>
              <p className="text-xs text-muted-foreground">
                Faites un enregistrement vocal dans les Notes rapides pour voir les diagnostics ici.
              </p>
            </div>
            <Button size="sm" onClick={openQuickNote}>
              <Mic className="w-4 h-4 mr-1.5" />
              Ouvrir Notes rapides
            </Button>
          </Card>
        )}

        {diag && (
          <>
            {/* Timestamp */}
            <p className="text-[11px] text-muted-foreground px-1">
              Session enregistrée le{' '}
              {new Date(diag.timestamp).toLocaleString('fr-FR', {
                day: '2-digit', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>

            {/* Duration + File size */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                icon={<Clock className="w-4 h-4" />}
                label="Durée"
                value={formatDuration(diag.duration)}
              />
              <MetricCard
                icon={<FileAudio className="w-4 h-4" />}
                label="Taille du fichier"
                value={diag.fileSizeBytes > 0 ? formatBytes(diag.fileSizeBytes) : '—'}
              />
            </div>

            {/* MIME type */}
            <Card className="p-4 space-y-2">
              <SectionLabel icon={<FileAudio className="w-3.5 h-3.5" />} label="Type MIME choisi" />
              <code className="text-sm text-foreground font-mono break-all block bg-muted/50 rounded px-2 py-1.5">
                {diag.mimeType || '—'}
              </code>
            </Card>

            {/* Constraints */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel icon={<Sliders className="w-3.5 h-3.5" />} label="Contraintes appliquées" />
                <Badge
                  variant={diag.constraintsOptimized ? 'default' : 'outline'}
                  className="text-[10px] shrink-0"
                >
                  {diag.constraintsOptimized ? 'Optimisées' : 'Fallback'}
                </Badge>
              </div>

              {diag.constraintsOptimized ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <ConstraintRow label="Canaux" value="1 (mono)" ok />
                  <ConstraintRow label="Fréquence d'échantillonnage" value="16 000 Hz" ok />
                  <ConstraintRow label="Profondeur" value="16 bits" ok />
                  <ConstraintRow label="Annulation d'écho" value="Activée" ok />
                  <ConstraintRow label="Suppression du bruit" value="Activée" ok />
                  <ConstraintRow label="Gain automatique" value="Activé" ok />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
                  Les contraintes optimisées (16 kHz, mono, DSP) ont été rejetées par le navigateur.
                  L'enregistrement utilise les paramètres par défaut du système.
                </p>
              )}
            </Card>

            {/* Confidence score */}
            <Card className="p-4 space-y-3">
              <SectionLabel icon={<BarChart2 className="w-3.5 h-3.5" />} label="Score de confiance" />

              {diag.confidence !== null ? (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-bold tabular-nums ${confidenceColor(diag.confidence)}`}>
                      {Math.round(diag.confidence * 100)}&nbsp;%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {diag.confidence >= 0.85
                        ? 'Excellent'
                        : diag.confidence >= 0.6
                          ? 'Acceptable'
                          : 'Faible'}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${confidenceBarColor(diag.confidence)}`}
                      style={{ width: `${Math.round(diag.confidence * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-muted/40 rounded p-2.5 space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">N/D</p>
                  <p className="text-xs text-muted-foreground">
                    Le score de confiance n'est pas disponible pour la transcription serveur (Gemini Flash).
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {diag.transcriptionMethod === 'web-speech' ? 'Web Speech API' : 'Serveur · Gemini Flash'}
                </Badge>
                {diag.transcriptLength > 0 && (
                  <span>{diag.transcriptLength} caractères transcrits</span>
                )}
              </div>
            </Card>

            {/* Platform */}
            <Card className="p-4 space-y-3">
              <SectionLabel icon={<Smartphone className="w-3.5 h-3.5" />} label="Environnement" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <ConstraintRow label="Mobile" value={diag.platform.isMobile ? 'Oui' : 'Non'} ok={diag.platform.isMobile} />
                <ConstraintRow
                  label="Web Speech API"
                  value={diag.platform.hasWebSpeech ? 'Disponible' : 'Indisponible'}
                  ok={diag.platform.hasWebSpeech}
                />
              </div>
              <p className="text-[10px] text-muted-foreground break-all leading-relaxed border-t border-border pt-2">
                {diag.platform.userAgent}
              </p>
            </Card>

            {/* CTA to re-record */}
            <div className="flex justify-center pb-4">
              <Button variant="outline" size="sm" onClick={openQuickNote} className="gap-1.5">
                <Mic className="w-4 h-4" />
                Nouvel enregistrement
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
    </Card>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {icon}
      {label}
    </div>
  );
}

function ConstraintRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground truncate">{label}</span>
      <div className="flex items-center gap-1 shrink-0">
        {ok !== undefined && (
          ok
            ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            : <XCircle className="w-3 h-3 text-muted-foreground" />
        )}
        <span className="font-medium text-foreground">{value}</span>
      </div>
    </div>
  );
}
