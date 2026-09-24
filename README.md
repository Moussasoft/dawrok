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

### PostgreSQL (production)

Le schéma de développement (`prisma/schema.prisma`, SQLite) est décliné pour PostgreSQL dans `prisma/postgres/schema.prisma`, avec des migrations versionnées :

```bash
export DATABASE_URL="postgresql://utilisateur:motdepasse@hote:5432/daourak"
npm run db:pg:generate   # client Prisma pour PostgreSQL
npm run db:pg:migrate    # applique prisma/postgres/migrations
npm run build && npm start
```

Après une modification du schéma : `npm run db:push` (SQLite), `npm run db:pg:sync`, puis `npm run db:pg:new-migration -- --name <nom>` contre une base PostgreSQL de développement, et commiter la migration (un test vérifie que les deux schémas restent alignés).

### Docker

```bash
cp .env.example .env        # au minimum JWT_SECRET ; NEXT_PUBLIC_APP_URL = URL publique
docker compose up --build   # PostgreSQL + Redis + migrations + application sur le port 3000
```

Image seule : `docker build --build-arg NEXT_PUBLIC_APP_URL=https://votre-domaine -t daourak .` (les variables `NEXT_PUBLIC_*` sont intégrées au build), migrations avec `docker compose run --rm migrate`. L'image utilise la sortie autonome de Next.js (`NEXT_OUTPUT=standalone`), tourne sans les droits root et expose un healthcheck sur `/api/health`.

## ⚙️ Variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | oui | `file:./dev.db` en dev ; PostgreSQL recommandé en prod |
| `JWT_SECRET` | **oui en prod** | ≥ 32 caractères aléatoires (`openssl rand -base64 48`). En production, le serveur refuse de démarrer avec un secret absent, court ou d'exemple. |
| `NEXT_PUBLIC_APP_URL` | oui | URL publique (QR codes, liens des notifications) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | non | Notifications push. Générer avec `npx web-push generate-vapid-keys`. Sans ces clés, seules les alertes « page ouverte » fonctionnent. |
| `SMTP_URL` ou `RESEND_API_KEY`, `MAIL_FROM` | non | E-mails (mot de passe oublié, invitations d'équipe). Sans fournisseur, les e-mails s'affichent dans la console en développement. |
| `TRUSTED_PROXY_HOPS` | non | Nombre de proxys de confiance devant l'app (défaut 1) pour lire l'IP réelle du client (rate limiting). |
| `TRUST_X_REAL_IP` | non | `1` pour lire `X-Real-IP` — seulement si le proxy l'écrase toujours (sinon falsifiable). |
| `LEGAL_COMPANY_NAME`, `LEGAL_CONTACT_EMAIL`, `LEGAL_ADDRESS`, `CNDP_DECLARATION` | **oui en prod** | Éditeur, contact, adresse et n° de déclaration CNDP affichés dans `/privacy` et `/terms`. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` ou `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_WHATSAPP_FROM` | non | SMS / WhatsApp aux clients qui le demandent (« bientôt votre tour » puis appel), dans le quota mensuel de l'offre. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER` / `_PRO` / `_BUSINESS` | non | Abonnements en ligne (Checkout, portail client, webhook `/api/billing/webhook`). Sans Stripe, la page *Abonnement* propose de contacter l'équipe. |
| `SUPPORT_WHATSAPP`, `SUPPORT_EMAIL` | non | Contact affiché pour les offres « sur demande » (sans prix Stripe). |
| `ERROR_WEBHOOK_URL` | non | Alerte (Slack, Discord ou collecteur JSON) à chaque erreur serveur, une par minute au plus pour une même erreur ; les erreurs sont aussi journalisées en JSON en production. |
| `REDIS_URL` | si plusieurs instances | Redis partage entre instances le temps réel (instantanés de file), la limitation de débit et le dédoublonnage des notifications ; repli en mémoire s'il ne répond pas. |
| `RETENTION_SCHEDULER`, `CRON_SECRET` | non | Purge quotidienne des données expirées : planifiée dans le serveur Node par défaut ; en serverless, `RETENTION_SCHEDULER=off` et un cron sur `GET /api/cron/retention` (`Authorization: Bearer $CRON_SECRET`). |

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
- **Prisma** + **SQLite** (dev) / **PostgreSQL** (prod, migrations dans `prisma/postgres`)
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
- **Abonnements** : le propriétaire souscrit en ligne (Stripe Checkout) et gère son abonnement (moyen de paiement, factures, changement d'offre, résiliation) dans le portail Stripe. L'offre suit l'abonnement via le webhook (souscription relue chez Stripe, idempotent) : impayé en relance → offre conservée avec un bandeau d'alerte ; résiliation → offre gratuite. Stripe n'ouvre pas de compte marchand pour une société établie au Maroc : sans Stripe, chaque offre propose un contact (WhatsApp / e-mail) et le superadmin change l'offre (un connecteur CMI pourra suivre le même modèle).
- **SMS / WhatsApp** : proposés au client (case à cocher, numéro mobile requis) si l'organisation les a activés et que son offre inclut un quota (Pro 100, Business 500 par mois par défaut, modifiable par le superadmin). Deux messages au plus par ticket : « bientôt votre tour » puis premier appel — dédoublonnés en base, journalisés sans le numéro.
- **Équipe** : rôles `owner` (tout : équipe, facturation, organisation), `manager` (file, analytics, clients, réglages des agences) et `staff` (file uniquement). Invitations par lien à usage unique (7 jours), envoyé par e-mail si un fournisseur est configuré, sinon partageable (copie, WhatsApp).

## 🛡 Données personnelles (loi 09-08)

- **Information** : politique de confidentialité (`/privacy`) et conditions d'utilisation (`/terms`) dans les trois langues, liées depuis la page de prise de ticket, le ticket, la landing et la connexion. Les textes sont un modèle à faire valider par un juriste (éditeur, contact et n° CNDP viennent des variables `LEGAL_*`).
- **Consentement** : acceptation des conditions obligatoire à l'inscription et à l'acceptation d'une invitation (horodatée dans `User.termsAcceptedAt`).
- **Conservation** : chaque organisation choisit une durée (90, 180, 365 — par défaut — ou 730 jours). Chaque jour, les tickets plus anciens sont anonymisés, les commentaires effacés et les fiches clients inactives supprimées ; les journaux d'audit sont gardés au moins un an.
- **Droits des clients** : export JSON (droit d'accès) et suppression avec anonymisation des tickets (droit à l'effacement) depuis la page *Clients*.

## 🔐 Sécurité

- Le flux SSE public ne contient **ni prénom, ni téléphone, ni code de ticket** (le QR est affiché publiquement).
- Sessions revérifiées en base : révoquer un superadmin, supprimer un compte ou suspendre une organisation prend effet immédiatement.
- Rate limiting (connexion, inscription, tickets, réservations, annulations), en-têtes de sécurité, erreurs d'API sous forme de codes stables traduits côté client.

## 🌍 Vers la production

1. **PostgreSQL** (Neon, Supabase…) : voir « PostgreSQL (production) » ci-dessus — toutes les suites de tests de bout en bout passent aussi sur PostgreSQL.
2. **Plusieurs instances** : définir `REDIS_URL` (Upstash, Redis Cloud…) — le temps réel, la limitation de débit et le dédoublonnage des notifications sont alors partagés.
3. Secrets : `JWT_SECRET`, clés VAPID, `NEXT_PUBLIC_APP_URL` en HTTPS (obligatoire pour le push).
4. Supervision : brancher `/api/health` sur un moniteur (UptimeRobot, Better Stack) et `ERROR_WEBHOOK_URL` sur un canal d'alerte ; les journaux JSON peuvent alimenter n'importe quel collecteur.
5. Prochaines briques : alertes e-mail superadmin, paiement CMI (cartes marocaines).

Voir [AUDIT.md](AUDIT.md) pour l'audit complet et ce qui reste à faire.
