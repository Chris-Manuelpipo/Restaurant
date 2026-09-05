# Performance du menu client

Le menu s'ouvre sur un Android d'entrée de gamme, en salle, sur un forfait de données payé au
mégaoctet. Ce document donne les chiffres mesurés, la méthode, et l'écart qui subsiste.

---

## 1. Les chiffres

### Poids du premier chargement

```
node apps/menu/scripts/budget.mjs
```

| Fichier | Brut | Transféré (brotli) |
|---|---:|---:|
| `react.js` (React 19 + react-dom) | 189,1 Ko | **50,8 Ko** |
| `inter-latin-wght-normal.woff2` (corps) | 47,1 Ko | 47,1 Ko |
| `bricolage-…-latin-wght-normal.woff2` (titres) | 40,4 Ko | 40,4 Ko |
| `index.js` (l'application) | 36,2 Ko | 11,6 Ko |
| `vendor.js` (`@evolyx/shared`) | 52,7 Ko | 10,8 Ko |
| `workbox.js` | 22,2 Ko | 6,8 Ko |
| `style.css` | 23,3 Ko | 5,3 Ko |
| `sw.js` | 1,9 Ko | 0,9 Ko |
| **Premier chargement** | | **173,7 Ko** |

**Budget : 300 Ko — tenu, avec 126 Ko de marge.**

Les deux autres polices de titre (Fraunces et Lora, 72,7 Ko) sont dans `dist/` mais ne sont jamais
téléchargées par un client donné : un restaurant en choisit **une**, et la police système n'en
télécharge aucune. La mesure retient la plus lourde, pour rester du côté prudent.

### Temps de chargement

```
node e2e/scripts/measure.mjs
```

Conditions du cahier des charges : profil « Slow 4G » de Chrome DevTools (400 kb/s, 400 ms de
latence), processeur ralenti ×4, cache vide, médiane de trois passes, sur *Le Braisé du Carrefour*
(la carte la plus lourde des deux : photo de couverture, quatorze plats, trois photos de plats).

| Mesure | Valeur | Budget | |
|---|---:|---:|:--|
| Premier rendu (FCP) | **1,39 s** | — | |
| Plus grand contenu (LCP) | **2,79 s** | 2,50 s | **✗ +0,29 s** |
| Décalage cumulé (CLS) | **0,015** | 0,10 | ✓ |
| Transféré, images comprises | **178 Ko** | 300 Ko | ✓ |

---

## 2. Ce qui a été fait pour y arriver

Le LCP mesurait **5,83 s** sur la première version fonctionnelle. Cinq changements, chacun mesuré :

| Changement | LCP | Gain |
|---|---:|---:|
| Version initiale (TanStack Router + Query, i18next, couverture en fond CSS) | 5,83 s | — |
| Requête du menu lancée par le HTML, avant le JavaScript | 5,78 s | 0,05 s |
| Photo de couverture chargée dès la réponse, en parallèle du JavaScript | 3,50 s | **2,28 s** |
| Polices différées jusqu'à ce que le navigateur soit au repos | 3,51 s | ≈ 0 |
| TanStack Router et Query remplacés par 90 lignes propres au menu | 3,06 s | **0,45 s** |
| i18next remplacé par un dictionnaire local | 2,91 s | 0,15 s |
| Service worker enregistré après le chargement, couverture en 960 px | **2,79 s** | 0,12 s |

**Le gain décisif** est le troisième : la couverture, découverte seulement après le démarrage de
React, arrivait trois secondes trop tard et devenait à elle seule le « plus grand contenu » de la
page. La faire partir dès la réponse de l'API a coûté quinze lignes de script dans le HTML.

**Le différé des polices** ne change pas le LCP, mais retire 83 Ko de la concurrence pendant le
chargement : le transféré au moment du LCP passe de 194 à 110 Ko. Avec `font-display: swap`, le
texte reste lisible dès la première seconde.

---

## 3. L'écart qui subsiste, et pourquoi

**LCP mesuré : 2,79 s. Budget : 2,50 s. Écart : 0,29 s.**

Le plancher est arithmétique. À 400 kb/s, soit environ 51 Ko par seconde utiles :

```
  0,40 s   latence, requête du document
  0,03 s   HTML (1,4 Ko)
  0,40 s   latence, découverte du JavaScript
  1,50 s   React 19 + react-dom + application + CSS ≈ 79 Ko
  0,30 s   exécution du JavaScript, processeur ralenti ×4
  ───────
  2,63 s   avant que React n'ait peint quoi que ce soit
```

React 19 et react-dom pèsent **50,8 Ko transférés** et sont incompressibles : ils doivent être
téléchargés et exécutés avant le premier rendu applicatif. Le budget de 2,50 s suppose donc soit un
rendu côté serveur, soit une bibliothèque plus légère — deux options qui sortent de la stack
imposée au §3 du cahier des charges (React 19, Vite, sans SSR).

Ce qui a été fait pour approcher le budget malgré cela :

- **un pré-rendu dans le HTML** peint le nom, l'accroche, le logo et la couverture dès la réponse
  de l'API, vers 1,4 s — soit une seconde avant que React ne démarre. Le client voit donc la carte
  bien avant ce que le LCP mesure ; le LCP retient la peinture finale de React, mais l'expérience
  réelle commence à 1,4 s (c'est le FCP mesuré) ;
- **le CLS reste à 0,015**, dix fois sous le seuil : les deux rendus, celui du HTML et celui de
  React, partagent la même géométrie exacte.

### Pour aller au-delà

Trois voies, par ordre de rapport gain/coût, si le budget devait être tenu strictement :

1. **Rendu côté serveur du seul en-tête** (~0,8 s de gain estimé) : servir le menu depuis un petit
   serveur Node plutôt que depuis nginx, avec le bloc d'identité déjà écrit dans le HTML. Le
   pré-rendu actuel fait déjà la moitié du chemin, mais dépend d'un aller-retour API.
2. **Preact en remplacement de React** (~0,8 s) : 12 Ko au lieu de 50,8. Écart franc à la stack
   imposée, sans autre incidence sur le code — l'API de compatibilité couvre tout ce qu'utilise le
   menu.
3. **Découpage du bundle** (~0,2 s) : la feuille de détail d'un plat pourrait être chargée à la
   demande. Gain modeste, complexité réelle.

---

## 4. Ce qui est tenu par ailleurs

**Une seule requête peint la page.** `GET /public/r/:slug/menu` renvoie charte, infos, horaires,
état d'ouverture, catégories, plats, variantes, promotions et bandeau — textes déjà résolus dans la
langue demandée. Aucun appel en cascade.

**Images.** Trois largeurs (160 / 480 / 960) en WebP, plus un JPEG de repli, servies en `srcset`
avec `sizes`. Toutes portent `width` et `height` : c'est ce qui maintient le CLS à 0,015.
`loading="lazy"` partout sauf sur la couverture, seule image du premier écran.

**Hors ligne.** L'app shell est précachée par Workbox ; la réponse du menu suit une stratégie
« réseau d'abord, cache ensuite » avec un délai de quatre secondes. Un instantané est également
gardé en `localStorage`, pour le cas où le service worker n'a pas encore pris la main. Un bandeau
discret indique la date d'enregistrement — non pas d'après `navigator.onLine`, qui ne dit que
« une interface réseau est active » (le Wi-Fi d'un restaurant sans lien Internet y répond « oui »),
mais d'après l'âge réel de la réponse affichée.

**Accessibilité.** Vérifiée par `e2e/tests/accessibilite.spec.ts`, sur la page réelle et sur les
deux chartes : navigation clavier atteignant les plats avec un focus visible, ouverture par Entrée
et fermeture par Échap, cibles tactiles d'au moins 44 px, `prefers-reduced-motion` respecté,
contraste du texte au-dessus de 4,5:1, un seul `h1`, langue déclarée.

Cette suite a d'ailleurs trouvé un vrai défaut : le fond de secours codé dans le `<head>` — celui
qui évite l'écran blanc — l'emportait sur la charte, et une charte claire se retrouvait sur un
fond sombre partout où le menu ne couvrait pas l'écran.

---

## 5. Reproduire les mesures

```bash
# 1. Construire et servir le menu tel qu'il sera livré
pnpm --filter @evolyx/menu build
pnpm --filter @evolyx/menu preview

# 2. Poids du premier chargement
node apps/menu/scripts/budget.mjs

# 3. Temps de chargement, Slow 4G et processeur ×4
node e2e/scripts/measure.mjs
node e2e/scripts/measure.mjs http://localhost:5181/r/casa-lina   # l'autre charte
```

Les deux scripts échouent (code de sortie non nul) si un budget est dépassé : le premier tourne en
intégration continue, le second demande un Chrome et se lance à la main.

**Attention à la méthode.** Mesurer en mode développement n'a aucun sens : Vite y sert des modules
séparés, non minifiés, et le service worker est désactivé. Toutes les valeurs de ce document
proviennent du bundle de production, servi par `vite preview`, cache vide.
