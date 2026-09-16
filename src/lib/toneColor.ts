/**
 * Palette douce commune (10 tons) — projets, avatars, tâches, espaces, équipes.
 *
 * Chaque ton a une couleur pleine (pastille, ex. avatar) et une paire fond/texte
 * (étiquette). Les variables CSS correspondantes vivent dans src/index.css :
 *   --tone-{id}-solid, --tone-{id}-bg, --tone-{id}-fg (déclinées en clair et en sombre).
 *
 * getClosestTone() ne sert QU'À L'AFFICHAGE : elle ne modifie jamais une valeur
 * enregistrée en base. Elle prend une couleur existante (hex) et renvoie le ton
 * le plus proche à utiliser pour le rendu.
 */

export type ToneId =
  | "sage"
  | "slate"
  | "sand"
  | "terracotta"
  | "lavender"
  | "rose"
  | "mist"
  | "olive"
  | "ochre"
  | "stone";

export const TONE_ORDER: ToneId[] = [
  "sage",
  "slate",
  "sand",
  "terracotta",
  "lavender",
  "rose",
  "mist",
  "olive",
  "ochre",
  "stone",
];

export const TONE_LABELS: Record<ToneId, string> = {
  sage: "Sauge",
  slate: "Ardoise",
  sand: "Sable",
  terracotta: "Terre cuite",
  lavender: "Lavande",
  rose: "Rose poudré",
  mist: "Bleu brume",
  olive: "Olive",
  ochre: "Ocre",
  stone: "Pierre",
};

/** Couleur pleine (mode clair) — sert de référence pour le calcul du ton le plus proche
 * et de valeur à proposer dans les sélecteurs (avatars, projets, tâches, équipes). */
export const TONE_SOLID_HEX: Record<ToneId, string> = {
  sage: "#6F8F73",
  slate: "#6E8098",
  sand: "#B8966A",
  terracotta: "#B86B5A",
  lavender: "#8C7FA8",
  rose: "#B8808C",
  mist: "#6A9AA6",
  olive: "#8A9160",
  ochre: "#C39A4E",
  stone: "#86867F",
};

/** Texte d'étiquette (mode clair) — couleur lisible, plus soutenue que la pastille.
 * Utilisée pour proposer des couleurs de TEXTE (ex. RichTextEditor), pas des aplats. */
export const TONE_LABEL_TEXT_HEX: Record<ToneId, string> = {
  sage: "#3F5A43",
  slate: "#435468",
  sand: "#74552E",
  terracotta: "#7E3F31",
  lavender: "#544873",
  rose: "#764553",
  mist: "#3A5F68",
  olive: "#545A33",
  ochre: "#6E5320",
  stone: "#50504B",
};

/**
 * Table fixe : couleurs connues des palettes historiques de l'appli → ton attribué.
 * Volontairement figée à la main (validée manuellement) plutôt que dérivée de la seule
 * formule, pour que les membres/projets/équipes déjà distincts entre eux le restent.
 * Clés en minuscules, sans le "#".
 */
const FIXED_TONE_MAP: Record<string, ToneId> = {
  "6366f1": "lavender",
  "f43f5e": "terracotta",
  "10b981": "sage",
  "f59e0b": "sand",
  "3b82f6": "slate",
  "8b5cf6": "lavender",
  "ec4899": "rose",
  "14b8a6": "mist",
  "155e75": "slate",
  "f4633a": "ochre",
  "64748b": "stone",
  "0ea5e9": "mist",
  "c9a84c": "ochre",
  "e2d08a": "olive",
  "f5efe0": "sand",
  "d4915c": "terracotta",
  "4a6fa5": "slate",
  "3d8b7a": "sage",
  "c47b7b": "rose",
  "7b68ae": "lavender",
  "5a9a6a": "sage",
  "4a7fa5": "slate",
  "b06060": "terracotta",
  "b09a50": "olive",
  "7b5ea7": "lavender",
  "d97706": "ochre",
  "ef4444": "terracotta",
  "f97316": "ochre",
  "eab308": "ochre",
  "22c55e": "sage",
  "6b7280": "stone",
  // Couleurs d'équipe (src/lib/orgColors.ts)
  "e11d48": "terracotta",
  "06b6d4": "mist",
  "84cc16": "olive",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Distance perceptuelle approximative entre deux couleurs RGB ("redmean"). */
function colorDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const rmean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt((2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db);
}

/**
 * Renvoie le ton le plus proche d'une couleur enregistrée (hex).
 * 1) Table fixe pour les couleurs connues des anciennes palettes.
 * 2) Sinon, secours par distance de couleur vis-à-vis des 10 pastilles de référence.
 * Ne modifie jamais la valeur d'origine — uniquement pour l'affichage.
 */
export function getClosestTone(value: string | null | undefined): ToneId {
  if (!value) return "stone";
  const key = value.trim().toLowerCase().replace(/^#/, "");
  const fixed = FIXED_TONE_MAP[key];
  if (fixed) return fixed;

  const rgb = hexToRgb(value);
  if (!rgb) return "stone";

  let best: ToneId = "stone";
  let bestDist = Infinity;
  for (const id of TONE_ORDER) {
    const tRgb = hexToRgb(TONE_SOLID_HEX[id]);
    if (!tRgb) continue;
    const d = colorDistance(rgb, tRgb);
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}
