# Modules — catalogue, dépendances, et comment ajouter le suivant

---

## 1. Le catalogue

| Clé | Module | État | Dépend de | Ce qu'il apporte |
|---|---|---|---|---|
| `core` | Socle | **livré** | — | Restaurant, charte, comptes, catalogue, journal |
| `menu_qr` | Menu QR | **livré** | `core` | Codes d'accès, menu client public, pack d'impression |
| `ordering` | Commande client | prévu | `core`, `menu_qr` | Panier, envoi depuis la table, suivi |
| `kitchen` | Cuisine | prévu | `ordering` | Écran de préparation, temps, priorités |
| `cashier` | Caisse | prévu | `ordering` | Addition, encaissement, remises |
| `delivery` | Livraison | prévu | `ordering` | Zones, frais, courses |
| `loyalty` | Fidélité | prévu | `ordering` | Points, récompenses |
| `invoicing` | Factures | prévu | `cashier` | Documents légaux, numérotation |

`IMPLEMENTED_MODULES` (dans `packages/shared/src/constants.ts`) fait foi : l'API **refuse**
d'activer un module qui n'y figure pas. Un module prévu mais non livré ne peut donc pas produire
une entrée de menu qui mène nulle part.

---

## 2. Les points d'accroche déjà posés

Le lot 1 ne construit aucun module aval, mais il a laissé six prises :

| Prise | Où | Ce qu'elle attend |
|---|---|---|
| Liste de modules | `Restaurant.enabledModules` | La navigation, les capacités et les endpoints s'en déduisent |
| Bus d'événements | `apps/api/src/events/bus.ts` | Les modules s'abonnent ; le socle ne les connaît pas |
| Point d'accès | `AccessPoint` | Le module Commande y rattachera la table d'origine |
| Remise | `AvailabilityRule.discountPercent` | Stockée et affichée ; la Caisse l'appliquera au calcul |
| Stockage | `StorageAdapter` | Bascule S3 sans migration de base |
| Journal | `AuditLog` | Traçabilité, dont les factures auront besoin |

Le code de la table voyage déjà jusqu'au client : `/public/q/:code` redirige avec `?t=CODE`, et le
menu l'affiche en pied de page. Le module Commande n'aura pas à inventer ce chemin.

---

## 3. Ajouter le module Commande — la marche à suivre

Voici la procédure exacte, dans l'ordre. Elle ne demande **aucune modification du socle**, sauf aux
deux endroits signalés.

### Étape 1 — déclarer le module

`packages/shared/src/constants.ts` :

```ts
export const IMPLEMENTED_MODULES: ModuleKey[] = [MODULES.CORE, MODULES.MENU_QR, MODULES.ORDERING];
```

C'est la seule ligne du socle à changer pour rendre le module activable.

### Étape 2 — le modèle

`apps/api/prisma/schema.prisma`. Respecter les trois règles du socle : `restaurantId` sur chaque
entité, montants entiers, rien ne se supprime.

```prisma
model Order {
  id            String      @id @default(cuid(2))
  restaurantId  String
  restaurant    Restaurant  @relation(fields: [restaurantId], references: [id], onDelete: Cascade)

  /// La table d'où vient la commande — la prise laissée par le lot 1.
  accessPointId String?
  accessPoint   AccessPoint? @relation(fields: [accessPointId], references: [id])

  status        OrderStatus @default(DRAFT)
  /// Somme figée à l'envoi : un prix qui change ensuite ne doit pas réécrire l'addition.
  totalAmount   Int
  customerName  String?
  customerPhone String?
  note          String?

  placedAt      DateTime?
  cancelledAt   DateTime?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  lines         OrderLine[]

  @@index([restaurantId, status])
  @@index([restaurantId, createdAt])
}

model OrderLine {
  id           String   @id @default(cuid(2))
  orderId      String
  order        Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  menuItemId   String
  /// Nom et prix **recopiés** : la ligne doit rester lisible même si le plat est archivé.
  nameSnapshot Json
  unitPrice    Int
  quantity     Int      @default(1)
  variantName  Json?
  supplements  Json     @default("[]")

  @@index([orderId])
}
```

Puis, dans `apps/api/src/db/client.ts`, ajouter `Order` à `TENANT_MODELS` et `OrderLine` à
`CHILD_MODELS` (`{ OrderLine: 'order' }`). **C'est le second et dernier point de contact avec le
socle** — sans lui, l'extension refuserait toute requête sur ces modèles, ce qui est exactement le
comportement voulu par défaut.

```bash
pnpm --filter @evolyx/api db:migrate:dev --name ordering
```

### Étape 3 — les capacités

`apps/api/src/domain/permissions.ts` :

```ts
ORDERS_READ:  'orders:read',
ORDERS_WRITE: 'orders:write',

[CAPABILITIES.ORDERS_READ]:  ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
[CAPABILITIES.ORDERS_WRITE]: ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],

// et dans MODULE_REQUIREMENTS :
[CAPABILITIES.ORDERS_READ]:  MODULES.ORDERING,
[CAPABILITIES.ORDERS_WRITE]: MODULES.ORDERING,
```

Le test de la matrice échouera tant que `ATTENDU` (dans `permissions.test.ts`) n'aura pas été mis à
jour : c'est voulu, une capacité ne s'ajoute pas sans qu'on décide qui l'obtient.

### Étape 4 — le domaine, avant toute interface

`apps/api/src/domain/order.ts`, pur, testé :

```ts
/** Une commande ne peut être envoyée que si chaque plat est visible et non épuisé à cet instant. */
export function canPlaceOrder(lines, menu, context): OrderCheck

/** Total figé : la somme des lignes telles qu'elles étaient au moment de l'envoi. */
export function computeTotal(lines): number
```

Écrire les tests d'abord. Le socle a montré la voie : `isItemVisible()` est déjà là, et
`canPlaceOrder` doit s'appuyer dessus plutôt que de redéfinir la visibilité.

### Étape 5 — les événements

`apps/api/src/events/bus.ts`, ajouter au type `DomainEvents` :

```ts
'order.placed':    { restaurantId: string; orderId: string; accessPointId?: string; total: number };
'order.cancelled': { restaurantId: string; orderId: string; reason?: string };
```

Et **s'abonner** aux événements du socle plutôt que d'interroger le socle :

```ts
bus.subscribe('menu_item.status_changed', ({ itemId, to }) => {
  if (to === 'SOLD_OUT') void flagDraftOrdersContaining(itemId);
});
```

C'est la règle de dépendance : le module connaît le socle, le socle ne connaît pas le module.

### Étape 6 — les routes

`apps/api/src/modules/orders/routes.ts`, sur le modèle des modules existants :

```ts
app.post('/', {
  onRequest: [app.requires(CAPABILITIES.ORDERS_WRITE)],
  schema: { tags: ['orders'], body: createOrderSchema },
}, scoped(async (request, reply, db) => { … }));
```

`scoped()` fournit le client déjà cloisonné : ne jamais écrire `where: { restaurantId }`.

Côté client final, la route publique de prise de commande vit dans `modules/public/` et doit
résoudre le restaurant par `resolvePublicRestaurant(slug)` — jamais en mode système ouvert.

Enregistrer le module dans `app.ts` :

```ts
await api.register(orderRoutes, { prefix: '/orders' });
```

### Étape 7 — les interfaces

- **Menu client** (`apps/menu`) : la feuille de détail gère déjà variantes et suppléments, et
  calcule le total. Il reste à remplacer « Commandez auprès de votre serveur » par un bouton
  d'ajout, et à ajouter un panier. Le code de la table est déjà dans l'URL (`?t=CODE`).
  **Surveiller le budget** : `node apps/menu/scripts/budget.mjs` doit rester sous 300 Ko.
- **Back-office** (`apps/admin`) : ajouter une entrée au tableau `NAV` de `AppShell.tsx`, avec
  `module: MODULES.ORDERING` et `capability: 'orders:read'`. La navigation s'ajustera seule pour
  les restaurants qui ont le module.

### Étape 8 — la recette

Ajouter `e2e/tests/parcours-c-commande.spec.ts` sur le modèle des deux existants : le client scanne,
commande, le gérant voit la commande arriver. Et vérifier que le test d'isolation reste vert —
un restaurant ne doit jamais voir les commandes d'un autre.

---

## 4. Ce qu'il ne faut pas faire

- **Ne pas faire dépendre le socle d'un module.** Si le socle a besoin de savoir qu'une commande
  existe, c'est qu'un événement manque.
- **Ne pas écrire `where: { restaurantId }` dans un handler.** L'extension s'en charge ; le faire à
  la main donne l'illusion que c'est optionnel ailleurs.
- **Ne pas recalculer un total à la lecture.** Il est figé à l'envoi : un prix qui change ne doit
  pas réécrire une addition passée.
- **Ne pas supprimer.** Une commande annulée porte `cancelledAt`.
- **Ne pas régénérer un code d'accès.** Jamais. Le trigger PostgreSQL refusera de toute façon.
