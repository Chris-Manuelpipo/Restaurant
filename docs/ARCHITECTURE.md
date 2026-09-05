# Architecture — décisions et raisons

Ce document explique **pourquoi** le code est ainsi. Le *quoi* se lit dans le code ; ce qui se
perd, c'est le raisonnement.

---

## 1. L'isolation multi-tenant est appliquée par la couche d'accès, pas par les handlers

**La décision.** Une extension Prisma (`apps/api/src/db/client.ts`) intercepte chaque opération sur
chaque modèle et injecte `restaurantId` dans le `where`, à partir d'un contexte propagé par
`AsyncLocalStorage`. Aucun handler n'écrit ce filtre.

**Pourquoi.** L'alternative — un `where: { restaurantId }` répété dans chaque requête — fonctionne
tant que personne ne l'oublie. Or elle est répétée des centaines de fois, et il suffit d'un oubli
pour qu'un restaurant voie la carte du voisin. En la déplaçant dans la couche d'accès, l'oubli
devient impossible : un handler n'a pas les moyens de contourner l'extension, puisque c'est elle
qui lui fournit le client.

**Ce que ça implique.**

- Trois modes explicites, et trois seulement : `tenant`, `platform`, `system`. Hors de ces
  contextes, toute requête **lève** — jamais de repli silencieux sur « toute la base ».
- Les entités filles (variantes, suppléments, images) sont filtrées par leur parent. Leurs
  opérations par identifiant seul sont **refusées** : un `update` sur un id nu n'offre aucune prise
  pour vérifier l'appartenance. Le code passe par une écriture imbriquée ou par `updateMany`.
- Une tentative de traversée renvoie « introuvable », jamais « interdit » : un 403 confirmerait
  l'existence de la donnée.
- Les requêtes Prisma étant paresseuses, `asTenant()` **attend** à l'intérieur du contexte. Ce
  `await` n'est pas décoratif : sans lui, le `then` partirait hors du store.

**Le test qui compte.** `tests/integration/tenant-isolation.test.ts` tente lecture, écriture, mise à
jour, suppression et déplacement croisés entre deux restaurants voisins, en connaissant les
identifiants exacts. Vingt-six cas. C'est le test à ne jamais laisser rougir.

---

## 2. La modularité se règle par une liste, jamais par une branche

**La décision.** Chaque restaurant porte `enabledModules: String[]`. La navigation du back-office,
les capacités renvoyées par `/auth/me` et les endpoints disponibles s'en déduisent. Une capacité
peut exiger un module (`access_points:*` exige `menu_qr`).

**Pourquoi.** Un fork par client se paie deux ans plus tard, quand il faut corriger le même bug dans
sept copies. Une liste d'activation garde une base de code unique et rend la différence entre deux
clients lisible en une requête SQL.

**Ce que ça implique.** La plateforme **refuse** d'activer un module non livré : mieux vaut un
message clair qu'une entrée de menu qui mène à un écran vide. Le jour où le module Commande
existera, l'activer sera une case à cocher.

---

## 3. Les permissions sont une matrice, pas des `if`

**La décision.** `domain/permissions.ts` déclare `Record<Capability, Role[]>`. Les handlers exigent
une **capacité** (`app.requires('menu:write')`), jamais un rôle.

**Pourquoi.** Un `if (role === 'ADMIN')` dispersé dans quarante handlers ne se relit pas, ne se
teste pas d'un bloc, et diverge dès qu'on ajoute un rôle. La matrice se lit d'un coup d'œil, et un
seul test la vérifie pour les quatre rôles et les treize capacités.

Le front lit la **même** matrice via `/auth/me` : il masque ce que l'API refuserait. Masquer sans
refuser serait une faille ; refuser sans masquer serait une mauvaise interface.

---

## 4. Le bus d'événements existe avant ses abonnés

**La décision.** `events/bus.ts` publie `menu_item.updated`, `menu_item.status_changed`,
`restaurant.updated`, `access_point.revoked`… Au lot 1, les seuls abonnés sont l'invalidation du
cache du menu public et — au plus près de l'action — le journal d'audit.

**Pourquoi.** C'est le point d'accroche des modules suivants. Le module Cuisine devra savoir qu'un
plat est passé épuisé ; la Caisse, qu'un prix a changé. Si le bus n'existait pas maintenant, ces
modules iraient chercher l'information en appelant le socle, et le socle finirait par les connaître
— exactement ce qu'on veut éviter.

Un abonné qui échoue ne fait jamais échouer la requête qui a publié. Marquer un plat épuisé en
plein service doit aboutir, même si un abonné est en panne.

---

## 5. La charte se dérive, elle ne se saisit pas

**La décision.** `deriveTheme(primary, background)` produit les treize variables CSS. Fonction
**pure**, dans `packages/shared`, exécutée à l'identique par le menu client, le back-office et le
serveur (rendu des PDF).

**Pourquoi.** Demander douze couleurs à un restaurateur, c'est obtenir douze couleurs qui jurent.
En demander deux et dériver le reste garantit une cohérence que la plupart des gérants n'auraient
pas le temps d'obtenir à la main.

Le partage de la fonction n'est pas une élégance : c'est ce qui fait que l'aperçu du back-office,
le menu réel et le PDF imprimé montrent la **même** couleur. Trois implémentations dériveraient.

**L'interface avertit, elle ne bloque pas.** Sous 4,5:1, un avertissement s'affiche avec le ratio
mesuré. La charte appartient au restaurant : on dit ce qu'on voit, le gérant tranche.

---

## 6. Les codes QR sont immuables — et la base le sait

**La décision.** `AccessPoint.code` : six caractères d'un alphabet sans ambiguïté (ni I, ni L, ni O,
ni 0, ni 1), tirés de `crypto`, uniques sur toute la plateforme. Un trigger PostgreSQL refuse toute
modification de cette colonne.

**Pourquoi.** Le code est collé sous une table, plastifié. Le régénérer signifie une réimpression et
une soirée à ramper sous les tables. Toute la variabilité se résout donc côté serveur :
`/public/q/:code` redirige vers le menu courant, quel que soit le nom du restaurant, son domaine ou
la table à laquelle le code est affecté.

Le trigger n'est pas de la ceinture et bretelles : le code applicatif peut changer, la promesse
faite au restaurateur, non.

**Réaffecter la table 3 vers la table 7** revient à modifier un libellé. Le carton reste valable.

**Un code révoqué renvoie 404**, comme un code inconnu : on ne renseigne pas un curieux sur ce qui
a existé.

---

## 7. Rien ne se supprime

**La décision.** `archivedAt` partout. `DELETE /menu-items/:id` archive.

**Pourquoi.** Les commandes que le module suivant écrira référenceront ces plats. Un plat supprimé
transformerait une addition de l'an dernier en ligne orpheline. Seules les **règles** de
disponibilité se suppriment vraiment : elles décrivent un comportement présent, pas un fait passé.

---

## 8. Une seule requête peint le menu client

**La décision.** `GET /public/r/:slug/menu` renvoie charte, infos, horaires, état d'ouverture,
catégories, plats, variantes, promotions et bandeau du moment — textes **déjà résolus** dans la
langue demandée.

**Pourquoi.** Sur une connexion lente, chaque aller-retour coûte une seconde. Et envoyer des objets
de traduction que le téléphone devrait trier, c'est faire payer au client des octets qu'il ne lira
jamais.

Le cache est à deux étages : trente secondes en mémoire côté serveur, soixante secondes annoncées
au navigateur avec `stale-while-revalidate`. Un événement métier vide le cache serveur
immédiatement — un plat marqué épuisé se voit avant l'expiration du TTL.

---

## 9. Le stockage est derrière une interface

**La décision.** `StorageAdapter` expose `put`, `get`, `delete`, `deletePrefix`, `url`, `exists`.
Le code métier ne connaît que des **clés opaques**, jamais un chemin de disque ni une URL.

**Pourquoi.** Le lot 1 tourne sur un VPS unique ; la suite tournera peut-être sur S3. La bascule
doit être une classe à écrire, pas une migration de base — les URL sont calculées à la lecture, pas
stockées.

Les clés portent le hachage du contenu : deux envois du même fichier ne dupliquent rien, et l'URL
peut se mettre en cache un an, puisqu'elle change avec le contenu.

---

## 10. Le domaine est pur, et écrit en premier

**La décision.** `apps/api/src/domain/` ne fait aucune entrée-sortie : visibilité, ouverture,
bandeau, import, codes, permissions. Tout y prend ses entrées en paramètre — y compris l'instant
courant.

**Pourquoi.** Ce sont les règles qui coûteront cher à corriger. Les rendre pures les rend testables
sans base, sans serveur, sans horloge : 94 tests unitaires, 98 % de couverture, une seconde
d'exécution. Un `new Date()` caché à l'intérieur aurait rendu intestable le passage de minuit.

C'est aussi ce qui permet le paramètre `at` : prévisualiser « dimanche à 11 h » passe par
exactement le même code que dimanche prochain à 11 h.

---

## 11. Le menu client est une application séparée

**La décision.** `apps/menu` ne partage avec `apps/admin` que `packages/shared`. Aucun composant,
aucune dépendance de back-office.

**Pourquoi.** Le poids du menu conditionne l'expérience du client final, sur un forfait de données
payé au mégaoctet. Le back-office, lui, s'ouvre une fois le matin. Les mélanger ferait payer au
client les formulaires du gérant.

Le budget est **mesuré** par un script, pas espéré : 220 Ko transférés sur 300 autorisés. Voir
[`PERFORMANCE.md`](PERFORMANCE.md).

---

## 12. Deux écarts assumés au cahier des charges

**Le prix XOR variantes est tenu par des triggers différés, pas par un `CHECK`.** L'invariant porte
sur deux tables ; un `CHECK` ne peut pas faire de sous-requête. Des `CONSTRAINT TRIGGER
DEFERRABLE INITIALLY DEFERRED` évaluent la règle au `COMMIT`, ce qui laisse Prisma insérer un plat
puis ses variantes dans la même transaction.

**La traduction serveur passe par i18next, mais les phrases sont embarquées.** Le cahier impose
i18next ; les chaînes serveur sont une vingtaine, et un chargement de fichiers ajouterait une
dépendance au démarrage sans rien apporter. Les fonctions du domaine acceptent un traducteur en
paramètre : elles restent testables avec un traducteur espion.
