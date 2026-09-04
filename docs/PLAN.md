# PLAN — Lot 1 : Socle + Menu QR

> Rédigé après lecture des deux maquettes de `docs/maquettes/`. Sert de contrat interne :
> arborescence, modèle de données, endpoints, ordre de construction.

## 1. Ce que les maquettes imposent

**`01-menu-client.html`** — tout est piloté par les variables CSS de `deriveTheme()` : aucune couleur
en dur hors du thème. Structure retenue, dans l'ordre du DOM : bandeau hors-ligne → couverture +
sélecteur de langue → identité (logo, nom, tagline, pastille ouvert/fermé avec l'heure de bascule) →
bandeau du moment → navigation de catégories collante → sections → cartes de plat (vignette 92 px,
titre, description sur 2 lignes, prix ou « à partir de », étiquettes) → infos/horaires → feuille de
détail (variantes obligatoires en radio, suppléments facultatifs, allergènes). Les plats épuisés
restent en place, désaturés, prix barré. Une seule requête alimente toute la page.

**`02-onboarding.html`** — trois colonnes : rail des 5 étapes (état fait/en cours/à venir), formulaire
au centre (660 px max), aperçu téléphone collant à droite avec bascule temporelle
« Maintenant / Dimanche 11h / Vendredi 21h ». L'aperçu applique la charte du restaurant, l'interface
garde l'identité Evolyx (ivoire, encre, vert forêt) — les deux ne se mélangent jamais. Le contraste
s'affiche en jauge et avertit sans bloquer. L'import de menu montre un aperçu ligne par ligne avec
les lignes non reconnues éditables sur place.

## 2. Arborescence

```
RESTAURANT/
├─ apps/
│  ├─ api/                    Fastify 5 · TypeScript strict
│  │  ├─ prisma/              schema.prisma, migrations, seed.ts
│  │  └─ src/
│  │     ├─ domain/           ← logique métier pure, testée, sans I/O
│  │     │  ├─ visibility.ts      isItemVisible, filterMenu
│  │     │  ├─ opening.ts         computeOpening (fuseau, minuit)
│  │     │  ├─ moment.ts          bandeau du moment
│  │     │  ├─ menu-import.ts     parseur « Nom – prix »
│  │     │  ├─ access-code.ts     alphabet non ambigu, génération
│  │     │  └─ permissions.ts     matrice déclarative
│  │     ├─ db/               client Prisma + extension multi-tenant
│  │     ├─ plugins/          auth, tenant, erreurs, logs, swagger
│  │     ├─ modules/          auth · restaurant · categories · menu-items
│  │     │                    availability-rules · access-points · users
│  │     │                    platform · public
│  │     ├─ services/         storage (StorageAdapter), images, qr, pdf, audit
│  │     ├─ events/           EventBus en mémoire
│  │     └─ tests/            unit · integration · fixtures
│  ├─ admin/                  React 19 · TanStack Router/Query · Tailwind v4
│  └─ menu/                   PWA client — bundle séparé, budget 300 Ko
├─ packages/
│  ├─ shared/                 Zod, types, deriveTheme, resolveI18n, constantes
│  └─ ui/                     composants admin (Button, Field, Sheet, …)
├─ docs/                      PLAN · ARCHITECTURE · MODULES · PERFORMANCE · maquettes
├─ e2e/                       Playwright — les deux parcours du §10
└─ docker-compose.yml
```

`packages/shared` ne dépend de rien (ni Prisma, ni React) : il est importé par l'API, l'admin, le
menu et les tests. C'est la condition pour que `deriveTheme()` et `resolveI18n()` produisent le même
résultat côté serveur (PDF, aperçus) et côté client.

## 3. Modèle de données

Fidèle au cahier des charges. Décisions prises là où il laissait le choix :

| Point | Décision |
|---|---|
| Identifiants | `cuid2` (25 car.) généré applicativement, `@id` texte |
| Montants | `Int`, en FCFA, jamais de décimale |
| i18n | `Json` `{fr, en}`, `fr` obligatoire, repli champ par champ |
| Horaires | `openTime`/`closeTime` en `String` `"HH:MM"` — pas de `Time` SQL, évite tout décalage de fuseau |
| Unicité jour | `@@unique([restaurantId, dayOfWeek])` sur `OpeningHours` |
| Code d'accès | `@unique` global sur `AccessPoint.code`, 6 caractères |
| Archivage | `archivedAt` nullable partout, jamais de `DELETE` SQL |
| Prix XOR | `basePrice` non nul **ou** ≥ 1 variante — vérifié par Zod **et** par contrainte `CHECK` |
| Suppression | `onDelete: Cascade` uniquement des enfants vers leur parent (variantes, images) |

Index posés : `(restaurantId, position)` sur `Category` et `MenuItem`, `(restaurantId, categoryId)`,
`(restaurantId, targetType, targetId)` sur `AvailabilityRule`, `(restaurantId, createdAt)` sur
`AuditLog`, `slug` unique sur `Restaurant`.

## 4. Isolation multi-tenant

Une extension Prisma `$extends({ query: { $allModels: { … } } })` intercepte **toutes** les
opérations sur les modèles portant `restaurantId` et injecte `where.restaurantId` depuis un
`AsyncLocalStorage` alimenté par le hook `onRequest` de Fastify. Trois modes :

- `tenant(id)` — mode normal, filtre imposé ;
- `platform()` — réservé au `PLATFORM_ADMIN`, aucun filtre, accès explicite ;
- `system()` — seeds, migrations, tâches internes.

Hors de ces trois contextes, toute requête sur un modèle tenant **lève** — pas de repli silencieux.
Le test d'isolation (`tests/integration/tenant-isolation.test.ts`) tente lecture, écriture, mise à
jour et suppression croisées sur les deux restaurants de seed et exige un 404 à chaque fois.

## 5. Endpoints

Préfixe `/api/v1`, erreurs `{ error: { code, message, details? } }` en français.

**Public** (sans cookie, cacheable) — `GET /public/q/:code` (302/404/410),
`GET /public/r/:slug/menu` (ETag, `max-age=60, stale-while-revalidate=600`, paramètre `at`),
`GET /public/r/:slug/info`.

**Authentifié** — `auth` (login/refresh/logout/me) · `restaurant` (GET/PATCH, logo, cover) ·
`categories` (CRUD + reorder) · `menu-items` (CRUD + status + reorder + images + import) ·
`availability-rules` (CRUD) · `access-points` (liste, création en lot, patch, revoke, pdf) ·
`users` (CRUD, ADMIN) · `platform/restaurants` (PLATFORM_ADMIN, + invite).

**Permissions** — une matrice `Record<Capability, Role[]>` dans `domain/permissions.ts`, appliquée
par un préhandler `requires('menu:write')`. Aucun `if (role === …)` dans les handlers.

**Événements** — `EventBus` en mémoire, typé, publiant `menu_item.updated`,
`menu_item.status_changed`, `restaurant.updated`, `access_point.revoked`. Abonnés du lot 1 :
invalidation du cache du menu public, écriture d'`AuditLog`.

## 6. Ordre de construction

1. Monorepo, Docker, CI, `packages/shared` vide mais câblé
2. Schéma Prisma + migration + extension multi-tenant + **son test**
3. Domaine pur avec ses tests : visibilité, ouverture, thème, i18n, import, codes, permissions
4. Auth (Argon2id, JWT 15 min + refresh 7 j httpOnly), plugins Fastify, gestion d'erreurs
5. API socle : restaurant, catégories, plats, règles, images (Sharp + StorageAdapter)
6. API Menu QR : points d'accès, QR (correction H, luminance), PDF A6/A4, endpoints publics
7. `apps/menu` d'après la maquette 1, PWA Workbox, budget mesuré
8. `apps/admin` : onboarding d'après la maquette 2, puis gestion du quotidien
9. Seeds des deux restaurants, E2E Playwright, `PERFORMANCE.md`, `ARCHITECTURE.md`, `MODULES.md`

Le domaine est écrit **avant** toute interface : c'est lui qui coûtera cher à corriger plus tard.

## 7. Points d'accroche laissés aux modules suivants

Prévus, non implémentés : `enabledModules` sur `Restaurant` (la navigation et les endpoints s'en
déduisent), `EventBus` (les modules aval s'y abonnent), `AccessPoint` (le module Commande y
rattachera la table), `AvailabilityRule.discountPercent` (exploité par la Caisse),
`StorageAdapter` (bascule S3), `AuditLog` (traçabilité légale des factures).
