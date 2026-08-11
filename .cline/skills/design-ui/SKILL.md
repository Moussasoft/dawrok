---
name: design-ui
description: Design and UI tasks for Daourak - Tailwind CSS v4, shadcn/ui components, RTL Arabic support, dark mode responsive design. Use when creating or modifying UI components, pages, layouts, or styling.
---

# Design & UI — Daourak

## Stack Design
- **Tailwind CSS v4** avec `darkMode: ['class']`
- **shadcn/ui** : tous les composants dans `src/components/ui/` (Button, Card, Input, Label, etc.)
- **next-themes v0.4** : `ThemeProvider` avec `defaultTheme="system"` (clair/sombre/auto)
- **Icônes** : Lucide React
- **Polices** : Inter (latin), Noto Kufi Arabic (arabe)
- **Variables CSS** : utiliser les tokens du thème (--primary, --background, --foreground, --radius, etc.)

## RTL (Right-to-Left) pour l'arabe
- L'attribut `dir="rtl"` est sur `<html>` quand `locale === 'ar'`
- La classe `[dir="rtl"] body` applique `font-family: var(--font-arabic)`
- Utiliser les propriétés logiques Tailwind : `ms-*` / `me-*` (margin-start/end) au lieu de `ml-*` / `mr-*`
- Utiliser `ps-*` / `pe-*` (padding-start/end) au lieu de `pl-*` / `pr-*`
- Les icônes et flèches doivent s'inverser en RTL : ajouter `rtl:rotate-180` si nécessaire

## Dark Mode
- **TOUJOURS** tester avec les variants `dark:` pour tous les nouveaux composants
- `bg-background` / `bg-card` s'adaptent automatiquement
- `text-foreground` / `text-muted-foreground` pour les couleurs de texte
- `border` / `border-input` pour les bordures adaptatives
- Ne PAS utiliser de couleurs codées en dur (ex: `bg-white`, `text-black`)
- Les composants shadcn/ui gèrent déjà le dark mode

## Responsive Design
- **Mobile-first** : commencer par le design mobile, puis `md:`, `lg:`, `xl:`
- Container centré : `container` (max-width 1400px)
- Breakpoints standard Tailwind : `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`, `2xl:1536px`

## Composants shadcn/ui
- Toujours utiliser les composants shadcn/ui existants avant d'en créer de nouveaux
- Liste : Button, Card, Input, Label, Badge, Select, Dialog, DropdownMenu, Tabs, Toast (sonner)
- Pour créer un nouveau composant shadcn : `npx shadcn@latest add <nom>`

## Conventions
- Composants réutilisables dans `src/components/`
- `'use client'` uniquement si nécessaire (interactivité, hooks)
- Pages dans `src/app/[locale]/...`
- Exporter les composants en `export function` ou `export default function`
