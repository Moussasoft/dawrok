# 🎟️ Daourak

> SaaS de gestion de files d'attente intelligente — coiffeurs, médecins, visites techniques, banques, restaurants…

Le client scanne un QR code → prend son ticket virtuel → suit son tour en temps réel sur mobile.
Le pro pilote sa file et exploite des analytics métier.

## 🚀 Démarrage

```bash
npm install
npm run db:push     # crée la base SQLite
npm run db:seed     # charge la démo (Salon Karim)
npm run dev
```

Ouvrez :
- 🌐 **Landing** : http://localhost:3000
- 🛠 **Dashboard pro** : http://localhost:3000/dashboard
  - Email : `demo@daourak.app`
  - Mot de passe : `demo1234`
- 📱 **Page client (QR)** : http://localhost:3000/q/demo-salon-karim
- 📊 **Analytics** : http://localhost:3000/dashboard/analytics
- 🔳 **QR Code** : http://localhost:3000/dashboard/qr

## 🏗 Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** + design system shadcn-style
- **Prisma** + **SQLite** (dev) — facile à migrer Postgres
- **JWT** (jose) sessions httpOnly
- **SSE** (Server-Sent Events) temps réel — multi-instance ready (remplacer le bus mémoire par Redis pub/sub en prod)
- **QR Code** server-rendered (PNG)
- **PWA** ready (manifest)
- **Zod** validation

## 📂 Structure

```
src/
├── app/
│   ├── api/                    # Route handlers
│   │   ├── auth/               # signup, login, logout
│   │   ├── tickets/            # POST (public) + PATCH/DELETE (pro)
│   │   ├── stream/             # SSE branch + ticket
│   │   └── qr/                 # PNG QR generation
│   ├── q/[qrToken]/            # Page publique : prendre un ticket
│   ├── t/[publicCode]/         # Page client : suivi en temps réel
│   ├── dashboard/              # Espace pro (auth requise)
│   │   ├── page.tsx            # File d'attente live
│   │   ├── analytics/          # Stats 30 jours
│   │   ├── qr/                 # QR code à imprimer
│   │   └── settings/
│   ├── login/, signup/, page.tsx (landing)
│   ├── globals.css, layout.tsx
├── components/
│   ├── ui/                     # button, card, input, status-badge
│   └── client-ticket-view.tsx
└── lib/
    ├── db.ts                   # Prisma singleton
    ├── auth.ts                 # JWT sessions
    ├── events.ts               # In-memory pub/sub (→ Redis en prod)
    ├── queue.ts                # ETA calc + snapshot builder
    ├── use-event-source.ts     # SSE hook
    └── utils.ts
```

## 🧠 Algorithme ETA

Pour chaque ticket en attente :
- somme des durées moyennes des services en file devant lui
- divisée par nombre d'employés actifs
- ajustée pour ceux en cours (temps écoulé soustrait à la durée moyenne)

## 🔄 Temps réel

- Le client/dashboard ouvre une connexion SSE (`/api/stream/...`)
- Toute action (nouveau ticket, appel, terminé…) déclenche `publishBranchUpdate`
- Tous les abonnés reçoivent un snapshot frais
- Refresh ETA automatique toutes les 30s

## 🌍 Vers la production

1. Remplacer SQLite par Postgres (Neon/Supabase) — changer `provider` dans `schema.prisma`
2. Remplacer le bus mémoire (`src/lib/events.ts`) par Redis pub/sub (Upstash) pour multi-instance
3. Ajouter Twilio (SMS) + Resend (emails)
4. Stripe pour les abonnements SaaS
5. Variables d'env : `JWT_SECRET` (≥32 caractères aléatoires), `NEXT_PUBLIC_APP_URL`
6. Hébergement : Vercel (front) + Railway/Fly.io (workers SSE persistants si besoin)

## 📋 Roadmap

- [x] MVP : QR, ticket, file temps réel, dashboard, analytics
- [ ] V2 : RDV planifiés, SMS, multi-langues (FR/AR/EN), branding personnalisé
- [ ] V3 : IA prédiction durée, app mobile native, marketplace intégrations
