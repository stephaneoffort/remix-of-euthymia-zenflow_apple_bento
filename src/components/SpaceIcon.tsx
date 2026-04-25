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
  // Extended set
  Briefcase,
  Brain,
  Heart,
  Leaf,
  Sun,
  Moon,
  Star,
  Flame,
  Zap,
  Trophy,
  Award,
  Shield,
  Anchor,
  Tent,
  TreePine,
  Camera,
  Music,
  Mic,
  Film,
  Coffee,
  Wine,
  Gift,
  Calendar,
  Bell,
  Pin,
  MapPin,
  Map,
  Plane,
  Ship,
  Bike,
  Car,
  Home,
  Building2,
  Store,
  Banknote,
  Wallet,
  CreditCard,
  PiggyBank,
  TrendingUp,
  PieChart,
  Activity,
  HeartPulse,
  Stethoscope,
  Dumbbell,
  Smile,
  Users,
  Handshake,
  MessageCircle,
  Mail,
  Phone,
  Megaphone,
  Newspaper,
  GraduationCap,
  School,
  PenTool,
  Pencil,
  Brush,
  Scissors,
  Hammer,
  Cog,
  Cpu,
  Code2,
  Terminal,
  Database,
  Cloud,
  Lock,
  Key,
  Search,
  Filter,
  Layers,
  Box,
  Package,
  Boxes,
  Truck,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Bookmark,
  Library,
  Notebook,
  FileText,
  ClipboardList,
  CheckCircle2,
  Hourglass,
  Timer,
  Infinity,
  Atom,
  Telescope,
  Microscope,
  FlaskConical,
  Puzzle,
  Gamepad2,
  Dices,
  Swords,
  Sprout,
  Apple,
  UtensilsCrossed,
  Baby,
  PawPrint,
  Bird,
  Fish,
  Waves,
  Snowflake,
  CloudRain,
  Rainbow,
  Umbrella,
  Headphones,
  Radio,
  Tv,
  Lamp,
  Diamond,
  Hexagon,
  type LucideIcon,
} from "lucide-react";

// Each preset = a Lucide icon + a premium gradient (warm gold / champagne / earthy / cool)
export type SpaceIconPreset = {
  id: string;
  label: string;
  Icon: LucideIcon;
  gradient: string; // tailwind classes
  ring: string; // subtle inner ring color
  category: string;
};

// Premium gradient palette (reused across presets for visual harmony)
const G = {
  gold:       { gradient: "from-[#C9A84C] to-[#8A6E2E]", ring: "ring-[#C9A84C]/30" },
  champagne:  { gradient: "from-[#E2D08A] to-[#A8893A]", ring: "ring-[#E2D08A]/30" },
  amber:      { gradient: "from-[#E5C158] to-[#7A5E1E]", ring: "ring-[#E5C158]/40" },
  copper:     { gradient: "from-[#D4915C] to-[#7A4A2E]", ring: "ring-[#D4915C]/30" },
  terracotta: { gradient: "from-[#C47B7B] to-[#7A3838]", ring: "ring-[#C47B7B]/30" },
  rose:       { gradient: "from-[#D89BA8] to-[#7A4858]", ring: "ring-[#D89BA8]/30" },
  burgundy:   { gradient: "from-[#A8576B] to-[#5E2A38]", ring: "ring-[#A8576B]/30" },
  navy:       { gradient: "from-[#4A6FA5] to-[#243C5E]", ring: "ring-[#4A6FA5]/30" },
  ocean:      { gradient: "from-[#7BA8C4] to-[#2E5A78]", ring: "ring-[#7BA8C4]/30" },
  teal:       { gradient: "from-[#5E8A8C] to-[#2A4546]", ring: "ring-[#5E8A8C]/30" },
  emerald:    { gradient: "from-[#3D8B7A] to-[#1E4A40]", ring: "ring-[#3D8B7A]/30" },
  forest:     { gradient: "from-[#5E9A8E] to-[#2A4E46]", ring: "ring-[#5E9A8E]/30" },
  sage:       { gradient: "from-[#8AA882] to-[#3E5E38]", ring: "ring-[#8AA882]/30" },
  lavender:   { gradient: "from-[#B89BCC] to-[#5E477A]", ring: "ring-[#B89BCC]/30" },
  plum:       { gradient: "from-[#9B7BAE] to-[#4E3A5E]", ring: "ring-[#9B7BAE]/30" },
  graphite:   { gradient: "from-[#7B7B8E] to-[#3E3E4E]", ring: "ring-[#7B7B8E]/30" },
  earth:      { gradient: "from-[#8A7E6E] to-[#3E372E]", ring: "ring-[#8A7E6E]/30" },
  sand:       { gradient: "from-[#C9B98A] to-[#7A6A3E]", ring: "ring-[#C9B98A]/30" },
  slate:      { gradient: "from-[#7A8A9E] to-[#3A4658]", ring: "ring-[#7A8A9E]/30" },
};

export const SPACE_ICON_PRESETS: SpaceIconPreset[] = [
  // ── Général ──
  { id: "folder",    label: "Dossier",   Icon: Folder,     ...G.gold,       category: "Général" },
  { id: "home",      label: "Maison",    Icon: Home,       ...G.copper,     category: "Général" },
  { id: "star",      label: "Favori",    Icon: Star,       ...G.amber,      category: "Général" },
  { id: "bookmark",  label: "Marque",    Icon: Bookmark,   ...G.burgundy,   category: "Général" },
  { id: "tag",       label: "Étiquette", Icon: Tag,        ...G.rose,       category: "Général" },
  { id: "hexagon",   label: "Cellule",   Icon: Hexagon,    ...G.slate,      category: "Général" },

  // ── Travail & Stratégie ──
  { id: "rocket",    label: "Lancement", Icon: Rocket,     ...G.copper,     category: "Travail" },
  { id: "target",    label: "Objectifs", Icon: Target,     ...G.terracotta, category: "Travail" },
  { id: "briefcase", label: "Business",  Icon: Briefcase,  ...G.earth,      category: "Travail" },
  { id: "compass",   label: "Stratégie", Icon: Compass,    ...G.teal,       category: "Travail" },
  { id: "trophy",    label: "Succès",    Icon: Trophy,     ...G.gold,       category: "Travail" },
  { id: "award",     label: "Récompense",Icon: Award,      ...G.amber,      category: "Travail" },
  { id: "handshake", label: "Partenariat",Icon: Handshake, ...G.sand,       category: "Travail" },
  { id: "shield",    label: "Sécurité",  Icon: Shield,     ...G.navy,       category: "Travail" },

  // ── Idées & Création ──
  { id: "lightbulb", label: "Idées",     Icon: Lightbulb,  ...G.champagne,  category: "Création" },
  { id: "brain",     label: "Réflexion", Icon: Brain,      ...G.lavender,   category: "Création" },
  { id: "sparkles",  label: "Magie",     Icon: Sparkles,   ...G.amber,      category: "Création" },
  { id: "palette",   label: "Création",  Icon: Palette,    ...G.copper,     category: "Création" },
  { id: "brush",     label: "Pinceau",   Icon: Brush,      ...G.rose,       category: "Création" },
  { id: "pen",       label: "Plume",     Icon: PenTool,    ...G.plum,       category: "Création" },
  { id: "pencil",    label: "Crayon",    Icon: Pencil,     ...G.sand,       category: "Création" },
  { id: "scissors",  label: "Découpe",   Icon: Scissors,   ...G.slate,      category: "Création" },
  { id: "puzzle",    label: "Puzzle",    Icon: Puzzle,     ...G.lavender,   category: "Création" },
  { id: "feather",   label: "Léger",     Icon: Feather,    ...G.sand,       category: "Création" },

  // ── Données & Tech ──
  { id: "chart",     label: "Analytics", Icon: BarChart3,  ...G.navy,       category: "Données" },
  { id: "trending",  label: "Croissance",Icon: TrendingUp, ...G.emerald,    category: "Données" },
  { id: "pie",       label: "Répartition",Icon: PieChart,  ...G.ocean,      category: "Données" },
  { id: "activity",  label: "Activité",  Icon: Activity,   ...G.teal,       category: "Données" },
  { id: "database",  label: "Données",   Icon: Database,   ...G.slate,      category: "Données" },
  { id: "cloud",     label: "Cloud",     Icon: Cloud,      ...G.ocean,      category: "Données" },
  { id: "code",      label: "Code",      Icon: Code2,      ...G.graphite,   category: "Données" },
  { id: "terminal",  label: "Terminal",  Icon: Terminal,   ...G.graphite,   category: "Données" },
  { id: "cpu",       label: "Processeur",Icon: Cpu,        ...G.slate,      category: "Données" },
  { id: "cog",       label: "Engrenage", Icon: Cog,        ...G.graphite,   category: "Données" },
  { id: "lock",      label: "Verrou",    Icon: Lock,       ...G.earth,      category: "Données" },
  { id: "key",       label: "Clé",       Icon: Key,        ...G.gold,       category: "Données" },

  // ── Outils & Production ──
  { id: "wrench",    label: "Outils",    Icon: Wrench,     ...G.graphite,   category: "Production" },
  { id: "hammer",    label: "Marteau",   Icon: Hammer,     ...G.earth,      category: "Production" },
  { id: "layers",    label: "Couches",   Icon: Layers,     ...G.slate,      category: "Production" },
  { id: "box",       label: "Boîte",     Icon: Box,        ...G.sand,       category: "Production" },
  { id: "package",   label: "Colis",     Icon: Package,    ...G.copper,     category: "Production" },
  { id: "boxes",     label: "Stock",     Icon: Boxes,      ...G.earth,      category: "Production" },
  { id: "truck",     label: "Livraison", Icon: Truck,      ...G.terracotta, category: "Production" },

  // ── Savoir & Apprentissage ──
  { id: "book",      label: "Savoir",    Icon: BookOpen,   ...G.emerald,    category: "Savoir" },
  { id: "library",   label: "Bibliothèque",Icon: Library,  ...G.burgundy,   category: "Savoir" },
  { id: "notebook",  label: "Carnet",    Icon: Notebook,   ...G.sand,       category: "Savoir" },
  { id: "file",      label: "Document",  Icon: FileText,   ...G.slate,      category: "Savoir" },
  { id: "clipboard", label: "Tâches",    Icon: ClipboardList,...G.teal,     category: "Savoir" },
  { id: "graduation",label: "Diplôme",   Icon: GraduationCap,...G.navy,     category: "Savoir" },
  { id: "school",    label: "École",     Icon: School,     ...G.ocean,      category: "Savoir" },
  { id: "newspaper", label: "Presse",    Icon: Newspaper,  ...G.graphite,   category: "Savoir" },

  // ── Communication ──
  { id: "users",     label: "Équipe",    Icon: Users,      ...G.lavender,   category: "Communication" },
  { id: "message",   label: "Discussion",Icon: MessageCircle,...G.ocean,    category: "Communication" },
  { id: "mail",      label: "Email",     Icon: Mail,       ...G.copper,     category: "Communication" },
  { id: "phone",     label: "Téléphone", Icon: Phone,      ...G.emerald,    category: "Communication" },
  { id: "megaphone", label: "Annonce",   Icon: Megaphone,  ...G.terracotta, category: "Communication" },
  { id: "bell",      label: "Notification",Icon: Bell,     ...G.amber,      category: "Communication" },

  // ── Pratique & Bien-être ──
  { id: "lotus",     label: "Pratique",  Icon: Flower2,    ...G.lavender,   category: "Bien-être" },
  { id: "heart",     label: "Cœur",      Icon: Heart,      ...G.rose,       category: "Bien-être" },
  { id: "smile",     label: "Bonheur",   Icon: Smile,      ...G.champagne,  category: "Bien-être" },
  { id: "heartpulse",label: "Vitalité",  Icon: HeartPulse, ...G.terracotta, category: "Bien-être" },
  { id: "stethoscope",label:"Santé",     Icon: Stethoscope,...G.teal,       category: "Bien-être" },
  { id: "dumbbell",  label: "Sport",     Icon: Dumbbell,   ...G.graphite,   category: "Bien-être" },
  { id: "leaf",      label: "Nature",    Icon: Leaf,       ...G.sage,       category: "Bien-être" },
  { id: "sprout",    label: "Croissance",Icon: Sprout,     ...G.emerald,    category: "Bien-être" },

  // ── Nature & Voyage ──
  { id: "mountain",  label: "Vision",    Icon: Mountain,   ...G.earth,      category: "Nature" },
  { id: "tree",      label: "Forêt",     Icon: TreePine,   ...G.forest,     category: "Nature" },
  { id: "tent",      label: "Camp",      Icon: Tent,       ...G.copper,     category: "Nature" },
  { id: "sun",       label: "Soleil",    Icon: Sun,        ...G.amber,      category: "Nature" },
  { id: "moon",      label: "Lune",      Icon: Moon,       ...G.slate,      category: "Nature" },
  { id: "waves",     label: "Vagues",    Icon: Waves,      ...G.ocean,      category: "Nature" },
  { id: "snowflake", label: "Neige",     Icon: Snowflake,  ...G.ocean,      category: "Nature" },
  { id: "rain",      label: "Pluie",     Icon: CloudRain,  ...G.slate,      category: "Nature" },
  { id: "rainbow",   label: "Arc-en-ciel",Icon: Rainbow,   ...G.lavender,   category: "Nature" },
  { id: "globe",     label: "Global",    Icon: Globe,      ...G.forest,     category: "Nature" },
  { id: "map",       label: "Carte",     Icon: Map,        ...G.sand,       category: "Nature" },
  { id: "mappin",    label: "Lieu",      Icon: MapPin,     ...G.terracotta, category: "Nature" },
  { id: "anchor",    label: "Ancre",     Icon: Anchor,     ...G.navy,       category: "Nature" },
  { id: "plane",     label: "Voyage",    Icon: Plane,      ...G.ocean,      category: "Nature" },
  { id: "ship",      label: "Navire",    Icon: Ship,       ...G.navy,       category: "Nature" },
  { id: "car",       label: "Voiture",   Icon: Car,        ...G.graphite,   category: "Nature" },
  { id: "bike",      label: "Vélo",      Icon: Bike,       ...G.sage,       category: "Nature" },

  // ── Vie & Événements ──
  { id: "calendar",  label: "Agenda",    Icon: Calendar,   ...G.copper,     category: "Vie" },
  { id: "gift",      label: "Cadeau",    Icon: Gift,       ...G.burgundy,   category: "Vie" },
  { id: "coffee",    label: "Café",      Icon: Coffee,     ...G.earth,      category: "Vie" },
  { id: "wine",      label: "Vin",       Icon: Wine,       ...G.burgundy,   category: "Vie" },
  { id: "utensils",  label: "Cuisine",   Icon: UtensilsCrossed,...G.sand,   category: "Vie" },
  { id: "apple",     label: "Fruit",     Icon: Apple,      ...G.terracotta, category: "Vie" },
  { id: "baby",      label: "Famille",   Icon: Baby,       ...G.rose,       category: "Vie" },
  { id: "paw",       label: "Animaux",   Icon: PawPrint,   ...G.earth,      category: "Vie" },
  { id: "bird",      label: "Oiseau",    Icon: Bird,       ...G.sage,       category: "Vie" },
  { id: "fish",      label: "Poisson",   Icon: Fish,       ...G.ocean,      category: "Vie" },

  // ── Finance ──
  { id: "banknote",  label: "Billet",    Icon: Banknote,   ...G.emerald,    category: "Finance" },
  { id: "wallet",    label: "Portefeuille",Icon: Wallet,   ...G.earth,      category: "Finance" },
  { id: "card",      label: "Carte",     Icon: CreditCard, ...G.navy,       category: "Finance" },
  { id: "piggy",     label: "Épargne",   Icon: PiggyBank,  ...G.rose,       category: "Finance" },
  { id: "store",     label: "Boutique",  Icon: Store,      ...G.terracotta, category: "Finance" },
  { id: "building",  label: "Entreprise",Icon: Building2,  ...G.slate,      category: "Finance" },
  { id: "shopping",  label: "Achats",    Icon: ShoppingBag,...G.copper,     category: "Finance" },
  { id: "cart",      label: "Panier",    Icon: ShoppingCart,...G.amber,     category: "Finance" },

  // ── Médias & Loisirs ──
  { id: "camera",    label: "Photo",     Icon: Camera,     ...G.graphite,   category: "Médias" },
  { id: "film",      label: "Cinéma",    Icon: Film,       ...G.burgundy,   category: "Médias" },
  { id: "music",     label: "Musique",   Icon: Music,      ...G.plum,       category: "Médias" },
  { id: "mic",       label: "Podcast",   Icon: Mic,        ...G.terracotta, category: "Médias" },
  { id: "headphones",label: "Écoute",    Icon: Headphones, ...G.lavender,   category: "Médias" },
  { id: "radio",     label: "Radio",     Icon: Radio,      ...G.copper,     category: "Médias" },
  { id: "tv",        label: "TV",        Icon: Tv,         ...G.slate,      category: "Médias" },
  { id: "gamepad",   label: "Jeux",      Icon: Gamepad2,   ...G.navy,       category: "Médias" },
  { id: "dices",     label: "Hasard",    Icon: Dices,      ...G.amber,      category: "Médias" },
  { id: "swords",    label: "Aventure",  Icon: Swords,     ...G.burgundy,   category: "Médias" },

  // ── Science ──
  { id: "atom",      label: "Atome",     Icon: Atom,       ...G.ocean,      category: "Science" },
  { id: "telescope", label: "Cosmos",    Icon: Telescope,  ...G.navy,       category: "Science" },
  { id: "microscope",label: "Recherche", Icon: Microscope, ...G.teal,       category: "Science" },
  { id: "flask",     label: "Laboratoire",Icon: FlaskConical,...G.lavender, category: "Science" },
  { id: "infinity",  label: "Infini",    Icon: Infinity,   ...G.plum,       category: "Science" },

  // ── Premium & Symboles ──
  { id: "crown",     label: "Premium",   Icon: Crown,      ...G.amber,      category: "Premium" },
  { id: "gem",       label: "Précieux",  Icon: Gem,        ...G.ocean,      category: "Premium" },
  { id: "diamond",   label: "Diamant",   Icon: Diamond,    ...G.champagne,  category: "Premium" },
  { id: "flame",     label: "Flamme",    Icon: Flame,      ...G.copper,     category: "Premium" },
  { id: "zap",       label: "Énergie",   Icon: Zap,        ...G.amber,      category: "Premium" },
  { id: "lamp",      label: "Lumière",   Icon: Lamp,       ...G.gold,       category: "Premium" },
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
