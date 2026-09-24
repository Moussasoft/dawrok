# 🎟️ Daourak — دورك

> SaaS de gestion de files d'attente intelligente — coiffeurs, médecins, visites techniques, banques, restaurants…

Le client scanne un QR code → prend son ticket virtuel → suit son tour en temps réel sur mobile (et reçoit une notification, même écran verrouillé).
Le pro pilote sa file depuis un tableau de bord temps réel, un écran TV annonce les appels, et le superadmin gère la plateforme.

Interface disponible en **arabe (par défaut, RTL)**, **français** et **anglais**.

## 🚀 Démarrage

```bash
cp .env.example .env   # puis renseigner les valeurs
npm install
npm run db:push        # crée / met à jour la base SQLite
npm run db:seed        # charge la démo (⚠️ réinitialise l'organisation « salon-karim »)
npm run dev
```

Ouvrez :
- 🌐 **Landing** : http://localhost:3000 (arabe) · http://localhost:3000/fr · http://localhost:3000/en
- 🛠 **Dashboard pro** : http://localhost:3000/fr/dashboard — `demo@daourak.app` / `demo1234`
- 🛡 **Superadmin** : http://localhost:3000/fr/admin — `super@daourak.app` / `super1234`
- 📱 **Page client (QR)** : http://localhost:3000/fr/q/demo-salon-karim
- 📺 **Écran TV** : http://localhost:3000/fr/screen/demo-salon-karim

## ⚙️ Variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | oui | `file:./dev.db` en dev ; PostgreSQL recommandé en prod |
| `JWT_SECRET` | **oui en prod** | ≥ 32 caractères aléatoires (`openssl rand -base64 48`). Le serveur refuse de démarrer une session avec un secret absent ou d'exemple. |
| `NEXT_PUBLIC_APP_URL` | oui | URL publique (QR codes, liens des notifications) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | non | Notifications push. Générer avec `npx web-push generate-vapid-keys`. Sans ces clés, seules les alertes « page ouverte » fonctionnent. |
| `TRUSTED_PROXY_HOPS` | non | Nombre de proxys de confiance devant l'app (défaut 1) pour lire l'IP réelle du client (rate limiting). |
| `TRUST_X_REAL_IP` | non | `1` pour lire `X-Real-IP` — seulement si le proxy l'écrase toujours (sinon falsifiable). |

## 🧪 Qualité

```bash
npm run typecheck   # TypeScript strict
npm run lint        # ESLint (next/core-web-vitals)
npm test            # Vitest — logique métier (fuseaux, créneaux, file, statuts, i18n…)
npm run build
```

## 🏗 Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** strict
- **next-intl v4** : `ar` (défaut, sans préfixe), `fr`, `en` — traductions dans `messages/*.json`
- **Tailwind CSS 3** + composants maison style shadcn (`src/components/ui`)
- **Prisma** + **SQLite** (dev) — migrable vers PostgreSQL
- Sessions **JWT** (jose) en cookie httpOnly, **revérifiées en base à chaque requête**
- **SSE** temps réel + **Web Push** (service worker `public/sw.js`)
- **Zod** pour valider toutes les entrées d'API

## 📂 Structure

```
src/
├── app/
│   ├── [locale]/                 # Toutes les pages, par langue
│   │   ├── page.tsx              # Landing (composant serveur)
│   │   ├── q/[qrToken]/          # Page publique : prendre un ticket / réserver
│   │   ├── t/[publicCode]/       # Suivi du ticket client (temps réel + notifications)
│   │   ├── screen/[qrToken]/     # Écran TV (annonces vocales)
│   │   ├── dashboard/            # Espace pro : file, analytics, clients, QR, réglages
│   │   ├── admin/                # Superadmin : vue globale, organisations, audit, réglages
│   │   └── login, signup, poster
│   └── api/
│       ├── stream/branch/[qrToken]      # SSE PUBLIC anonymisé (TV, page QR)
│       ├── stream/dashboard/[branchId]  # SSE AUTHENTIFIÉ (données complètes)
│       ├── stream/ticket/[publicCode]   # SSE du détenteur d'un ticket
│       ├── tickets, appointments, dashboard/*, settings/*, admin/*, push/*, health
├── lib/
│   ├── auth.ts, guards.ts        # Session + contrôle d'accès (à appeler dans CHAQUE page/route)
│   ├── queue.ts                  # Instantané de file, hub temps réel, numérotation atomique
│   ├── queue-logic.ts            # Logique pure : ordre, ETA, stats, anonymisation (testée)
│   ├── time.ts, opening-hours.ts, slots.ts  # Fuseaux, horaires, créneaux (testés)
│   ├── ticket-status.ts          # Machine à états des tickets (testée)
│   ├── plans.ts                  # Limites des offres (appliquées côté serveur)
│   ├── push.ts / push-client.ts  # Web Push serveur / navigateur
│   └── rate-limit.ts, api.ts, api-client.ts, format.ts…
└── i18n/                         # routing, request, redirectTo (redirections localisées)
```

## 🧠 Règles métier

- **Numérotation** : un compteur par agence et par **jour local de l'agence** (`DailyCounter`), incrémenté atomiquement — jamais deux clients avec le même numéro.
- **Ordre de la file** : clients en cours, puis tickets en attente par priorité puis heure d'arrivée. Un **rendez-vous arrivé à échéance passe en tête de file**.
- **Estimation d'attente** : chaque employé actif est un guichet ; un ticket part au guichet libéré le plus tôt, en tenant compte du temps restant des clients en cours.
- **Réservation** : créneaux calculés dans le fuseau de l'agence et ses horaires d'ouverture, capacité = employés actifs, chevauchements pris en compte, validation côté serveur.
- **Horaires d'ouverture** : optionnels. S'ils sont définis, les tickets QR sont refusés hors horaires (le staff peut toujours créer un ticket comptoir).
- **Offres** : limites de succursales / employés / prestations et fonctionnalités (réservation, analytics, couleur de marque) éditables par le superadmin et appliquées par l'API.

## 🔐 Sécurité

- Le flux SSE public ne contient **ni prénom, ni téléphone, ni code de ticket** (le QR est affiché publiquement).
- Sessions revérifiées en base : révoquer un superadmin, supprimer un compte ou suspendre une organisation prend effet immédiatement.
- Rate limiting (connexion, inscription, tickets, réservations, annulations), en-têtes de sécurité, erreurs d'API sous forme de codes stables traduits côté client.

## 🌍 Vers la production

1. **PostgreSQL** (Neon, Supabase…) : `provider = "postgresql"` dans `schema.prisma`, puis passer à `prisma migrate`.
2. **Plusieurs instances** : le bus temps réel, le cache d'instantanés et le rate limiting sont en mémoire → Redis (Upstash) pub/sub et rate limit.
3. Secrets : `JWT_SECRET`, clés VAPID, `NEXT_PUBLIC_APP_URL` en HTTPS (obligatoire pour le push).
4. Supervision : brancher `/api/health` sur un moniteur, ajouter Sentry.
5. Prochaines briques : e-mails (réinitialisation de mot de passe, alertes superadmin), SMS/WhatsApp, paiement des abonnements.

Voir [AUDIT.md](AUDIT.md) pour l'audit complet et ce qui reste à faire.
