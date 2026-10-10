# Dossier des migrations SQL — ESCAE-BÉNIN Innovation Hub

Ce dossier contient les migrations de base de données versionnées pour Supabase.

## Convention de nommage

```
YYYYMMDDHHMMSS_description_courte.sql
```

Exemples :
- `20241001120000_create_profiles_table.sql`
- `20241002090000_add_rls_to_projects.sql`
- `20241003150000_create_audit_logs.sql`

## Règles

1. **Ne jamais modifier une migration déjà appliquée en production.**
   Créer une nouvelle migration corrective à la place.

2. **Chaque migration doit être réversible** ou documenter pourquoi elle ne l'est pas.

3. **Tester en staging avant d'appliquer en production.**

4. **Inclure un commentaire d'en-tête** dans chaque fichier SQL :
   ```sql
   -- Migration: 20241001120000_create_profiles_table
   -- Description: Crée la table profiles avec les politiques RLS
   -- Auteur: <prénom nom>
   -- Réversible: oui (voir section DOWN)
   ```

5. **RLS obligatoire** sur toutes les tables contenant des données utilisateurs.

## Application des migrations

```bash
# Via Supabase CLI (recommandé)
supabase db push

# Vérifier les migrations appliquées
supabase migration list
```

## État actuel

| Migration | Statut |
|-----------|--------|
| *(Module 1 — non encore créé)* | en attente |
