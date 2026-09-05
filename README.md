# Evolyx Restaurant — lot 1

Un restaurant configure sa charte et son menu en dix minutes, imprime ses codes QR une fois pour
toutes, et ses clients consultent le menu à jour depuis leur téléphone — sans compte, sans
installation, et même sans réseau après une première visite.

Ce dépôt contient le **lot 1** : le socle (restaurant, charte, comptes, catalogue) et le module
**Menu QR** (codes, menu client public, pack d'impression).

---

## Démarrer en cinq minutes

### Avec Docker

```bash
cp .env.example .env          # puis remplacez les deux secrets JWT
docker compose up --build     # PostgreSQL + API + back-office + menu
docker compose run --rm api pnpm seed
```

| Service | Adresse |
|---|---|
| Menu client | http://localhost:5181/r/le-braise-du-carrefour |
| Back-office | http://localhost:5180 |
| API | http://localhost:3010 |
| Documentation OpenAPI | http://localhost:3010/docs |

### Sans Docker

Il faut Node 22 et un PostgreSQL 16 joignable.

```bash
corepack enable                            # active pnpm
cp .env.example .env                       # ajustez DATABASE_URL
pnpm install
createdb evolyx_restaurant                 # et evolyx_restaurant_test pour les tests

pnpm --filter @evolyx/shared build         # le package partagé, d'abord
pnpm --filter @evolyx/api db:generate
pnpm --filter @evolyx/api db:migrate
pnpm seed

pnpm dev                                   # API + back-office + menu, en parallèle
```

---

## Comptes de démonstration

Tous ces comptes partagent le mot de passe `MotDePasseDemo2026` (modifiable par `SEED_PASSWORD`).

| Compte | Rôle | Ce qu'il peut faire |
|---|---|---|
| `platform@evolyx.cm` | PLATFORM_ADMIN | Créer des restaurants, activer des modules, suspendre |
| `admin@lebraise.cm` | ADMIN | Tout sur Le Braisé du Carrefour, charte et comptes compris |
| `gerant@lebraise.cm` | MANAGER | La carte, les règles, les codes QR |
| `admin@casalina.cm` | ADMIN | Tout sur Casa Lina |
| `gerant@casalina.cm` | MANAGER | La carte, les règles, les codes QR |

Deux restaurants sont livrés, choisis pour éprouver des cas opposés :

- **Le Braisé du Carrefour** — charte sombre, serif, français seul, un plat épuisé, un poisson à
  trois tailles, 22 points d'accès ;
- **Casa Lina** — charte claire, sans-serif, français **et** anglais avec des traductions
  volontairement absentes, un brunch visible le dimanche de 10 h à 14 h, un happy hour du lundi
  au samedi de 17 h à 19 h, 25 tables.

---

## Commandes

| Commande | Effet |
|---|---|
| `pnpm dev` | Lance l'API, le back-office et le menu |
| `pnpm build` | Construit tout le monorepo |
| `pnpm typecheck` | Vérifie les types de bout en bout |
| `pnpm test` | Tests unitaires et d'intégration |
| `pnpm --filter @evolyx/api test:coverage` | Couverture du domaine (seuil 80 %) |
| `pnpm e2e` | Les deux parcours de recette et l'accessibilité, dans un vrai Chrome |
| `node e2e/scripts/measure.mjs` | Mesure le LCP en Slow 4G, processeur ×4 |
| `pnpm seed` | Remplit la base avec les deux restaurants |
| `pnpm db:reset` | Réinitialise la base et rejoue les migrations |
| `node apps/menu/scripts/budget.mjs` | Vérifie le budget de 300 Ko du menu client |

---

## Variables d'environnement

Tout est décrit dans [`.env.example`](.env.example). Les seules obligatoires :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL |
| `JWT_ACCESS_SECRET` | Signature des jetons d'accès — 32 caractères minimum |
| `JWT_REFRESH_SECRET` | Signature des jetons de rafraîchissement |
| `API_PUBLIC_URL` | Base des URL encodées dans les codes QR — **à ne plus changer** une fois des codes imprimés |
| `PUBLIC_MENU_URL` | Base des URL du menu client |
| `MENU_URL_MODE` | `path` (`/r/mon-resto`) ou `subdomain` (`mon-resto.evolyx.cm`) |

Régénérez les secrets pour toute installation réelle :

```bash
openssl rand -hex 48
```

---

## Ce qui est livré, et ce qui ne l'est pas

**Vérifié** — 235 tests automatisés :

| Suite | Tests | Ce qu'elle couvre |
|---|---:|---|
| `packages/shared` | 42 | Thème et contraste, i18n et repli, fuseaux et minuit, montants |
| `apps/api` — domaine | 94 | Visibilité (26 cas), ouverture, permissions, import, codes — 98 % de couverture |
| `apps/api` — intégration | 81 | Isolation croisée (26), endpoints et erreurs, rôles, limitation de débit, images |
| `e2e` | 18 | Les deux parcours de recette et l'accessibilité, dans un vrai Chrome |

**Livré** — multi-tenant appliqué par la couche d'accès aux données, authentification et rôles,
identité et charte, catégories et plats, variantes, suppléments, photos, règles horaires,
promotions, codes QR immuables, pack PDF, menu client PWA, journal d'audit, espace plateforme,
OpenAPI.

**Prévu mais pas construit** — commande client, prise de commande serveur, écran cuisine, caisse,
paiement, livraison, fidélité, factures. Les points d'accroche existent : liste de modules par
restaurant, bus d'événements, `AccessPoint` prêt à porter une table, `discountPercent` sur les
promotions, `StorageAdapter` prêt pour S3. Voir [`docs/MODULES.md`](docs/MODULES.md) pour la marche
à suivre exacte, module par module.

---

## Documentation

| Document | Contenu |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | Arborescence, modèle de données, endpoints, ordre de construction |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Les décisions structurantes et leurs raisons |
| [`docs/MODULES.md`](docs/MODULES.md) | Catalogue des modules et ajout du module Commande |
| [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) | Budget du menu client, mesures et méthode |
| [`docs/maquettes/`](docs/maquettes/) | Les deux maquettes de référence |
