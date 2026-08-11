---
name: nextjs-coding
description: Coding standards for Daourak - Next.js 15 App Router, TypeScript strict, next-intl i18n, Prisma ORM, Zod validation, API routes. Use when writing server actions, API endpoints, database queries, or business logic.
---

# Coding Standards — Daourak

## Stack Backend
- **Next.js 15** (App Router), React 19, TypeScript strict
- **next-intl v4** : `useTranslations()` pour les textes, clés camelCase
- **Prisma ORM** : SQLite en dev, PostgreSQL en production
- **Zod** : validation des entrées API
- **next-themes v0.4** : `ThemeProvider`

## TypeScript
- **Strict obligatoire** : pas de `any`, pas de `as` forcé sans vérification
- Typer **tous** les paramètres, retours de fonction, et states
- Utiliser `interface` pour les objets, `type` pour les unions/intersections
- `as const` pour les tableaux/objets littéraux immuables

## Internationalisation (i18n)
- **TOUJOURS** utiliser `t('section.key')` via `useTranslations()` — jamais de texte en dur
- **3 fichiers** à mettre à jour pour chaque nouveau texte :
  - `messages/ar.json` (langue par défaut)
  - `messages/fr.json`
  - `messages/en.json`
- Les clés sont en **camelCase** : `vehicleInspection` (pas `vehicle_inspection`)
- Le label du secteur s'affiche via `t('sectors.vehicleInspection')`
- Pour le RTL : `locale === 'ar'` → `dir="rtl"`

## Routes et pages
- Pages localisées dans `src/app/[locale]/...`
- Pages dans `src/app/...` (sans `[locale]`) = VESTIGES À SUPPRIMER
- `localePrefix: 'as-needed'`, `defaultLocale: 'ar'`
- `/signup` = version arabe (défaut), `/fr/signup` = français, `/en/signup` = anglais

## API Routes
- Dans `src/app/api/...`
- Format de réponse :
  ```typescript
  // Succès
  return NextResponse.json({ data }, { status: 200 });
  // Erreur
  return NextResponse.json({ error: 'message' }, { status: 400 });
  ```
- Valider les entrées avec **Zod**
- Authentification : `getSession()` depuis `@/lib/auth`

## Base de données (Prisma)
- `prisma/schema.prisma` pour le schéma
- Après modification du schéma : `npx prisma migrate dev`
- SQLite local : `prisma/dev.db`
- Jamais modifier la DB directement, toujours passer par Prisma

## Conventions
- **Variables/fonctions** : anglais (ex: `getUserById`, `isLoading`)
- **Commentaires** : français
- **Commits** : conventionnel ou français (`fix:`, `feat:`, `chore:`)
- Imports : chemins absolus avec `@/` (ex: `@/lib/auth`, `@/components/ui/button`)
