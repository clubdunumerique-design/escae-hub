# Conventions de développement — ESCAE-BÉNIN Innovation Hub

## Structure du projet

```
src/
├── app/                    # Next.js App Router — routes et layouts
│   ├── (auth)/             # Groupe de routes authentification (Module 2)
│   ├── (dashboard)/        # Groupe de routes tableau de bord (Module 3+)
│   └── api/                # Route Handlers API
├── components/
│   ├── ui/                 # Composants génériques (Button, Card, Badge…)
│   ├── forms/              # Composants de formulaires métier
│   └── [feature]/          # Composants spécifiques à une fonctionnalité
├── lib/
│   ├── supabase/           # Clients Supabase (client.ts, server.ts)
│   ├── email/              # Service d'e-mail Resend (Module 8)
│   ├── pdf/                # Génération PDF (Module 8)
│   └── validations/        # Schémas Zod partagés
├── config/                 # Configuration app et feature flags
├── types/                  # Types TypeScript globaux
└── tests/                  # Configuration des tests (setup.ts)
```

## Règles TypeScript

- `strict: true` est obligatoire — ne jamais désactiver.
- Utiliser des `type` imports : `import type { Foo } from "./foo"`.
- Éviter `any` — utiliser `unknown` + narrowing si nécessaire.
- Les Server Actions et Route Handlers retournent `ApiResponse<T>`.

## Sécurité — règles impératives

1. **Vérifier les permissions côté serveur** à chaque opération sensible.
2. **Ne jamais lire le rôle depuis le navigateur** — toujours depuis la session Supabase côté serveur.
3. **Valider toutes les entrées** avec un schéma Zod avant traitement.
4. **Vérifier la propriété des ressources** (un étudiant ne peut voir que ses propres projets).
5. **Historiser** toute transition de statut ou décision administrative dans `audit_logs`.
6. **Storage privé** — générer des URLs signées à courte durée de vie, jamais d'URLs publiques pour les documents.

## Feature Flags

Les fonctionnalités non implémentées sont désactivées via `src/config/app.config.ts`.
Ne jamais afficher un bouton inactif sans indiquer que la fonctionnalité est indisponible.

## Conventions de nommage

| Élément | Convention | Exemple |
|---------|-----------|---------|
| Composants React | PascalCase | `ProjectCard.tsx` |
| Hooks | camelCase, préfixe `use` | `useProject.ts` |
| Server Actions | camelCase, suffixe `Action` | `submitProjectAction.ts` |
| Route Handlers | `route.ts` dans le dossier de route | `app/api/projects/route.ts` |
| Types | PascalCase | `UserProfile`, `ProjectStatus` |
| Constantes | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| Migrations SQL | timestamp + description | `20241001_create_profiles.sql` |

## Tests

- Framework : Vitest + React Testing Library
- Un fichier `.test.ts(x)` par module ou composant significatif
- Tester impérativement : accès interdits, transitions de statut invalides, validation des entrées
- Ne jamais déclarer un test passant s'il n'a pas été exécuté

## Variables d'environnement

- Préfixe `NEXT_PUBLIC_` uniquement pour les variables exposées au navigateur
- Toutes les nouvelles variables doivent être documentées dans `.env.example`
- Les valeurs provisoires sont commentées `# [PROVISOIRE]`

## Décisions en attente

Voir la section 7 du cahier des charges initial. Les fonctionnalités dépendant
de décisions non confirmées utilisent des valeurs provisoires dans `app.config.ts`,
clairement documentées.
