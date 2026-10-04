# Audit complet — Daourak (دورك)

> Date : 24/09/2026 · Périmètre : tout le dépôt (`src/`, `prisma/`, `messages/`, config, dépendances)
> Méthode : lecture intégrale du code, `tsc --noEmit`, `next build`, `npm audit`, vérification des flux (QR → ticket → suivi → dashboard → TV → admin).
>
> Légende sévérité : 🔴 critique · 🟠 majeur · 🟡 mineur · 🟢 amélioration/fonctionnalité
> Statut : ✅ corrigé — **tous les points sont traités** (1re passe : sécurité, bugs, dette, F1–F9 ; 2e passe : F10–F16 et recommandations de production, voir § 8)

---

## 1. Synthèse

L'application fonctionne (build et typage OK) et le cœur produit est bien pensé (QR → ticket virtuel → suivi temps réel SSE → TV → analytics). Mais elle **n'est pas prête pour la production** :

1. **Faille critique** : n'importe quel client qui scanne le QR peut lire les prénoms de toute la file et **annuler les tickets de tous les autres clients**.
2. **Authentification fragile** : secret JWT par défaut codé en dur, sessions non révocables (superadmin révoqué ou organisation suspendue gardent l'accès 30 jours), pages admin sans contrôle propre.
3. **Bugs métier** : surbooking des rendez-vous, fuseau horaire du serveur utilisé partout (numérotation/créneaux décalés en prod), numéros de ticket en double possibles, langue perdue à chaque navigation.
4. **Monétisation inopérante** : les limites de plans (free/starter/pro/business) sont éditables par le superadmin mais **jamais appliquées** ; impossible de changer le plan d'une organisation.
5. **Dette** : ~3 500 lignes dupliquées mortes, i18n à ~40 %, 26 Mo d'images non optimisées, aucun test.

---

## 2. Sécurité

| ID | Sév. | Problème | Fichiers | Statut |
|----|------|----------|----------|--------|
| S1 | 🔴 | Le flux SSE public `/api/stream/branch/[qrToken]` (qrToken imprimé sur l'affiche) renvoie **prénom + `publicCode` de chaque ticket**. Avec un `publicCode`, `/api/stream/ticket/[publicCode]` renvoie le `cancelToken` → `POST /api/tickets/cancel/[token]`. Tout visiteur peut vider la file et lire les données personnelles. Le dashboard utilise ce même flux public. | `api/stream/branch`, `api/stream/ticket`, `lib/queue.ts` | ✅ |
| S2 | 🔴 | Secret JWT de repli codé en dur (`'dev-secret-change-me…'`) : si `JWT_SECRET` manque en prod, n'importe qui forge un jeton superadmin. `.env` est versionné dans git. | `lib/auth.ts:4`, `.env` | ✅ |
| S3 | 🔴 | Sessions JWT 30 j jamais revérifiées : un superadmin révoqué garde tous les droits ; une organisation suspendue continue de fonctionner ; un utilisateur supprimé reste connecté. | `lib/auth.ts`, `lib/admin-guard.ts` | ✅ |
| S4 | 🟠 | Pages `/admin`, `/admin/orgs`, `/admin/audit` sans contrôle d'accès propre (seul le layout vérifie — Next.js recommande de contrôler au plus près des données). Pages dashboard : `where: { orgId: session.orgId ?? undefined }` → Prisma ignore le filtre → données de la 1re organisation venue. | `app/[locale]/admin/*`, `app/[locale]/dashboard/*` | ✅ |
| S5 | 🔴 | `next@15.5.23` : vulnérabilités critiques (RCE Image Optimization, postcss, sharp). | `package.json` | ✅ |
| S6 | 🟠 | Aucun rate limiting : brute force du login, spam de tickets/RDV (un script peut remplir la file d'un commerce), création de comptes en masse. | `api/auth/*`, `api/tickets`, `api/appointments` | ✅ |
| S7 | 🟡 | `employeeId` accepté sans vérifier qu'il appartient à la même agence (référence inter-organisation). | `api/tickets/[id]` | ✅ |
| S8 | 🟡 | Aucun en-tête de sécurité (X-Frame-Options, nosniff, Referrer-Policy, HSTS). | `next.config.mjs` | ✅ |
| S9 | 🟡 | Fichiers de base SQLite (`dev.db-shm`, `dev.db-wal`) versionnés. | `.gitignore` | ✅ |

## 3. Bugs fonctionnels

| ID | Sév. | Problème | Fichiers | Statut |
|----|------|----------|----------|--------|
| B1 | 🔴 | **Surbooking** : les RDV sont créés en statut `scheduled` mais le calcul des créneaux et l'anti-doublon ne comptent que `waiting/called/in_progress` → tous les créneaux restent « disponibles ». Aucune validation serveur du créneau (heure d'ouverture, alignement, capacité, file fermée). | `api/appointments` | ✅ |
| B2 | 🟠 | **Fuseau horaire** : « aujourd'hui », la numérotation, les créneaux et les analytics utilisent le fuseau du **serveur** (UTC en prod) au lieu de `branch.timezone` (Africa/Casablanca) : numéros qui repartent à 1 à 1 h du matin, créneaux décalés d'une heure, heatmap faussée. Côté client, `toISOString().slice(0,10)` donne la veille entre minuit et 1 h. | `lib/queue.ts`, `api/appointments`, `analytics`, `booking-form` | ✅ |
| B3 | 🟠 | Numérotation non atomique (lecture du max puis écriture) : deux clients simultanés obtiennent le même numéro. | `lib/queue.ts:getNextTicketNumber` | ✅ |
| B4 | 🟠 | **Langue perdue** : `next/link` et `next/navigation` au lieu de la navigation next-intl. Un client sur `/fr/q/…` est renvoyé vers `/t/…` en arabe ; idem dashboard, login, admin. | tout `app/[locale]` | ✅ |
| B5 | 🟠 | Position erronée côté client : `position` = index dans la file incluant les tickets en cours ; « C'est votre tour ! » s'affiche alors que le ticket n'est pas appelé ; « Position » ≠ « Personnes avant vous ». La notif « plus que 2 » ne part que si le compteur vaut exactement 2. | `lib/queue.ts`, `client-ticket-view.tsx`, `live-ticket.tsx` | ✅ |
| B6 | 🟠 | Écran TV : « Total en file » plafonné à 6 ; un seul appel affiché ; voix toujours en français ; un `AudioContext` créé à chaque appel (fuite) ; son bloqué par l'autoplay. | `tv-screen.tsx` | ✅ |
| B7 | 🟡 | Dashboard : « Total aujourd'hui » = tickets actifs seulement ; « Attente moy. » = moyenne des ETA restants (pas l'attente réelle). | `live-dashboard.tsx` | ✅ |
| B8 | 🟡 | Transitions de statut libres (`done` → `waiting`…), compteurs fidélité jamais décrémentés ; tickets des jours précédents restés « en attente » à vie. | `api/tickets/[id]`, `lib/queue.ts` | ✅ |
| B9 | 🟡 | `Button asChild` ignoré → `<a>` imbriqué dans `<button>` (HTML invalide). | `ui/button.tsx` | ✅ |
| B10 | 🟡 | Compteur « personnes en file » de la page QR ignore les RDV du jour ; `/images/dawrok.jpg` inexistant ; `next/image` avec logo distant sans `remotePatterns`. | divers | ✅ |
| B11 | 🟡 | RDV promu : son ordre dépend de la date de *réservation* (incohérent). Règle explicite : un RDV arrivé à échéance passe en tête de file. | `lib/queue.ts` | ✅ |

## 4. Dette technique & qualité

| ID | Sév. | Problème | Statut |
|----|------|----------|--------|
| D1 | 🟠 | Arborescence dupliquée morte : `src/app/{admin,dashboard,login,poster,q,screen,t}` + `src/app/page.tsx` (le middleware réécrit tout vers `[locale]`) ; `/preview` = copie de la landing. ~3 500 lignes compilées pour rien. | ✅ |
| D2 | 🟠 | i18n incomplète : réglages, analytics, clients, QR, ticket client, prise de ticket, réservation, TV, admin, badges, erreurs API… en français codé en dur ; `toLocaleString('fr-FR')` ×17. | ✅ |
| D3 | 🟠 | Performance : 26 Mo de JPEG (1,4–2,5 Mo chacun) servis bruts sur la landing ; landing entièrement `'use client'` ; chaque connexion SSE reconstruit son propre snapshot toutes les 30 s (N clients × ~6 requêtes SQL). | ✅ |
| D4 | 🟡 | Duplication : `PLAN_DEFAULTS` ×2, `PLAN_PRICES` ×2 (le MRR ignore les prix configurés), types `Snapshot` ×2, `SECTORS` ×2, son « bip » ×2. | ✅ |
| D5 | 🟡 | Aucun test, pas d'ESLint (le script `next lint` est cassé et déprécié). | ✅ |
| D6 | 🟡 | `@types/react@18` avec React 19 ; `.clinerules` annonce Tailwind v4 (c'est la v3). | ✅ |
| D7 | 🟡 | `prompt()` natif pour la pause (non traduit, pénible sur mobile). | ✅ |
| D8 | 🟡 | Accessibilité : zoom bloqué (`userScalable: false`), boutons icônes sans libellé, drapeau 🇸🇦 pour la langue arabe (un drapeau désigne un pays, pas une langue). | ✅ |

## 5. Fonctionnalités à ajouter (par priorité)

| ID | Priorité | Fonctionnalité | Statut |
|----|----------|----------------|--------|
| F1 | P0 | **Application des plans** : limites succursales/employés/services, réservation, analytics, couleur de marque + changement de plan par le superadmin, MRR calculé sur les prix configurés. | ✅ |
| F2 | P0 | **Poste / guichet** : chaque appareil du staff choisit son poste ; l'appel assigne l'employé → la TV affiche « N° 012 → Guichet 2 ». | ✅ |
| F3 | P0 | **Rappeler** un client appelé (re-annonce TV + notif), **annuler** une action (toast « Annuler »), remettre un absent en file. | ✅ |
| F4 | P0 | **Ticket comptoir** : le staff crée un ticket pour un client sans smartphone. | ✅ |
| F5 | P0 | **Notifications push (Web Push + service worker)** : le client est prévenu même écran verrouillé (le SSE se coupe dès que l'onglet est masqué). Fait aussi de l'app une vraie PWA. | ✅ |
| F6 | P1 | **Horaires d'ouverture** éditables (le champ existait sans interface) : utilisés par la réservation et pour refuser les tickets hors horaires. | ✅ |
| F7 | P1 | **Multi-succursales** : création de succursale (dans la limite du plan) + sélecteur d'agence dans le dashboard (analytics, clients, QR, affiche suivent). | ✅ |
| F8 | P1 | Boîte de dialogue « Pause » (durées prédéfinies + motif). | ✅ |
| F9 | P1 | `/api/health` (supervision), pages 404 localisées. | ✅ |
| F10 | P1 | Réinitialisation de mot de passe par e-mail (nécessite un fournisseur : Resend/SMTP). |✅ |
| F11 | P1 | SMS / WhatsApp (Twilio ou WhatsApp Cloud API) pour les clients sans notif push. |✅ |
| F12 | P2 | Gestion d'équipe : les rôles `owner/manager/staff` existent en base mais ne sont jamais vérifiés ; invitations. |✅ |
| F13 | P2 | Upload de logo (`logoUrl` jamais renseigné). |✅ |
| F14 | P2 | Avis client après service (note 1–5) → satisfaction dans les analytics. |✅ |
| F15 | P2 | Paiement des abonnements (Stripe / CMI pour le Maroc). |✅ |
| F16 | P2 | Conformité loi 09-08 (CNDP) : politique de confidentialité, consentement, purge automatique des données clients. |✅ |

## 6. Recommandations production

| Recommandation | Statut |
|---|---|
| **Base** : PostgreSQL et migrations versionnées (au lieu de `db push`). | ✅ `prisma/postgres` (schéma généré + migrations), scripts `db:pg:*`, test d'alignement des schémas ; les 8 suites de bout en bout passent sur PostgreSQL 14. |
| **Temps réel multi-instance** : bus SSE et rate limiting en mémoire. | ✅ `REDIS_URL` : diffusion des instantanés, limitation de débit (script Lua) et dédoublonnage des notifications partagés ; repli immédiat en mémoire si Redis tombe. |
| **Secrets** : `JWT_SECRET` fort, clés VAPID, URL en HTTPS. | ✅ Le serveur refuse de démarrer en production avec un secret faible ; variables documentées (`.env.example`, README). |
| **Marketing** : chiffres de la landing invérifiables. | ✅ Remplacés par des faits produit ; logos de marques réelles masqués sur les photos. |
| **Supervision** : moniteur et outil d'erreurs. | ✅ `/api/health` (base + Redis), journaux JSON, alertes `ERROR_WEBHOOK_URL`. |
| **Déploiement** | ✅ `Dockerfile` (standalone, sans root, healthcheck) et `docker-compose` (PostgreSQL, Redis, migrations). |

Reste hors code, à la charge de l'éditeur : faire valider les textes légaux par un juriste et effectuer la déclaration CNDP (renseigner `LEGAL_*`, `CNDP_DECLARATION`) ; ouvrir les comptes Stripe (ou CMI), Twilio (modèles WhatsApp validés par Meta) et le fournisseur d'e-mails ; générer les clés VAPID.

---

## 7. Journal d'exécution (passe du 24/09/2026)

### Vérifications
| Contrôle | Avant | Après |
|---|---|---|
| `npm audit --omit=dev` | 3 vulnérabilités (1 critique) | **0** |
| `tsc --noEmit` | OK | **OK** |
| ESLint | non configuré | **0 problème** |
| Tests unitaires (Vitest) | aucun | **202 tests, 9 fichiers** |
| Tests de bout en bout (serveur de prod local, base isolée) | — | **69/69** (fuite de données, droits, 30 tickets simultanés sans doublon, double appel simultané, surbooking, limites d'offre, révocation/suspension immédiates, rendu des pages dans les 3 langues) |
| Poids des images de la landing | 26 Mo | **3,3 Mo** (+ `next/image` AVIF/WebP) |
| Clés de traduction | 165 par langue (UI à ~40 %) | **588 par langue, parité vérifiée par test** |

### Principaux changements
- **Sécurité** : `lib/auth.ts` + `lib/guards.ts` (session revérifiée en base, garde dans chaque page et route), flux SSE séparés (public anonymisé / dashboard authentifié), secret JWT obligatoire en prod, `.env` et fichiers SQLite retirés du suivi git (`.env.example` ajouté), rate limiting (`lib/rate-limit.ts`, IP lue derrière le proxy de confiance), en-têtes de sécurité, Next.js 15.5.26, `employeeId` validé, codes d'erreur API stables traduits côté client.
- **Métier** : fuseau de l'agence partout (`lib/time.ts`), numérotation atomique (`DailyCounter` + `UPDATE … RETURNING`), réservation réécrite (`lib/slots.ts` : horaires, chevauchements, capacité, validation serveur, garde anti-course), machine à états des tickets avec compteurs fidélité symétriques (`lib/ticket-status.ts`), clôture automatique des tickets des jours précédents, RDV échus en tête de file.
- **Temps réel** : un seul instantané par agence partagé par toutes les connexions (`QueueHub`), rafraîchi toutes les 30 s tant que quelqu'un écoute, maintenance limitée à une fois par minute et sans écriture inutile.
- **Fonctionnalités** : offres appliquées + changement d'offre superadmin + MRR sur prix configurés ; poste/guichet par appareil ; rappel ; « Annuler » sur chaque action ; ticket comptoir ; boîte de dialogue de pause ; horaires d'ouverture éditables ; multi-succursales (création + sélecteur) ; notifications Web Push (service worker, clés VAPID) ; écran TV multilingue avec QR ; page 404 localisée ; `/api/health` ; PWA installable (icônes PNG, manifeste).
- **Qualité** : ~3 500 lignes mortes supprimées (arbre non localisé, `/preview`), 100 % de l'interface traduite (FR/EN/AR, pluriels arabes), polices auto-hébergées (`next/font`), landing en composant serveur, accessibilité (zoom autorisé, libellés des boutons icônes, sélecteur de langue sans drapeaux).

### Relecture indépendante (après exécution)
Une relecture du code par un second agent a trouvé 9 points, tous corrigés et couverts par des tests :

| Sév. | Point | Correction |
|---|---|---|
| 🔴 | L'anti-doublon par téléphone renvoyait le code du ticket (ou du RDV) existant à quiconque connaissait le numéro → prénom visible et annulation possible. | Plus aucun ticket renvoyé par téléphone ; le navigateur du client mémorise son propre ticket (« Voir mon ticket »). |
| 🟠 | Navigateur déjà abonné au push : affiché « activé » sans être rattaché au nouveau ticket. | Réabonnement automatique au chargement de la page. |
| 🟠 | Deux guichets agissant en même temps sur un ticket : écrasement, visites comptées deux fois. | Écritures conditionnées au statut lu → 409 `ticket_conflict` pour le second. |
| 🟠 | Les limites d'offre comptaient les employés/prestations archivés. | Seules les ressources actives comptent ; contrôle à la réactivation. |
| 🟡 | `X-Real-IP` accepté sans condition (falsifiable). | Lu uniquement si `TRUST_X_REAL_IP=1`. |
| 🟡 | Flux SSE : mise à jour perdue entre l'état initial et l'abonnement, livraisons dans le désordre. | `followBranch` : abonnement d'abord, livraisons sérialisées et ordonnées. |
| 🟡 | Flux du dashboard maintenu après révocation ou suspension. | Droits revérifiés toutes les 60 s, flux fermé sinon. |
| 🟡 | Annuler « Démarrer »/« Terminé » renvoyait la notification « C'est votre tour ». | Déclenchement sur nouvel appel ou rappel uniquement. |
| 🟡 | Analytics : RDV comptés à l'heure de réservation. | Répartition à l'heure de passage. |

### À savoir
- Les **limites des offres sont désormais appliquées** : avec les valeurs par défaut, l'offre *Gratuit* n'a ni réservation ni analytics. Ajustez-les dans *Superadmin → Réglages → Offres & limites* si besoin.
- Pour la production : définir `JWT_SECRET` (le serveur refuse les sessions sinon) et, pour le push, les clés VAPID + HTTPS.
- Après mise à jour : `npm install` puis `npm run db:push` (nouvelles tables `DailyCounter`, `PushSubscription`, colonne `Ticket.recallCount`).
- ~~L'image `salon-coiffure.jpg` montre un logo de marque réelle (L'Oréal)~~ → traité lors de la 2e passe (enseigne et logos masqués).

---

## 8. Journal d'exécution — 2e passe (24/09/2026)

Tous les points restants (F10–F16, recommandations de production) ont été traités, un commit par thème :

| Commit | Thème |
|---|---|
| `d2b9e37` | F10 — mot de passe oublié (lien à usage unique 1 h), « Mon compte », révocation des sessions au changement de mot de passe |
| `f5e54d4` | F12 — rôles owner / manager / staff appliqués (API et pages), invitations par lien (7 jours) |
| `705e9f8`, `2dc9091` | F13 — logo (PNG/JPG/WebP, SVG refusé, 512 px WebP), stocké dans sa propre table |
| `37fef30` | F14 — avis client (1–5 étoiles, commentaire), satisfaction et note par employé dans les analytics, export CSV |
| `8cc4326` | F16 — loi 09-08 : `/privacy`, `/terms`, consentement horodaté, durée de conservation et purge quotidienne, export / effacement d'un client |
| `48a4528`, `20e2b79` | F11 — SMS / WhatsApp (Twilio) : consentement, « bientôt votre tour » + appel, quota par offre, dédoublonnage en base |
| `4467c6e` | Performance — seuls les messages des composants client sont envoyés au navigateur (page QR : 65 → 52 Ko) |
| `54003c5` | F15 — abonnements : Stripe Checkout, portail, webhook signé ; contact manuel sans Stripe (Maroc) |
| `236edcd` | Redis optionnel (plusieurs instances) |
| `d837dcf` | PostgreSQL + migrations |
| `a30273f` | Docker / docker compose |
| `6efc726` | Supervision des erreurs, refus de démarrer sans secret fort |
| `c9bfa6b` | vitest 4.1.11 (avis GHSA-82fw-gwwq-j7x9) |
| `8c89537` | Landing : chiffres invérifiables retirés, marques réelles masquées |

### Vérifications
| Contrôle | Résultat |
|---|---|
| `tsc --noEmit`, ESLint | OK, 0 problème |
| Tests unitaires (Vitest) | **261 tests, 22 fichiers** (phone, SMS/Twilio, facturation, rétention, Redis/Lua, diffusion multi-instance, supervision, i18n…) |
| Tests de bout en bout (serveur de production local, faux Twilio et faux Stripe) | **205 contrôles, 8 suites** : socle 69, auth 16, équipe 22, logo 8, avis 18, confidentialité 30, SMS 21, abonnements 21 |
| Même suites sur **PostgreSQL 14** et sur la **sortie standalone** (image Docker) | 205 / 205 |
| Redis configuré mais injoignable | socle 69 / 69, repli immédiat en mémoire |
| `npm audit` (dépendances de développement comprises) | **0 vulnérabilité** |

### Découvert et corrigé pendant la passe
- Le logo stocké dans `Organization` était chargé à chaque requête authentifiée → table `OrgLogo`.
- Tout le catalogue de traductions (textes légaux, e-mails, SMS…) était sérialisé dans chaque page.
- Arabe : « 09-08 » s'affichait « 08-09 » (algorithme bidirectionnel) → notation officielle « 09.08 ».
- Pages légales rendues à la demande : éditeur et n° CNDP lus à l'exécution (image Docker construite sans secrets).
- Redis injoignable : chaque requête attendait l'échec de la commande → repli immédiat tant que la connexion n'est pas prête.

### À savoir (2e passe)
- Après mise à jour : `npm install`, puis `npm run db:push` (SQLite) ou `npm run db:pg:migrate` (PostgreSQL) — nouvelles tables `Feedback`, `SmsMessage`, `OrgLogo`, `Invitation`, `PasswordResetToken` et colonnes (conservation, consentement, SMS, abonnement).
- Non vérifiable sur ce poste : la construction de l'image Docker (Docker absent ; la sortie standalone a été testée), un vrai Redis (testé avec ioredis-mock et en panne simulée), les vrais services Twilio et Stripe (testés contre des serveurs factices fidèles à leurs API).
- `enforceRateLimit` est désormais asynchrone : toujours l'appeler avec `await`.


### Après la mise en production (octobre 2026)
- **Heure du Maroc** : le Maroc est repassé à GMT de façon permanente le 20/09/2026 (décret n° 2.26.530, tzdata 2026c). Le Node du serveur (22.11, base de fuseaux de 2023) le croyait encore à GMT+1 : horaires d'ouverture, créneaux et changement de jour avançaient d'une heure. `lib/time.ts` calcule désormais en UTC à partir de cette date quand la base tz du moteur (Node ou navigateur) ignore la règle, et ne corrige rien sur un moteur à jour ; `/api/health` renvoie `localTime` et `tzCorrected`. Tests réécrits pour ne plus dépendre de la base tz du runtime.
- **Premier superadmin** : `npm run admin:create` (la production n'en avait aucun, et les données de démonstration ne doivent jamais y être chargées).
