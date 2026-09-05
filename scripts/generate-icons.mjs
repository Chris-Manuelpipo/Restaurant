import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as lucide from 'lucide';

/**
 * Génère `packages/shared/src/icons.ts` à partir de Lucide.
 *
 * Pourquoi générer plutôt que dépendre de `lucide-react` à l'exécution : le menu client a un
 * budget de trois cents kilo-octets, et rendre une icône choisie dynamiquement obligerait à
 * embarquer toute la bibliothèque. On extrait donc une fois pour toutes les tracés des
 * quelques dizaines d'icônes qui parlent à un restaurateur, et on les livre comme des données.
 *
 *   node scripts/generate-icons.mjs
 */

/** Le jeu curé : ce qu'un restaurant camerounais met réellement sur une carte. */
const CURATED = [
  // Plats
  ['flame', 'Flame', 'Grillades', 'plats'],
  ['drumstick', 'Drumstick', 'Volaille', 'plats'],
  ['beef', 'Beef', 'Viande', 'plats'],
  ['ham', 'Ham', 'Charcuterie', 'plats'],
  ['fish', 'Fish', 'Poissons', 'plats'],
  ['shell', 'Shell', 'Fruits de mer', 'plats'],
  ['soup', 'Soup', 'Soupes', 'plats'],
  ['salad', 'Salad', 'Salades', 'plats'],
  ['pizza', 'Pizza', 'Pizzas', 'plats'],
  ['sandwich', 'Sandwich', 'Sandwichs', 'plats'],
  ['hamburger', 'Hamburger', 'Burgers', 'plats'],
  ['cookingPot', 'CookingPot', 'Plats mijotés', 'plats'],
  ['eggFried', 'EggFried', 'Œufs', 'plats'],
  ['wheat', 'Wheat', 'Féculents', 'plats'],

  // Accompagnements et produits
  ['carrot', 'Carrot', 'Légumes', 'produits'],
  ['leafyGreen', 'LeafyGreen', 'Verdure', 'produits'],
  ['sprout', 'Sprout', 'Végétarien', 'produits'],
  ['vegan', 'Vegan', 'Végétalien', 'produits'],
  ['apple', 'Apple', 'Fruits', 'produits'],
  ['banana', 'Banana', 'Banane, plantain', 'produits'],
  ['citrus', 'Citrus', 'Agrumes', 'produits'],
  ['grape', 'Grape', 'Raisin', 'produits'],
  ['cherry', 'Cherry', 'Cerise', 'produits'],
  ['nut', 'Nut', 'Fruits à coque', 'produits'],

  // Boissons
  ['coffee', 'Coffee', 'Café, thé', 'boissons'],
  ['cupSoda', 'CupSoda', 'Sodas', 'boissons'],
  ['glassWater', 'GlassWater', 'Eaux', 'boissons'],
  ['milk', 'Milk', 'Laitages', 'boissons'],
  ['beer', 'Beer', 'Bières', 'boissons'],
  ['wine', 'Wine', 'Vins', 'boissons'],
  ['martini', 'Martini', 'Cocktails', 'boissons'],

  // Desserts
  ['cakeSlice', 'CakeSlice', 'Pâtisseries', 'desserts'],
  ['cake', 'Cake', 'Gâteaux', 'desserts'],
  ['iceCreamCone', 'IceCreamCone', 'Glaces', 'desserts'],
  ['cookie', 'Cookie', 'Biscuits', 'desserts'],
  ['dessert', 'Dessert', 'Desserts', 'desserts'],
  ['croissant', 'Croissant', 'Viennoiseries', 'desserts'],
  ['candy', 'Candy', 'Confiseries', 'desserts'],
  ['popcorn', 'Popcorn', 'À grignoter', 'desserts'],

  // Service et repères
  ['utensils', 'Utensils', 'Menu du jour', 'service'],
  ['utensilsCrossed', 'UtensilsCrossed', 'Formules', 'service'],
  ['chefHat', 'ChefHat', 'Suggestions du chef', 'service'],
  ['sun', 'Sun', 'Midi, brunch', 'service'],
  ['moon', 'Moon', 'Soir', 'service'],
  ['star', 'Star', 'Nos incontournables', 'service'],
  ['heart', 'Heart', 'Coups de cœur', 'service'],
  ['sparkles', 'Sparkles', 'Nouveautés', 'service'],
  ['tag', 'Tag', 'Promotions', 'service'],
  ['baby', 'Baby', 'Menu enfant', 'service'],
];

const icons = {};
const missing = [];

for (const [key, source, label, group] of CURATED) {
  const definition = lucide[source];
  if (!definition) {
    missing.push(source);
    continue;
  }

  // Lucide décrit chaque icône comme une liste de [balise, attributs].
  const parts = definition
    .map(([tag, attrs]) => {
      const entries = Object.entries(attrs)
        .filter(([name]) => name !== 'key')
        .map(([name, value]) => `${name}="${value}"`)
        .join(' ');
      return `<${tag} ${entries}/>`;
    })
    .join('');

  icons[key] = { svg: parts, label, group };
}

if (missing.length > 0) {
  console.error('Icônes introuvables dans Lucide :', missing.join(', '));
  process.exit(1);
}

const groups = [...new Set(CURATED.map(([, , , group]) => group))];

const output = `/**
 * Icônes de catégories — jeu curé pour la restauration.
 *
 * FICHIER GÉNÉRÉ par \`node scripts/generate-icons.mjs\`. Ne pas modifier à la main.
 *
 * Les tracés viennent de Lucide (licence ISC) et sont livrés comme des **données**, pas comme
 * une bibliothèque : le menu client rend l'icône choisie par le restaurant sans embarquer les
 * deux mille autres. Chaque tracé s'insère dans un \`<svg viewBox="0 0 24 24">\` avec
 * \`fill="none" stroke="currentColor" stroke-width="2"\`.
 */

export interface IconDefinition {
  /** Contenu du <svg>, à insérer tel quel. */
  svg: string;
  /** Ce que l'icône désigne, en français — sert à la recherche dans le sélecteur. */
  label: string;
  group: IconGroup;
}

export type IconGroup = ${groups.map((g) => `'${g}'`).join(' | ')};

export const ICON_GROUP_LABELS: Record<IconGroup, string> = {
  plats: 'Plats',
  produits: 'Produits',
  boissons: 'Boissons',
  desserts: 'Desserts',
  service: 'Service et repères',
};

export const CATEGORY_ICONS: Record<string, IconDefinition> = ${JSON.stringify(icons, null, 2)
  .replace(/"([a-zA-Z]+)":/g, '$1:')
  .replace(/"/g, "'")} as const;

export type CategoryIconKey = keyof typeof CATEGORY_ICONS;

/** Attributs communs à tous les rendus : une seule vérité, deux applications. */
export const ICON_SVG_ATTRS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;
`;

const target = fileURLToPath(new URL('../packages/shared/src/icons.ts', import.meta.url));
writeFileSync(target, output);

const weight = Buffer.byteLength(output, 'utf8');
console.log(`✓ ${Object.keys(icons).length} icônes écrites (${(weight / 1024).toFixed(1)} Ko)`);
