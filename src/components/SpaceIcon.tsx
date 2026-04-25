import {
  Folder,
  Rocket,
  Lightbulb,
  Target,
  BarChart3,
  Wrench,
  BookOpen,
  Sparkles,
  Flower2,
  Palette,
  Compass,
  Mountain,
  Crown,
  Gem,
  Feather,
  Globe,
  type LucideIcon,
} from "lucide-react";

// Each preset = a Lucide icon + a premium gradient (warm gold / champagne / earthy / cool)
export type SpaceIconPreset = {
  id: string;
  label: string;
  Icon: LucideIcon;
  gradient: string; // tailwind classes
  ring: string; // subtle inner ring color
};

export const SPACE_ICON_PRESETS: SpaceIconPreset[] = [
  { id: "folder",    label: "Dossier",   Icon: Folder,     gradient: "from-[#C9A84C] to-[#8A6E2E]", ring: "ring-[#C9A84C]/30" },
  { id: "rocket",    label: "Lancement", Icon: Rocket,     gradient: "from-[#D4915C] to-[#7A4A2E]", ring: "ring-[#D4915C]/30" },
  { id: "lightbulb", label: "Idées",     Icon: Lightbulb,  gradient: "from-[#E2D08A] to-[#A8893A]", ring: "ring-[#E2D08A]/30" },
  { id: "target",    label: "Objectifs", Icon: Target,     gradient: "from-[#C47B7B] to-[#7A3838]", ring: "ring-[#C47B7B]/30" },
  { id: "chart",     label: "Analytics", Icon: BarChart3,  gradient: "from-[#4A6FA5] to-[#243C5E]", ring: "ring-[#4A6FA5]/30" },
  { id: "wrench",    label: "Outils",    Icon: Wrench,     gradient: "from-[#7B7B8E] to-[#3E3E4E]", ring: "ring-[#7B7B8E]/30" },
  { id: "book",      label: "Savoir",    Icon: BookOpen,   gradient: "from-[#3D8B7A] to-[#1E4A40]", ring: "ring-[#3D8B7A]/30" },
  { id: "sparkles",  label: "Magie",     Icon: Sparkles,   gradient: "from-[#E5C158] to-[#A37F1E]", ring: "ring-[#E5C158]/30" },
  { id: "lotus",     label: "Pratique",  Icon: Flower2,    gradient: "from-[#B89BCC] to-[#5E477A]", ring: "ring-[#B89BCC]/30" },
  { id: "palette",   label: "Création",  Icon: Palette,    gradient: "from-[#D4915C] to-[#5E3A1E]", ring: "ring-[#D4915C]/30" },
  { id: "compass",   label: "Stratégie", Icon: Compass,    gradient: "from-[#5E8A8C] to-[#2A4546]", ring: "ring-[#5E8A8C]/30" },
  { id: "mountain",  label: "Vision",    Icon: Mountain,   gradient: "from-[#8A7E6E] to-[#3E372E]", ring: "ring-[#8A7E6E]/30" },
  { id: "crown",     label: "Premium",   Icon: Crown,      gradient: "from-[#E5C158] to-[#7A5E1E]", ring: "ring-[#E5C158]/40" },
  { id: "gem",       label: "Précieux",  Icon: Gem,        gradient: "from-[#7BA8C4] to-[#2E5A78]", ring: "ring-[#7BA8C4]/30" },
  { id: "feather",   label: "Léger",     Icon: Feather,    gradient: "from-[#C9B98A] to-[#7A6A3E]", ring: "ring-[#C9B98A]/30" },
  { id: "globe",     label: "Global",    Icon: Globe,      gradient: "from-[#5E9A8E] to-[#2A4E46]", ring: "ring-[#5E9A8E]/30" },
];

const PRESET_MAP = new Map(SPACE_ICON_PRESETS.map((p) => [p.id, p]));

export function getSpaceIconPreset(value?: string | null): SpaceIconPreset | null {
  if (!value) return null;
  return PRESET_MAP.get(value) ?? null;
}

type SpaceIconProps = {
  value?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const SIZE_MAP = {
  xs: { box: "w-5 h-5", icon: "w-3 h-3", text: "text-xs" },
  sm: { box: "w-6 h-6", icon: "w-3.5 h-3.5", text: "text-sm" },
  md: { box: "w-8 h-8", icon: "w-4 h-4", text: "text-base" },
  lg: { box: "w-10 h-10", icon: "w-5 h-5", text: "text-lg" },
};

/**
 * Renders a space icon. Supports two formats:
 *  - preset id (e.g. "folder", "rocket") → Lucide icon with premium gradient background
 *  - emoji string (legacy) → rendered as-is for backwards compatibility
 */
export function SpaceIcon({ value, size = "sm", className = "" }: SpaceIconProps) {
  const preset = getSpaceIconPreset(value);
  const sizes = SIZE_MAP[size];

  if (preset) {
    const { Icon, gradient, ring } = preset;
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md bg-gradient-to-br ${gradient} ${sizes.box} ring-1 ring-inset ${ring} shadow-sm ${className}`}
      >
        <Icon className={`${sizes.icon} text-white drop-shadow-sm`} strokeWidth={2.25} />
      </span>
    );
  }

  // Legacy emoji fallback
  return (
    <span className={`inline-flex items-center justify-center ${sizes.text} ${className}`}>
      {value || "📁"}
    </span>
  );
}
