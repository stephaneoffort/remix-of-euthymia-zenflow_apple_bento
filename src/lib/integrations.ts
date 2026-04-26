export type IntegrationCategory = "storage" | "collaboration" | "communication" | "productivity"

export interface IntegrationConfig {
  provider: string
  label: string
  description: string
  category: IntegrationCategory
  authUrl: string
  scopes: string[]
  extraParams?: Record<string, string>
  enabled: boolean
  iconBg: string
  iconSvg: string
}

export const INTEGRATIONS: IntegrationConfig[] = [
  {
    provider: "dropbox",
    label: "Dropbox",
    description: "Stockage et partage de fichiers",
    category: "storage",
    authUrl: "https://www.dropbox.com/oauth2/authorize",
    scopes: [],
    extraParams: { token_access_type: "offline" },
    enabled: true,
    iconBg: "#E8F0FE",
    iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <path d="M6 2L12 6.5L6 11L0 6.5Z" fill="#0061FF"/>
      <path d="M18 2L24 6.5L18 11L12 6.5Z" fill="#0061FF"/>
      <path d="M0 13.5L6 9L12 13.5L6 18Z" fill="#0061FF"/>
      <path d="M24 13.5L18 9L12 13.5L18 18Z" fill="#0061FF"/>
      <path d="M6 19.5L12 15L18 19.5L12 24Z" fill="#0061FF"/>
    </svg>`,
  },
  {
    provider: "google_drive",
    label: "Google Drive",
    description: "Documents et ressources partagées",
    category: "storage",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    extraParams: { access_type: "offline", prompt: "consent" },
    enabled: false,
    iconBg: "#F4F4F4",
    iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22">
      <path d="M4.5 20L9 12H20.5L16 20H4.5Z" fill="#34A853"/>
      <path d="M1 14L6 6L9 12L4.5 20Z" fill="#4285F4"/>
      <path d="M6 6H18L20.5 12H9Z" fill="#FBBC04"/>
    </svg>`,
  },
  {
    provider: "miro",
    label: "Miro",
    description: "Tableaux blancs collaboratifs",
    category: "collaboration",
    authUrl: "https://miro.com/oauth/authorize",
    scopes: ["boards:read", "boards:write"],
    enabled: true,
    iconBg: "#FFF9DB",
    iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <rect width="24" height="24" rx="4" fill="#FFD02F"/>
      <text x="5" y="17" font-size="13" font-weight="700" fill="#050038" font-family="sans-serif">M</text>
    </svg>`,
  },
  {
    provider: "notion",
    label: "Notion",
    description: "Base de connaissance et notes",
    category: "collaboration",
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    scopes: [],
    extraParams: { response_type: "code", owner: "user" },
    enabled: true,
    iconBg: "#F6F6F6",
    iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <rect width="24" height="24" rx="4" fill="#191919"/>
      <text x="6" y="17" font-size="13" font-weight="700" fill="white" font-family="sans-serif">N</text>
    </svg>`,
  },
]

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  storage:       "Stockage & fichiers",
  collaboration: "Collaboration",
  communication: "Communication",
  productivity:  "Productivité",
}

export function getIntegrationsByCategory(): [IntegrationCategory, IntegrationConfig[]][] {
  const order: IntegrationCategory[] = ["storage", "collaboration", "communication", "productivity"]
  const groups = new Map<IntegrationCategory, IntegrationConfig[]>()
  for (const cat of order) {
    const items = INTEGRATIONS.filter(i => i.category === cat)
    if (items.length > 0) groups.set(cat, items)
  }
  return Array.from(groups.entries())
}
