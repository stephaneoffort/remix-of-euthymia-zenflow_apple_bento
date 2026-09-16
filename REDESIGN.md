# Refonte design ZenFlow — brief pour Claude Code

## Objectif

Refondre entièrement l'apparence de ZenFlow dans un esprit Apple (iOS / macOS) : élégant, calme, clair, doux, jamais flashy ni trop contrasté. Accent vert sauge. Deux thèmes (clair et sombre) qui suivent automatiquement le réglage du système.

**Il s'agit d'une refonte purement visuelle.** Toutes les fonctionnalités, tous les composants, tous les écrans et tous les parcours existants doivent être conservés à l'identique.

## Contraintes absolues

1. Ne modifier AUCUNE logique : hooks, contextes, requêtes Supabase, appels API, gestion d'état, routes, permissions, RLS, migrations, fonctions edge.
2. Ne pas toucher au dossier `supabase/`, aux fichiers `src/integrations/supabase/*` ni au `.env`.
3. Ne supprimer aucun composant, aucune prop, aucun texte fonctionnel, aucun gestionnaire d'événement.
4. Ne pas ajouter de dépendance sans me demander (exception acceptée : police Inter via Google Fonts ou `@fontsource/inter`).
5. Travailler sur la branche `redesign-apple`. Faire un commit à la fin de chaque phase, avec un message clair.
6. À la fin de chaque phase : lancer `npm run build`, corriger les erreurs éventuelles, puis **s'arrêter et me montrer ce qui a changé** avant de passer à la suite.
7. En cas de doute entre modifier la présentation et la logique : ne pas modifier, me demander.

## Principes visuels

- **Surfaces** : fond de page légèrement chaud, cartes blanches (ou gris très sombre en mode sombre) regroupées « à la iOS ». Dans les listes, séparer les éléments par des filets fins plutôt que par des cadres individuels.
- **Typographie** : pile système Apple, avec Inter en secours sous Windows et Android. Grands titres légers, légèrement resserrés (`letter-spacing: -0.02em`). Deux graisses principales : 400 et 500 (600 toléré pour les grands titres). Texte courant en 15 px sur mobile.
- **Couleur** : un seul accent (sauge). Les autres couleurs servent uniquement à différencier projets, étiquettes et statuts, toujours en teintes adoucies (pastel en clair, fond teinté sombre en sombre).
- **Rayons** : 14 px pour les cartes, 10 px pour les champs et boutons, 999 px pour les pastilles et badges.
- **Ombres** : très diffuses et discrètes, seulement pour ce qui flotte (menus, dialogues, bouton flottant). Aucune ombre sur les cartes posées dans la page.
- **Bordures** : 1 px avec la couleur `--border` (fine et peu visible).
- **Translucidité** : sidebar desktop et barre d'en-tête collante en fond semi-transparent avec `backdrop-blur-xl`.
- **Mouvement** : transitions de 150 à 200 ms, `ease-out`. Léger `scale(0.98)` au clic des boutons. Respecter `prefers-reduced-motion`.
- **Espacement** : généreux. En cas d'hésitation, plus d'air.
- **Commandes natives** : segmented control pour les sélecteurs de vue (Liste / Tableau / Calendrier), cases à cocher rondes pour les tâches, interrupteurs style iOS, bouton flottant rond « + » sur mobile, barre d'onglets en bas sur mobile si la navigation s'y prête.

## Phase 0 — Audit (aucune modification)

1. Lister la stack réelle : version de Tailwind, présence de shadcn/ui, fichier de config Tailwind, emplacement des variables CSS (`src/index.css`), gestion du thème sombre (`darkMode: ["class"]`, `next-themes` ou autre).
2. Lister tous les composants de `src/components/ui/` et tous les écrans et pages.
3. Repérer les couleurs codées en dur (`bg-blue-500`, `text-gray-600`, hex dans le JSX, etc.) qui contourneraient le design system.
4. Me présenter un plan court, puis attendre ma validation.

## Phase 1 — Design system (tokens)

Remplacer les variables de `src/index.css` par celles-ci (format shadcn : valeurs HSL sans `hsl()`). Si le projet utilise un autre format, adapter en conservant exactement ces couleurs.

```css
@layer base {
  :root {
    --background: 60 11% 93%;          /* #EFEFEB (contraste renforcé vs. #F5F5F3, esprit Réglages iOS) */
    --foreground: 240 3% 12%;          /* #1D1D1F */
    --card: 0 0% 100%;                 /* #FFFFFF */
    --card-foreground: 240 3% 12%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 3% 12%;
    --primary: 129 14% 44%;            /* #5F7F64 sauge (texte blanc lisible) */
    --primary-foreground: 0 0% 100%;
    --secondary: 72 15% 94%;           /* #F0F1EC */
    --secondary-foreground: 240 3% 12%;
    --muted: 72 15% 94%;
    --muted-foreground: 60 2% 41%;     /* #6B6B66 */
    --accent: 105 21% 93%;             /* #EAF0E8 teinte sauge */
    --accent-foreground: 129 15% 37%;  /* #4F6B53 */
    --destructive: 8 45% 44%;          /* terre cuite */
    --destructive-foreground: 0 0% 100%;
    --border: 60 9% 89%;               /* #E6E6E1 */
    --input: 60 9% 89%;
    --ring: 128 13% 50%;               /* #6F8F73 */
    --radius: 0.875rem;

    --sidebar-background: 60 11% 93%;
    --sidebar-foreground: 240 3% 12%;
    --sidebar-primary: 129 14% 44%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 105 21% 93%;
    --sidebar-accent-foreground: 129 15% 37%;
    --sidebar-border: 60 9% 89%;
    --sidebar-ring: 128 13% 50%;

    /* Palette douce commune (10 tons) : projets, avatars, tâches, étiquettes, équipes */
    --tone-sage-solid: 128 13% 50%;       --tone-sage-bg: 108 22% 87%;       --tone-sage-fg: 129 18% 30%;
    --tone-slate-solid: 214 17% 51%;      --tone-slate-bg: 213 30% 88%;      --tone-slate-fg: 212 22% 34%;
    --tone-sand-solid: 34 35% 57%;        --tone-sand-bg: 37 51% 86%;        --tone-sand-fg: 33 43% 32%;
    --tone-terracotta-solid: 11 40% 54%;  --tone-terracotta-bg: 13 50% 87%;  --tone-terracotta-fg: 11 44% 34%;
    --tone-lavender-solid: 259 19% 58%;   --tone-lavender-bg: 258 31% 89%;   --tone-lavender-fg: 257 23% 37%;
    --tone-rose-solid: 347 28% 61%;       --tone-rose-bg: 346 37% 89%;       --tone-rose-fg: 343 26% 37%;
    --tone-mist-solid: 192 25% 53%;       --tone-mist-bg: 191 33% 88%;       --tone-mist-fg: 192 28% 32%;
    --tone-olive-solid: 69 20% 47%;       --tone-olive-bg: 66 28% 85%;       --tone-olive-fg: 69 28% 28%;
    --tone-ochre-solid: 39 49% 54%;       --tone-ochre-bg: 40 61% 85%;       --tone-ochre-fg: 39 55% 28%;
    --tone-stone-solid: 60 3% 51%;        --tone-stone-bg: 60 8% 88%;        --tone-stone-fg: 60 3% 30%;

    --shadow-float: 0 8px 30px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04);
  }

  .dark {
    --background: 0 0% 7%;             /* #121212 */
    --foreground: 60 9% 94%;           /* #F2F2EF */
    --card: 60 2% 12%;                 /* #1E1E1D */
    --card-foreground: 60 9% 94%;
    --popover: 60 1% 14%;              /* #252524 */
    --popover-foreground: 60 9% 94%;
    --primary: 129 15% 56%;            /* #7FA184 */
    --primary-foreground: 0 0% 7%;
    --secondary: 60 2% 16%;            /* #2A2A28 */
    --secondary-foreground: 60 9% 94%;
    --muted: 60 2% 16%;
    --muted-foreground: 60 2% 55%;     /* #8E8E89 */
    --accent: 135 13% 18%;             /* #27332A */
    --accent-foreground: 129 19% 72%;  /* #A9C4AD */
    --destructive: 10 64% 72%;         /* #E59B8C */
    --destructive-foreground: 0 0% 7%;
    --border: 60 2% 18%;               /* #2E2E2C */
    --input: 60 2% 18%;
    --ring: 129 15% 56%;

    --sidebar-background: 0 0% 7%;
    --sidebar-foreground: 60 9% 94%;
    --sidebar-primary: 129 15% 56%;
    --sidebar-primary-foreground: 0 0% 7%;
    --sidebar-accent: 135 13% 18%;
    --sidebar-accent-foreground: 129 19% 72%;
    --sidebar-border: 60 2% 18%;
    --sidebar-ring: 129 15% 56%;

    --tone-sage-solid: 127 17% 62%;       --tone-sage-bg: 135 13% 18%;       --tone-sage-fg: 129 19% 72%;
    --tone-slate-solid: 214 22% 65%;      --tone-slate-bg: 215 18% 18%;      --tone-slate-fg: 214 25% 73%;
    --tone-sand-solid: 34 40% 67%;        --tone-sand-bg: 35 19% 17%;        --tone-sand-fg: 37 44% 71%;
    --tone-terracotta-solid: 12 47% 65%;  --tone-terracotta-bg: 10 26% 18%;  --tone-terracotta-fg: 10 63% 72%;
    --tone-lavender-solid: 258 24% 70%;   --tone-lavender-bg: 257 14% 19%;   --tone-lavender-fg: 257 30% 77%;
    --tone-rose-solid: 347 33% 72%;       --tone-rose-bg: 343 14% 19%;       --tone-rose-fg: 347 39% 78%;
    --tone-mist-solid: 192 31% 66%;       --tone-mist-bg: 200 26% 18%;       --tone-mist-fg: 192 34% 71%;
    --tone-olive-solid: 69 24% 59%;       --tone-olive-bg: 70 14% 16%;       --tone-olive-fg: 68 27% 65%;
    --tone-ochre-solid: 39 56% 64%;       --tone-ochre-bg: 37 29% 18%;       --tone-ochre-fg: 39 59% 67%;
    --tone-stone-solid: 60 4% 63%;        --tone-stone-bg: 60 2% 16%;        --tone-stone-fg: 60 4% 68%;

    --shadow-float: 0 8px 30px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3);
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
```

Dans `tailwind.config.ts` :
- ajouter les couleurs `tone.*` (par exemple `tone-sage-bg`, `tone-sage-fg`) branchées sur ces variables ;
- ajouter `boxShadow.float: "var(--shadow-float)"` ;
- vérifier que `darkMode: ["class"]` est présent.

Thème automatique : si ce n'est pas déjà en place, faire en sorte que la classe `dark` suive `prefers-color-scheme` par défaut (via `next-themes` avec `defaultTheme="system"` s'il est déjà installé, sinon un petit script). Conserver tout sélecteur de thème existant.

Références hex pour contrôle visuel :

| Rôle | Clair | Sombre |
|---|---|---|
| Fond de page | #EFEFEB | #121212 |
| Carte | #FFFFFF | #1E1E1D |
| Texte principal | #1D1D1F | #F2F2EF |
| Texte secondaire | #6B6B66 | #8E8E89 |
| Filet / bordure | #E6E6E1 | #2E2E2C |
| Sauge (bouton) | #5F7F64 | #7FA184 |
| Sauge (icône, coche) | #6F8F73 | #A2C0A6 |

### Palette douce commune (10 tons)

Utilisée partout où une couleur est choisie par l'utilisateur : avatars de membres, couleur de projet, couleur de tâche (vue Gantt), couleur d'équipe. Chaque ton a une pastille pleine (mode clair / mode sombre) et une paire fond+texte d'étiquette (mode clair / mode sombre).

| Ton | Pastille claire | Pastille sombre | Étiquette claire (fond / texte) | Étiquette sombre (fond / texte) |
|---|---|---|---|---|
| Sauge | #6F8F73 | #8FAF93 | #D9E5D6 / #3F5A43 | #27332A / #A9C4AD |
| Ardoise | #6E8098 | #93A4BA | #D8E0EA / #435468 | #262D37 / #A9B8CB |
| Sable | #B8966A | #CDB08A | #EDDFC8 / #74552E | #352E24 / #D6BD95 |
| Terre cuite | #B86B5A | #D08E7E | #EFD6CF / #7E3F31 | #3A2622 / #E59B8C |
| Lavande | #8C7FA8 | #AA9FC4 | #E0DBEC / #544873 | #2E2A38 / #BDB3D6 |
| Rose poudré | #B8808C | #CFA0AA | #EDD8DD / #764553 | #382A2E / #DDB2BB |
| Bleu brume | #6A9AA6 | #8DB8C3 | #D5E6EA / #3A5F68 | #22323A / #9CC4CE |
| Olive | #8A9160 | #A9B07F | #E2E4CF / #545A33 | #2E3024 / #B9BF8F |
| Ocre | #C39A4E | #D6B26E | #F0E1C2 / #6E5320 | #3A3020 / #DDBB7A |
| Pierre | #86867F | #A3A39C | #E2E2DD / #50504B | #2A2A28 / #B0B0A9 |

Implémentée dans `src/lib/toneColor.ts` : la fonction `getClosestTone(hex)` renvoie, pour une couleur déjà enregistrée en base, le ton le plus proche à afficher — jamais utilisée pour modifier les données. Elle vérifie d'abord une table fixe (couleurs connues des anciennes palettes, validées à la main pour rester distinctes entre membres/projets/équipes), puis calcule en repli une distance de couleur ("redmean") vis-à-vis des 10 pastilles de référence.

Sélecteurs mis à jour pour proposer ces 10 tons (`TONE_SOLID_HEX`, ou `TONE_LABEL_TEXT_HEX` pour une couleur de texte) : `SelectTeamMember.tsx`, `MemberProfileEditor.tsx`, `AppSidebar.tsx` (couleur de projet), `GanttView.tsx` (couleur de tâche), `RichTextEditor.tsx` (couleur de texte), `orgColors.ts` (couleur d'équipe). Le format des valeurs enregistrées (hex simple) est inchangé.

Non couvert pour l'instant : les icônes d'espace (`SpaceIcon.tsx`), qui utilisent un système de préréglages icône+dégradé incompatible avec une couleur plate — à revisiter avec le logo, en fin de refonte. Le bouton de surlignage de `RichTextEditor.tsx` (jaune fixe) reste également inchangé, ce n'est pas une palette.

## Phase 2 — Composants de base (`src/components/ui/`)

Restyler, sans changer leur API ni leur comportement :

- **Button** : hauteur 40 px (36 px pour la taille `sm`), rayon 10 px, graisse 500, `active:scale-[0.98]`, transition 150 ms. La variante `default` est en sauge ; `secondary` en fond `secondary` sans bordure ; `outline` avec une bordure `border` fine ; `ghost` avec un survol `muted`.
- **Card** : fond `card`, bordure fine, rayon 14 px, sans ombre, padding généreux.
- **Input, Textarea, Select** : hauteur 40 px, rayon 10 px, fond `card`, bordure `input`, focus par un anneau sauge doux (`ring-2 ring-ring/30`) sans contour dur.
- **Checkbox** : ronde (`rounded-full`) pour les tâches, remplie en sauge une fois cochée.
- **Switch** : style iOS, piste sauge quand actif.
- **Badge** : pastille `rounded-full`, texte de 11 à 12 px, variantes basées sur les `tone-*`.
- **Tabs** : style segmented control (fond `muted`, onglet actif sur fond `card` avec une ombre très légère).
- **Dialog, Sheet, Popover, DropdownMenu** : rayon 14 à 16 px, `shadow-float`, overlay `bg-black/30` avec `backdrop-blur-sm`.
- **Sidebar** : fond semi-transparent avec `backdrop-blur-xl`, élément actif en fond `accent` et texte `accent-foreground`, icônes de 18 px.
- **Tooltip, Toast** : rayon 10 px, discrets.
- **Avatar** : fond `accent`, initiales `accent-foreground`.
- **Progress** : barre de 4 px, piste `muted`, remplissage sauge ou `tone`.

## Phase 3 — Remplacement des couleurs codées en dur

Remplacer toutes les classes de couleur Tailwind brutes et les hex relevés en phase 0 par les tokens (`bg-card`, `text-muted-foreground`, `tone-*`, etc.). Les couleurs de projet choisies par l'utilisateur doivent être converties vers la teinte `tone` la plus proche, uniquement à l'affichage, sans modifier les valeurs en base de données.

## Phase 4 — Écrans, un par un

Pour chaque écran (tableau de bord, liste des projets, vue projet, tableau kanban, calendrier, équipe, paramètres, authentification, onboarding, invitations, etc.) :

- **En-tête** : grand titre (26 à 28 px, graisse 500 ou 600), sous-titre en `muted-foreground`.
- **Listes** : regrouper en cartes « groupe iOS » avec des séparateurs fins, et des titres de section discrets au-dessus.
- **États vides** : icône douce, phrase courte, un seul bouton.
- **Mobile** : vérifier la largeur de 375 px, les zones tactiles d'au moins 44 px et le bouton flottant « + ».
- **Validation** : me montrer chaque écran, ou petit groupe d'écrans, avant de continuer.

## Phase 5 — Finitions

- Micro-animations : apparition des listes, coche des tâches, ouverture des menus.
- Écran de chargement et squelettes (`Skeleton`) aux couleurs `muted`.
- Icône et `theme-color` de la PWA : `#EFEFEB` en clair, `#121212` en sombre.
- Contrôle d'accessibilité : contraste AA sur les textes, focus visible au clavier.

## Vérifications finales

- `npm run build` sans erreur, `npm run lint` sans nouvelle erreur.
- Chaque écran contrôlé en clair et en sombre, en mobile (375 px) et en desktop (1440 px).
- Connexion, création de projet et de tâche, invitation et notifications testées : tout fonctionne exactement comme avant.
- Diff final : aucun fichier de logique, Supabase ou config serveur modifié (vérifier avec `git diff --stat main`).
