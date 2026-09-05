/**
 * Emojis proposés dans le sélecteur.
 *
 * Une liste **curée**, pas les trois mille du standard : un restaurateur cherche « poulet »,
 * pas un drapeau letton. Chaque entrée porte ses mots-clés en français — c'est ce qui rend la
 * recherche utile pour quelqu'un qui ne pense pas en anglais.
 */

export interface EmojiEntry {
  emoji: string;
  keywords: string;
  group: EmojiGroup;
}

export type EmojiGroup = 'plats' | 'produits' | 'boissons' | 'desserts' | 'repères';

export const EMOJI_GROUP_LABELS: Record<EmojiGroup, string> = {
  plats: 'Plats',
  produits: 'Produits',
  boissons: 'Boissons',
  desserts: 'Desserts',
  repères: 'Repères',
};

export const EMOJIS: EmojiEntry[] = [
  /* ── Plats ─────────────────────────────────────────────────────────────── */
  { emoji: '🔥', keywords: 'grillade braisé feu barbecue charbon brochette', group: 'plats' },
  { emoji: '🍗', keywords: 'poulet cuisse volaille braisé', group: 'plats' },
  { emoji: '🍖', keywords: 'viande côte porc bœuf os', group: 'plats' },
  { emoji: '🥩', keywords: 'steak viande bœuf brochette grillé', group: 'plats' },
  { emoji: '🥓', keywords: 'lard bacon porc charcuterie', group: 'plats' },
  { emoji: '🐟', keywords: 'poisson maquereau bar poisson braisé', group: 'plats' },
  { emoji: '🐠', keywords: 'poisson tropical mer', group: 'plats' },
  { emoji: '🦐', keywords: 'crevette gambas crustacé', group: 'plats' },
  { emoji: '🦀', keywords: 'crabe crustacé fruits de mer', group: 'plats' },
  { emoji: '🦑', keywords: 'calamar poulpe encornet', group: 'plats' },
  { emoji: '🍲', keywords: 'plat mijoté ragoût ndolè sauce marmite', group: 'plats' },
  { emoji: '🥘', keywords: 'plat paella mijoté sauce', group: 'plats' },
  { emoji: '🍛', keywords: 'riz curry sauce plat complet', group: 'plats' },
  { emoji: '🍝', keywords: 'pâtes spaghetti nouilles', group: 'plats' },
  { emoji: '🍜', keywords: 'nouilles soupe bouillon ramen', group: 'plats' },
  { emoji: '🥣', keywords: 'soupe bol potage', group: 'plats' },
  { emoji: '🥗', keywords: 'salade crudités légumes frais', group: 'plats' },
  { emoji: '🍕', keywords: 'pizza part italienne', group: 'plats' },
  { emoji: '🍔', keywords: 'burger hamburger sandwich', group: 'plats' },
  { emoji: '🌭', keywords: 'hot-dog saucisse', group: 'plats' },
  { emoji: '🥪', keywords: 'sandwich pain club', group: 'plats' },
  { emoji: '🌮', keywords: 'taco mexicain galette', group: 'plats' },
  { emoji: '🌯', keywords: 'wrap burrito shawarma', group: 'plats' },
  { emoji: '🥙', keywords: 'kebab pain pita chawarma', group: 'plats' },
  { emoji: '🍳', keywords: 'œuf omelette petit-déjeuner poêle', group: 'plats' },
  { emoji: '🍚', keywords: 'riz blanc accompagnement', group: 'plats' },
  { emoji: '🍟', keywords: 'frites patate accompagnement', group: 'plats' },
  { emoji: '🥟', keywords: 'beignet raviolis nem', group: 'plats' },

  /* ── Produits ──────────────────────────────────────────────────────────── */
  { emoji: '🍠', keywords: 'patate douce igname tubercule manioc', group: 'produits' },
  { emoji: '🥔', keywords: 'pomme de terre patate tubercule', group: 'produits' },
  { emoji: '🍌', keywords: 'banane plantain', group: 'produits' },
  { emoji: '🥑', keywords: 'avocat', group: 'produits' },
  { emoji: '🍅', keywords: 'tomate légume', group: 'produits' },
  { emoji: '🌶️', keywords: 'piment épicé pili-pili fort', group: 'produits' },
  { emoji: '🥕', keywords: 'carotte légume', group: 'produits' },
  { emoji: '🥬', keywords: 'légume vert feuille salade chou', group: 'produits' },
  { emoji: '🧅', keywords: 'oignon', group: 'produits' },
  { emoji: '🧄', keywords: 'ail', group: 'produits' },
  { emoji: '🥜', keywords: 'arachide cacahuète noix', group: 'produits' },
  { emoji: '🌽', keywords: 'maïs épi', group: 'produits' },
  { emoji: '🍞', keywords: 'pain baguette boulangerie', group: 'produits' },
  { emoji: '🧀', keywords: 'fromage', group: 'produits' },
  { emoji: '🥚', keywords: 'œuf', group: 'produits' },
  { emoji: '🍍', keywords: 'ananas fruit', group: 'produits' },
  { emoji: '🥭', keywords: 'mangue fruit', group: 'produits' },
  { emoji: '🍉', keywords: 'pastèque melon fruit', group: 'produits' },
  { emoji: '🍊', keywords: 'orange agrume fruit', group: 'produits' },
  { emoji: '🍋', keywords: 'citron agrume', group: 'produits' },
  { emoji: '🥥', keywords: 'noix de coco', group: 'produits' },

  /* ── Boissons ──────────────────────────────────────────────────────────── */
  { emoji: '🥤', keywords: 'boisson soda gobelet rafraîchissement', group: 'boissons' },
  { emoji: '🧃', keywords: 'jus brique boisson fruit', group: 'boissons' },
  { emoji: '🧊', keywords: 'glaçon frais froid', group: 'boissons' },
  { emoji: '💧', keywords: 'eau minérale bouteille', group: 'boissons' },
  { emoji: '☕', keywords: 'café expresso chaud thé', group: 'boissons' },
  { emoji: '🍵', keywords: 'thé infusion tisane chaud', group: 'boissons' },
  { emoji: '🍺', keywords: 'bière chope blonde', group: 'boissons' },
  { emoji: '🍻', keywords: 'bières trinquer apéritif', group: 'boissons' },
  { emoji: '🍷', keywords: 'vin rouge verre', group: 'boissons' },
  { emoji: '🥂', keywords: 'champagne fête trinquer', group: 'boissons' },
  { emoji: '🍸', keywords: 'cocktail martini apéritif', group: 'boissons' },
  { emoji: '🍹', keywords: 'cocktail tropical jus punch', group: 'boissons' },
  { emoji: '🍶', keywords: 'carafe boisson locale', group: 'boissons' },
  { emoji: '🥛', keywords: 'lait yaourt laitage', group: 'boissons' },
  { emoji: '🫖', keywords: 'théière thé infusion', group: 'boissons' },

  /* ── Desserts ──────────────────────────────────────────────────────────── */
  { emoji: '🍰', keywords: 'gâteau part pâtisserie dessert', group: 'desserts' },
  { emoji: '🎂', keywords: 'gâteau anniversaire fête', group: 'desserts' },
  { emoji: '🧁', keywords: 'cupcake muffin pâtisserie', group: 'desserts' },
  { emoji: '🍦', keywords: 'glace crème glacée cornet', group: 'desserts' },
  { emoji: '🍨', keywords: 'glace coupe dessert', group: 'desserts' },
  { emoji: '🍮', keywords: 'flan crème caramel dessert', group: 'desserts' },
  { emoji: '🍪', keywords: 'biscuit cookie goûter', group: 'desserts' },
  { emoji: '🍩', keywords: 'beignet donut', group: 'desserts' },
  { emoji: '🥐', keywords: 'croissant viennoiserie petit-déjeuner', group: 'desserts' },
  { emoji: '🥞', keywords: 'pancake crêpe brunch', group: 'desserts' },
  { emoji: '🍫', keywords: 'chocolat tablette', group: 'desserts' },
  { emoji: '🍯', keywords: 'miel sucré', group: 'desserts' },
  { emoji: '🍬', keywords: 'bonbon confiserie sucré', group: 'desserts' },

  /* ── Repères ───────────────────────────────────────────────────────────── */
  { emoji: '⭐', keywords: 'incontournable star spécialité recommandé', group: 'repères' },
  { emoji: '❤️', keywords: 'coup de cœur préféré favori', group: 'repères' },
  { emoji: '✨', keywords: 'nouveauté nouveau récent', group: 'repères' },
  { emoji: '🏷️', keywords: 'promotion remise offre prix', group: 'repères' },
  { emoji: '👨‍🍳', keywords: 'chef suggestion cuisine maison', group: 'repères' },
  { emoji: '🍽️', keywords: 'menu formule couvert repas', group: 'repères' },
  { emoji: '🥡', keywords: 'à emporter livraison boîte', group: 'repères' },
  { emoji: '🌞', keywords: 'midi déjeuner brunch matin', group: 'repères' },
  { emoji: '🌙', keywords: 'soir dîner nuit', group: 'repères' },
  { emoji: '🎉', keywords: 'fête événement occasion', group: 'repères' },
  { emoji: '👶', keywords: 'enfant menu enfant petit', group: 'repères' },
  { emoji: '🌱', keywords: 'végétarien végétal sans viande', group: 'repères' },
  { emoji: '🧊', keywords: 'froid glacé frais', group: 'repères' },
  { emoji: '🇨🇲', keywords: 'cameroun local pays terroir', group: 'repères' },
];

/** Recherche insensible à la casse et aux accents, sur les mots-clés. */
export function searchEmojis(query: string): EmojiEntry[] {
  const needle = normalise(query);
  if (!needle) return EMOJIS;
  return EMOJIS.filter((entry) => normalise(entry.keywords).includes(needle));
}

const normalise = (value: string): string =>
  value
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
