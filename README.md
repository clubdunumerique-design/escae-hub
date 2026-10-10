# ESCAE-BÉNIN Innovation Hub

Plateforme indépendante de soumission, d'évaluation et de présentation de projets étudiants pour l'ESCAE-BÉNIN.

> **Statut** : Module 0 (Fondations) — En développement

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16 (App Router) + TypeScript strict |
| Style | Tailwind CSS v4 |
| Auth & BDD | Supabase (Auth + PostgreSQL + Storage) |
| E-mails | Resend |
| PDF | @react-pdf/renderer |
| Validation | Zod |
| Tests | Vitest + React Testing Library |

## Démarrage rapide

```bash
# 1. Cloner et installer les dépendances
npm install --legacy-peer-deps

# 2. Configurer les variables d'environnement
cp .env.example .env.local
# Remplir .env.local avec vos clés Supabase et Resend

# 3. Lancer le serveur de développement
npm run dev

# 4. Ouvrir http://localhost:3000
```

## Scripts disponibles

```bash
npm run dev          # Serveur de développement
npm run build        # Build de production
npm run lint         # Vérification ESLint
npm run lint:fix     # Correction automatique ESLint
npm run format       # Formatage Prettier
npm run test         # Tests unitaires (run unique)
npm run test:watch   # Tests en mode watch
npm run test:coverage # Rapport de couverture
npm run type-check   # Vérification TypeScript sans build
```

## Structure du projet

```
src/
├── app/            # Routes Next.js (App Router)
├── components/ui/  # Composants UI réutilisables
├── config/         # Configuration et feature flags
├── lib/supabase/   # Clients Supabase (server/client séparés)
├── types/          # Types TypeScript partagés
└── tests/          # Setup des tests
supabase/
└── migrations/     # Migrations SQL versionnées
docs/
└── conventions.md  # Conventions de développement
```

## Modules de développement

| Module | Description | Statut |
|--------|-------------|--------|
| 0 | Fondations techniques | ✅ En cours |
| 1 | Base de données & migrations | ⏳ À venir |
| 2 | Authentification & rôles | ⏳ À venir |
| 3 | Soumission de projets | ⏳ À venir |
| 4 | Instruction administrative | ⏳ À venir |
| 5 | Évaluation du jury | ⏳ À venir |
| 6 | Validation direction | ⏳ À venir |
| 7 | Programmation présentations | ⏳ À venir |
| 8 | Export PDF & e-mails | ⏳ À venir |
| 9 | Tests automatisés complets | ⏳ À venir |

## Décisions provisoires

Certaines configurations utilisent des valeurs provisoires documentées dans
`src/config/app.config.ts`. Elles doivent être confirmées avec l'administration
avant la mise en production. Voir le cahier des charges, section 7.

## Sécurité

- Les politiques RLS Supabase sont activées sur toutes les tables de données utilisateurs.
- Les fichiers sont stockés dans des buckets privés Supabase Storage.
- Les rôles utilisateurs sont vérifiés côté serveur uniquement.
- Aucune clé secrète n'est exposée dans le navigateur.

Voir [`docs/conventions.md`](docs/conventions.md) pour les règles complètes.
