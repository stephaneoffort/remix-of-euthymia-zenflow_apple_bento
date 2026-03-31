/**
 * Design Tokens — Euthymia
 *
 * Centralise les tokens de design utilisés dans l'application.
 * Les valeurs CSS réelles proviennent des variables définies dans index.css
 * et theme-ivoire-chaud.css ; ce fichier expose des helpers TypeScript
 * pour y accéder de manière typée.
 */

/* ─── Couleurs sémantiques (clés CSS var) ─── */
export const COLOR_TOKENS = {
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  card: "hsl(var(--card))",
  cardForeground: "hsl(var(--card-foreground))",
  popover: "hsl(var(--popover))",
  popoverForeground: "hsl(var(--popover-foreground))",
  primary: "hsl(var(--primary))",
  primaryForeground: "hsl(var(--primary-foreground))",
  secondary: "hsl(var(--secondary))",
  secondaryForeground: "hsl(var(--secondary-foreground))",
  muted: "hsl(var(--muted))",
  mutedForeground: "hsl(var(--muted-foreground))",
  accent: "hsl(var(--accent))",
  accentForeground: "hsl(var(--accent-foreground))",
  destructive: "hsl(var(--destructive))",
  destructiveForeground: "hsl(var(--destructive-foreground))",
  border: "hsl(var(--border))",
  input: "hsl(var(--input))",
  ring: "hsl(var(--ring))",
} as const;

/* ─── Sidebar ─── */
export const SIDEBAR_TOKENS = {
  background: "hsl(var(--sidebar-background))",
  foreground: "hsl(var(--sidebar-foreground))",
  primary: "hsl(var(--sidebar-primary))",
  primaryForeground: "hsl(var(--sidebar-primary-foreground))",
  accent: "hsl(var(--sidebar-accent))",
  accentForeground: "hsl(var(--sidebar-accent-foreground))",
  border: "hsl(var(--sidebar-border))",
  ring: "hsl(var(--sidebar-ring))",
} as const;

/* ─── Priorités ─── */
export const PRIORITY_TOKENS = {
  urgent: "hsl(var(--priority-urgent))",
  high: "hsl(var(--priority-high))",
  normal: "hsl(var(--priority-normal))",
  low: "hsl(var(--priority-low))",
} as const;

export type PriorityLevel = keyof typeof PRIORITY_TOKENS;

/* ─── Statuts ─── */
export const STATUS_TOKENS = {
  todo: "hsl(var(--status-todo))",
  progress: "hsl(var(--status-progress))",
  review: "hsl(var(--status-review))",
  done: "hsl(var(--status-done))",
  blocked: "hsl(var(--status-blocked))",
} as const;

export type StatusKey = keyof typeof STATUS_TOKENS;

/* ─── Bento ─── */
export const BENTO_TOKENS = {
  bg: "var(--bento-bg)",
  bgHover: "var(--bento-bg-hover)",
  border: "var(--bento-border)",
  borderHover: "var(--bento-border-h)",
  shadow: "var(--bento-shadow)",
} as const;

/* ─── Rayons (border-radius) ─── */
export const RADIUS_TOKENS = {
  lg: "var(--radius)",
  md: "calc(var(--radius) - 2px)",
  sm: "calc(var(--radius) - 4px)",
} as const;

/* ─── Helper : lire une variable CSS à l'exécution ─── */
export function getCssVar(name: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/* ─── Helper : lire une couleur HSL depuis une variable CSS ─── */
export function getHslColor(token: string, fallback = ""): string {
  const raw = getCssVar(token, fallback);
  return raw ? `hsl(${raw})` : fallback;
}
/*
  ═══════════════════════════════════════════════════════
  EUTHYMIA — DESIGN TOKENS
  
  Ce fichier remplace les constantes hardcodées dans
  chaque vue (BG, SHD, SHL, TEXT…)
  
  Il lit les variables CSS définies dans nm-themes.css
  → automatiquement adaptées au thème actif (Clair/Sombre/Mixte)
  ═══════════════════════════════════════════════════════
*/

/* ─── COULEURS DE FOND & OMBRES ─────────────────────────── */
export const BG = "var(--nm-bg)";
export const SHD = "var(--nm-shd)";
export const SHL = "var(--nm-shl)";

/* ─── SHADOWS NEUMORPHIQUES PRÉCOMPILÉES ────────────────── */
export const UP = "var(--nm-up)";
export const UP_SM = "var(--nm-up-sm)";
export const UP_XS = "var(--nm-up-xs)";
export const DN = "var(--nm-dn)";
export const DN_SM = "var(--nm-dn-sm)";
export const DN_XS = "var(--nm-dn-xs)";

/* ─── COULEURS TEXTE ────────────────────────────────────── */
export const TEXT = "var(--nm-text)";
export const MUTED = "var(--nm-muted)";
export const FAINT = "var(--nm-faint)";

/* ─── COULEURS SÉMANTIQUES ──────────────────────────────── */
export const ACCENT = "var(--nm-accent)"; // terracotta
export const GREEN = "var(--nm-green)"; // vert sauge
export const RED = "var(--nm-red)"; // rouge urgence
export const BLUE = "var(--nm-blue)"; // bleu normale

/* ─── TEXTES SUR FONDS COLORÉS ─────────────────────────── */
export const ON_ACCENT = "var(--nm-on-accent)"; // texte sur fond terracotta
export const ON_GREEN = "var(--nm-on-green)"; // texte sur fond vert
export const ON_RED = "var(--nm-on-red)"; // texte sur fond rouge
export const ON_BLUE = "var(--nm-on-blue)"; // texte sur fond bleu

/* ─── UTILITAIRES ───────────────────────────────────────── */
export const BORDER = "var(--nm-border)";
export const SERIF = "'Cormorant Garamond', Georgia, serif";
export const SANS = "'DM Sans', system-ui, sans-serif";

/* ─── HELPERS BADGE PRIORITÉ ────────────────────────────── */
export function priorityBg(priority: string): string {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return RED;
    case "haute":
      return ACCENT;
    case "normale":
      return BLUE;
    default:
      return BG;
  }
}

export function priorityText(priority: string): string {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return ON_RED;
    case "haute":
      return ON_ACCENT;
    case "normale":
      return ON_BLUE;
    default:
      return MUTED;
  }
}

export function priorityShadow(priority: string): string {
  if (!priority || priority.toLowerCase() === "basse") return UP_XS;
  return "none";
}

/* ─── HELPER COULEUR STATUT ─────────────────────────────── */
export function statusColor(status: string): string {
  switch (status) {
    case "done":
      return GREEN;
    case "in_progress":
      return ACCENT;
    case "in_review":
      return BLUE;
    case "blocked":
      return RED;
    default:
      return MUTED;
  }
}
