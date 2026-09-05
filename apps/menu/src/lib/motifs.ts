import { parseCategoryVisual } from '@evolyx/shared';

/**
 * Quel dessin pour un plat sans photo ?
 *
 * Un gérant qui met sa carte en ligne un dimanche soir n'a pas trente photos sous la main. La
 * moitié de ses plats arriveront sans image, et le menu affichait jusqu'ici un point gris à
 * leur place — la carte avait l'air inachevée alors qu'elle était complète.
 *
 * On déduit donc un motif du **nom du plat**, puis de celui de sa catégorie, puis de l'emoji
 * que le gérant a éventuellement posé sur la catégorie. Rien de tout cela n'est demandé au
 * gérant : il tape « Poisson braisé », il obtient un poisson.
 *
 * Deux règles gouvernent la table de mots-clés :
 *
 *  - **l'ingrédient l'emporte sur la cuisson.** « Poisson braisé » est un poisson, pas une
 *    grillade ; « braisé » ne décide qu'en dernier recours, quand rien d'autre n'a mordu ;
 *  - **le plat l'emporte sur l'ingrédient.** « Salade de poulet » est une salade. L'ordre du
 *    tableau ci-dessous *est* cette hiérarchie — le premier motif qui mord gagne, donc
 *    déplacer une ligne change le résultat.
 *
 * Et quand rien ne mord : un repli stable, tiré de l'identifiant du plat. Stable, parce qu'un
 * plat qui changerait de dessin à chaque rafraîchissement se remarquerait plus que le point
 * gris qu'on remplace.
 */

export type Motif =
  | 'grill'
  | 'poultry'
  | 'fish'
  | 'bowl'
  | 'soup'
  | 'salad'
  | 'pizza'
  | 'burger'
  | 'sandwich'
  | 'fries'
  | 'pasta'
  | 'dessert'
  | 'coffee'
  | 'cocktail'
  | 'bottle'
  | 'plate'
  | 'cloche';

/**
 * Le vocabulaire couvre le français, l'anglais et la carte camerounaise — un menu de Douala
 * parle de ndolé, d'eru et de folere bien avant de parler de « plat en sauce ».
 */
const KEYWORDS: ReadonlyArray<readonly [Motif, readonly string[]]> = [
  // ── Les pièges, jugés avant tout le reste ─────────────────────────────────
  // « Water fufu » est un féculent, pas une bouteille d'eau. Ces expressions gagnent
  // contre le mot isolé qu'elles contiennent ; toute nouvelle collision se règle ici,
  // pas en retirant le mot innocent de sa catégorie.
  ['bowl', ['fufu', 'foufou', 'water fufu']],

  // ── Boissons : les mots les plus tranchés, donc jugés en premier ──────────
  [
    'coffee',
    // Pas de « the » seul : sur une carte anglaise, « The Big Burger » deviendrait un thé.
    ['cafe', 'expresso', 'espresso', 'cappuccino', 'the vert', 'the noir', 'the glace', 'tea', 'infusion', 'tisane', 'chocolat chaud', 'lait'],
  ],
  [
    'cocktail',
    ['cocktail', 'aperitif', 'apero', 'mojito', 'punch', 'vin', 'wine', 'champagne', 'rouge', 'blanc sec', 'rose'],
  ],
  [
    'bottle',
    ['boisson', 'drink', 'soda', 'jus', 'juice', 'biere', 'beer', 'eau', 'water', 'coca', 'fanta', 'sprite', 'malta', 'folere', 'bissap', 'gingembre', 'ginger', 'smoothie', 'limonade', 'vin de palme'],
  ],

  // ── Sucré ─────────────────────────────────────────────────────────────────
  [
    'dessert',
    ['dessert', 'gateau', 'cake', 'tarte', 'crepe', 'beignet', 'puff', 'glace', 'ice cream', 'sorbet', 'mousse', 'flan', 'tiramisu', 'brownie', 'cookie', 'patisserie', 'sucre'],
  ],

  // ── Plats à silhouette propre ─────────────────────────────────────────────
  ['pizza', ['pizza', 'calzone', 'margherita', 'quatre fromages']],
  ['burger', ['burger', 'hamburger', 'cheeseburger']],
  ['sandwich', ['sandwich', 'shawarma', 'chawarma', 'wrap', 'tacos', 'taco', 'panini', 'croque', 'kebab', 'burrito', 'hot dog', 'baguette']],
  ['fries', ['frite', 'fries', 'chips', 'alloco', 'aloko', 'plantain', 'miondo', 'bobolo', 'accompagnement', 'side', 'igname', 'manioc', 'batons']],
  ['pasta', ['pate', 'pasta', 'spaghetti', 'nouille', 'noodle', 'lasagne', 'macaroni', 'tagliatelle', 'penne']],

  // ── Le plat prime sur l'ingrédient : « salade de poulet » est une salade ───
  ['salad', ['salade', 'salad', 'crudite', 'legume', 'vegetable', 'avocat', 'coleslaw']],
  ['soup', ['soupe', 'soup', 'bouillon', 'broth', 'potage', 'veloute', 'pepper soup', 'nkui', 'consomme']],

  // ── L'ingrédient prime sur la cuisson : « poisson braisé » est un poisson ──
  [
    'fish',
    ['poisson', 'fish', 'capitaine', 'maquereau', 'silure', 'machoiron', 'tilapia', 'crevette', 'shrimp', 'gambas', 'fruits de mer', 'seafood', 'crabe', 'calamar', 'saumon', 'thon', 'sole'],
  ],
  [
    'poultry',
    ['poulet', 'chicken', 'poulet dg', 'aile', 'wing', 'cuisse', 'pilon', 'dinde', 'turkey', 'canard', 'duck', 'pintade', 'volaille'],
  ],

  // ── Puis seulement la cuisson ─────────────────────────────────────────────
  [
    'grill',
    ['braise', 'grill', 'grillade', 'barbecue', 'bbq', 'brochette', 'soya', 'suya', 'roti', 'roast', 'steak', 'entrecote', 'viande', 'meat', 'boeuf', 'beef', 'porc', 'pork', 'mouton', 'agneau', 'lamb', 'chevre', 'cote', 'filet'],
  ],

  // ── Enfin le bol, qui ramasse tout ce qui se mange à la cuillère ───────────
  [
    'bowl',
    ['riz', 'rice', 'sauce', 'ndole', 'eru', 'okok', 'koki', 'mbongo', 'sanga', 'achu', 'taro', 'kondre', 'gombo', 'arachide', 'curry', 'ragout', 'mijote', 'haricot', 'bean', 'couscous', 'plat', 'menu', 'main'],
  ],
];

/**
 * Le jeu curé de `@evolyx/shared` vers nos motifs.
 *
 * Quand le gérant a choisi une icône dans le sélecteur, il a déjà dit ce que contient la
 * catégorie — c'est un signal plus sûr que n'importe quel mot-clé. Les clés purement
 * décoratives (`sun`, `star`, `heart`…) sont volontairement absentes : elles ne disent rien
 * du contenu, et il vaut mieux laisser le repli neutre jouer que dessiner une assiette au
 * hasard sous prétexte qu'une catégorie s'appelle « Coup de cœur ».
 */
const FROM_ICON: Readonly<Record<string, Motif>> = {
  flame: 'grill',
  beef: 'grill',
  ham: 'grill',
  drumstick: 'poultry',
  fish: 'fish',
  shell: 'fish',
  soup: 'soup',
  cookingPot: 'bowl',
  eggFried: 'bowl',
  wheat: 'bowl',
  nut: 'bowl',
  salad: 'salad',
  carrot: 'salad',
  leafyGreen: 'salad',
  sprout: 'salad',
  vegan: 'salad',
  pizza: 'pizza',
  hamburger: 'burger',
  sandwich: 'sandwich',
  popcorn: 'fries',
  apple: 'dessert',
  banana: 'dessert',
  grape: 'dessert',
  cherry: 'dessert',
  cakeSlice: 'dessert',
  cake: 'dessert',
  iceCreamCone: 'dessert',
  cookie: 'dessert',
  dessert: 'dessert',
  croissant: 'dessert',
  candy: 'dessert',
  coffee: 'coffee',
  milk: 'coffee',
  citrus: 'bottle',
  cupSoda: 'bottle',
  glassWater: 'bottle',
  beer: 'bottle',
  wine: 'cocktail',
  martini: 'cocktail',
  utensils: 'plate',
  utensilsCrossed: 'plate',
  chefHat: 'cloche',
};

/** Les emojis que les gérants posent réellement sur leurs catégories. */
const EMOJI: Readonly<Record<string, Motif>> = {
  '🍕': 'pizza',
  '🍔': 'burger',
  '🍟': 'fries',
  '🍗': 'poultry',
  '🍖': 'poultry',
  '🐓': 'poultry',
  '🐟': 'fish',
  '🐠': 'fish',
  '🦐': 'fish',
  '🦀': 'fish',
  '🥗': 'salad',
  '🥬': 'salad',
  '🍜': 'soup',
  '🍲': 'soup',
  '🥣': 'soup',
  '🍚': 'bowl',
  '🍛': 'bowl',
  '🍝': 'pasta',
  '🥪': 'sandwich',
  '🌮': 'sandwich',
  '🌯': 'sandwich',
  '🍰': 'dessert',
  '🎂': 'dessert',
  '🍮': 'dessert',
  '🍦': 'dessert',
  '🍩': 'dessert',
  '☕': 'coffee',
  '🍵': 'coffee',
  '🍹': 'cocktail',
  '🍸': 'cocktail',
  '🍷': 'cocktail',
  '🥂': 'cocktail',
  '🥤': 'bottle',
  '🍺': 'bottle',
  '🍻': 'bottle',
  '🍾': 'bottle',
  '💧': 'bottle',
  '🔥': 'grill',
  '🥩': 'grill',
  '🍽': 'plate',
};

/** Repli : trois motifs neutres, qui ne prétendent rien sur le contenu de l'assiette. */
const NEUTRAL: readonly Motif[] = ['plate', 'cloche', 'bowl'];

/**
 * Minuscules, accents retirés, ponctuation ramenée à des espaces — et une espace de garde à
 * chaque bout, pour que le premier et le dernier mot se comparent comme les autres.
 */
function normalise(value: string): string {
  return ` ${value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

/**
 * Mot entier, pluriel toléré.
 *
 * La comparaison se fait sur ` mot `, ` mots ` ou ` motes ` — jamais sur un simple `includes`
 * de sous-chaîne, sans quoi « vin » mordrait sur « vinaigrette » et rangerait une salade
 * parmi les cocktails.
 */
function match(haystack: string): Motif | null {
  for (const [motif, words] of KEYWORDS) {
    for (const word of words) {
      const stem = normalise(word).slice(0, -1);
      if (
        haystack.includes(`${stem} `) ||
        haystack.includes(`${stem}s `) ||
        haystack.includes(`${stem}es `)
      ) {
        return motif;
      }
    }
  }
  return null;
}

/** Somme déterministe : le même plat garde son dessin d'un chargement à l'autre. */
function pick(seed: string): Motif {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return NEUTRAL[Math.abs(hash) % NEUTRAL.length]!;
}

/**
 * Le visuel de catégorie n'est pas une chaîne libre : il est préfixé (`icon:fish`,
 * `emoji:🐟`), et une chaîne nue est un emoji de l'ancien format. On passe donc par
 * `parseCategoryVisual` plutôt que de lire le champ tel quel — le lire brut ne ferait
 * jamais mordre la table, en silence.
 *
 * Une photo de catégorie ne dit rien : dans ce cas on retombe sur les mots.
 */
function fromCategoryVisual(icon: string | null | undefined): Motif | null {
  const visual = parseCategoryVisual(icon, null);
  if (visual.kind === 'icon') return FROM_ICON[visual.icon] ?? null;
  if (visual.kind === 'emoji') return EMOJI[visual.emoji.trim()] ?? null;
  return null;
}

export function motifFor(input: {
  id: string;
  name: string;
  categoryName?: string;
  categoryIcon?: string | null;
}): Motif {
  return (
    match(normalise(input.name)) ??
    (input.categoryName ? match(normalise(input.categoryName)) : null) ??
    fromCategoryVisual(input.categoryIcon) ??
    pick(input.id)
  );
}
