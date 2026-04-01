

# Ajouter le sélecteur de palettes et garantir la visibilité du switch Classic/Ivoire

## Problème identifié

En mode neumorphique (Ivoire), la **sidebar SidebarNM.tsx** ne contient **aucun sélecteur de palettes** — seuls les switchs Clair/Sombre/Mixte et Classic/Ivoire sont présents. L'utilisateur ne peut donc pas changer de thème visuel sans repasser en mode Classic ou aller dans les Settings.

Le composant `EuthymiaTheme.tsx` existe mais **n'est importé nulle part** — c'est du code mort.

## Plan d'implémentation

### 1. Ajouter un sélecteur de palettes dans SidebarNM.tsx

Insérer un sélecteur de palettes compact (pastilles de couleurs) entre le switch Clair/Sombre et le switch Classic/Ivoire, en utilisant le style neumorphique existant (ombres `inset`/`raised`, fond `BG`, couleurs `C`).

- Importer `setPalette` et `palette` depuis `useThemeMode()` (déjà disponible dans le composant)
- Importer `PALETTE_META` depuis le contexte
- Afficher les palettes sous forme de pastilles de couleurs enveloppées dans un conteneur `flex-wrap` avec fond neumorphique
- Marquer la palette active avec un contour ou une ombre `raised`
- Grouper visuellement les familles (Classiques, Bento, Liquid Glass, Soft UI) avec de petits séparateurs ou labels discrets

### 2. Supprimer le fichier mort EuthymiaTheme.tsx

Ce composant n'est utilisé nulle part et fait doublon avec le `ThemePalettePanel` de Settings.tsx.

### Détails techniques

**Fichiers modifiés :**
- `src/components/SidebarNM.tsx` — ajout du picker de palettes avec `PALETTE_META`, `palette`, `setPalette`
- Suppression de `src/components/EuthymiaTheme.tsx`

**Structure du picker dans SidebarNM :**
```text
┌─────────────────────────┐
│  ☀ Clair │ ☽ Sombre │ ⊙ │  ← existant
├─────────────────────────┤
│  ●● ●● ●● ●● ●●        │  ← NOUVEAU : pastilles palettes
│  ●● ●● ●● ●● ●●        │    (scroll vertical si besoin)
├─────────────────────────┤
│  ⊞ Classic │ ✦ Ivoire   │  ← existant
└─────────────────────────┘
```

Chaque pastille = 2 cercles de couleur (les 2 premières de `PALETTE_META[key].colors`), avec tooltip du nom. La palette active reçoit un `boxShadow: raised` et un contour accent.

