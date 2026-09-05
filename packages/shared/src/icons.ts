/**
 * Icônes de catégories — jeu curé pour la restauration.
 *
 * FICHIER GÉNÉRÉ par `node scripts/generate-icons.mjs`. Ne pas modifier à la main.
 *
 * Les tracés viennent de Lucide (licence ISC) et sont livrés comme des **données**, pas comme
 * une bibliothèque : le menu client rend l'icône choisie par le restaurant sans embarquer les
 * deux mille autres. Chaque tracé s'insère dans un `<svg viewBox="0 0 24 24">` avec
 * `fill="none" stroke="currentColor" stroke-width="2"`.
 */

export interface IconDefinition {
  /** Contenu du <svg>, à insérer tel quel. */
  svg: string;
  /** Ce que l'icône désigne, en français — sert à la recherche dans le sélecteur. */
  label: string;
  group: IconGroup;
}

export type IconGroup = 'plats' | 'produits' | 'boissons' | 'desserts' | 'service';

export const ICON_GROUP_LABELS: Record<IconGroup, string> = {
  plats: 'Plats',
  produits: 'Produits',
  boissons: 'Boissons',
  desserts: 'Desserts',
  service: 'Service et repères',
};

export const CATEGORY_ICONS: Record<string, IconDefinition> = {
  flame: {
    svg: '<path d=\'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4\'/>',
    label: 'Grillades',
    group: 'plats'
  },
  drumstick: {
    svg: '<path d=\'M15.4 15.63a7.875 6 135 1 1 6.23-6.23 4.5 3.43 135 0 0-6.23 6.23\'/><path d=\'m8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59\'/>',
    label: 'Volaille',
    group: 'plats'
  },
  beef: {
    svg: '<path d=\'M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3\'/><path d=\'m18.5 6 1.754 3.5a6.48 6.48 0 0 1-1.854 8.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5\'/><circle cx=\'12.5\' cy=\'8.5\' r=\'2.5\'/>',
    label: 'Viande',
    group: 'plats'
  },
  ham: {
    svg: '<path d=\'M13.144 21.144A7.274 10.445 45 1 0 2.856 10.856\'/><path d=\'M13.144 21.144A7.274 4.365 45 0 0 2.856 10.856a7.274 4.365 45 0 0 10.288 10.288\'/><path d=\'M16.565 10.435 18.6 8.4a2.501 2.501 0 1 0 1.65-4.65 2.5 2.5 0 1 0-4.66 1.66l-2.024 2.025\'/><path d=\'m8.5 16.5-1-1\'/>',
    label: 'Charcuterie',
    group: 'plats'
  },
  fish: {
    svg: '<path d=\'M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z\'/><path d=\'M18 12v.5\'/><path d=\'M16 17.93a9.77 9.77 0 0 1 0-11.86\'/><path d=\'M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33\'/><path d=\'M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4\'/><path d=\'m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98\'/>',
    label: 'Poissons',
    group: 'plats'
  },
  shell: {
    svg: '<path d=\'M14 11a2 2 0 1 1-4 0 4 4 0 0 1 8 0 6 6 0 0 1-12 0 8 8 0 0 1 16 0 10 10 0 1 1-20 0 11.93 11.93 0 0 1 2.42-7.22 2 2 0 1 1 3.16 2.44\'/>',
    label: 'Fruits de mer',
    group: 'plats'
  },
  soup: {
    svg: '<path d=\'M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z\'/><path d=\'M7 21h10\'/><path d=\'M19.5 12 22 6\'/><path d=\'M16.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.73 1.62\'/><path d=\'M11.25 3c.27.1.8.53.74 1.36-.05.83-.93 1.2-.98 2.02-.06.78.33 1.24.72 1.62\'/><path d=\'M6.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.74 1.62\'/>',
    label: 'Soupes',
    group: 'plats'
  },
  salad: {
    svg: '<path d=\'M7 21h10\'/><path d=\'M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z\'/><path d=\'M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1\'/><path d=\'m13 12 4-4\'/><path d=\'M10.9 7.25A3.99 3.99 0 0 0 4 10c0 .73.2 1.41.54 2\'/>',
    label: 'Salades',
    group: 'plats'
  },
  pizza: {
    svg: '<path d=\'m12 14-1 1\'/><path d=\'m13.75 18.25-1.25 1.42\'/><path d=\'M17.775 5.654a15.68 15.68 0 0 0-12.121 12.12\'/><path d=\'M18.8 9.3a1 1 0 0 0 2.1 7.7\'/><path d=\'M21.964 20.732a1 1 0 0 1-1.232 1.232l-18-5a1 1 0 0 1-.695-1.232A19.68 19.68 0 0 1 15.732 2.037a1 1 0 0 1 1.232.695z\'/>',
    label: 'Pizzas',
    group: 'plats'
  },
  sandwich: {
    svg: '<path d=\'m2.37 11.223 8.372-6.777a2 2 0 0 1 2.516 0l8.371 6.777\'/><path d=\'M21 15a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5.25\'/><path d=\'M3 15a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h9\'/><path d=\'m6.67 15 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2\'/><rect width=\'20\' height=\'4\' x=\'2\' y=\'11\' rx=\'1\'/>',
    label: 'Sandwichs',
    group: 'plats'
  },
  hamburger: {
    svg: '<path d=\'M12 16H4a2 2 0 1 1 0-4h16a2 2 0 1 1 0 4h-4.25\'/><path d=\'M5 12a2 2 0 0 1-2-2 9 7 0 0 1 18 0 2 2 0 0 1-2 2\'/><path d=\'M5 16a2 2 0 0 0-2 2 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 2 2 0 0 0-2-2q0 0 0 0\'/><path d=\'m6.67 12 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2\'/>',
    label: 'Burgers',
    group: 'plats'
  },
  cookingPot: {
    svg: '<path d=\'M2 12h20\'/><path d=\'M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8\'/><path d=\'m4 8 16-4\'/><path d=\'m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8\'/>',
    label: 'Plats mijotés',
    group: 'plats'
  },
  eggFried: {
    svg: '<circle cx=\'11.5\' cy=\'12.5\' r=\'3.5\'/><path d=\'M3 8c0-3.5 2.5-6 6.5-6 5 0 4.83 3 7.5 5s5 2 5 6c0 4.5-2.5 6.5-7 6.5-2.5 0-2.5 2.5-6 2.5s-7-2-7-5.5c0-3 1.5-3 1.5-5C3.5 10 3 9 3 8Z\'/>',
    label: 'Œufs',
    group: 'plats'
  },
  wheat: {
    svg: '<path d=\'M2 22 16 8\'/><path d=\'M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z\'/><path d=\'M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z\'/><path d=\'M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z\'/><path d=\'M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z\'/><path d=\'M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z\'/><path d=\'M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z\'/><path d=\'M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z\'/>',
    label: 'Féculents',
    group: 'plats'
  },
  carrot: {
    svg: '<path d=\'M15 16a1 1 0 0 0-7-7q-4 4-5.987 12.385a.5.5 0 0 0 .602.602Q11 20 15 16l-3-3\'/><path d=\'M15 9q4 4 7 0-3-4-7 0 4-4 0-7-4 3 0 7\'/><path d=\'m8 15-2.58-2.58\'/>',
    label: 'Légumes',
    group: 'produits'
  },
  leafyGreen: {
    svg: '<path d=\'M2 22c1.25-.987 2.27-1.975 3.9-2.2a5.56 5.56 0 0 1 3.8 1.5 4 4 0 0 0 6.187-2.353 3.5 3.5 0 0 0 3.69-5.116A3.5 3.5 0 0 0 20.95 8 3.5 3.5 0 1 0 16 3.05a3.5 3.5 0 0 0-5.831 1.373 3.5 3.5 0 0 0-5.116 3.69 4 4 0 0 0-2.348 6.155C3.499 15.42 4.409 16.712 4.2 18.1 3.926 19.743 3.014 20.732 2 22\'/><path d=\'M2 22 17 7\'/>',
    label: 'Verdure',
    group: 'produits'
  },
  sprout: {
    svg: '<path d=\'M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3\'/><path d=\'M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4\'/><path d=\'M5 21h14\'/>',
    label: 'Végétarien',
    group: 'produits'
  },
  vegan: {
    svg: '<path d=\'M16 8q6 0 6-6-6 0-6 6\'/><path d=\'M17.41 3.59a10 10 0 1 0 3 3\'/><path d=\'M2 2a26.6 26.6 0 0 1 10 20c.9-6.82 1.5-9.5 4-14\'/>',
    label: 'Végétalien',
    group: 'produits'
  },
  apple: {
    svg: '<path d=\'M12 6.528V3a1 1 0 0 1 1-1h0\'/><path d=\'M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21\'/>',
    label: 'Fruits',
    group: 'produits'
  },
  banana: {
    svg: '<path d=\'M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5\'/><path d=\'M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.11 22 2 22 2 20c0-1.5 1.14-1.55 3.15-2.11Z\'/>',
    label: 'Banane, plantain',
    group: 'produits'
  },
  citrus: {
    svg: '<path d=\'M21.66 17.67a1.08 1.08 0 0 1-.04 1.6A12 12 0 0 1 4.73 2.38a1.1 1.1 0 0 1 1.61-.04z\'/><path d=\'M19.65 15.66A8 8 0 0 1 8.35 4.34\'/><path d=\'m14 10-5.5 5.5\'/><path d=\'M14 17.85V10H6.15\'/>',
    label: 'Agrumes',
    group: 'produits'
  },
  grape: {
    svg: '<path d=\'M22 5V2l-5.89 5.89\'/><circle cx=\'16.6\' cy=\'15.89\' r=\'3\'/><circle cx=\'8.11\' cy=\'7.4\' r=\'3\'/><circle cx=\'12.35\' cy=\'11.65\' r=\'3\'/><circle cx=\'13.91\' cy=\'5.85\' r=\'3\'/><circle cx=\'18.15\' cy=\'10.09\' r=\'3\'/><circle cx=\'6.56\' cy=\'13.2\' r=\'3\'/><circle cx=\'10.8\' cy=\'17.44\' r=\'3\'/><circle cx=\'5\' cy=\'19\' r=\'3\'/>',
    label: 'Raisin',
    group: 'produits'
  },
  cherry: {
    svg: '<path d=\'M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z\'/><path d=\'M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z\'/><path d=\'M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12\'/><path d=\'M22 9c-4.29 0-7.14-2.33-10-7 5.71 0 10 4.67 10 7Z\'/>',
    label: 'Cerise',
    group: 'produits'
  },
  nut: {
    svg: '<path d=\'M12 4V2\'/><path d=\'M5 10v4a7.004 7.004 0 0 0 5.277 6.787c.412.104.802.292 1.102.592L12 22l.621-.621c.3-.3.69-.488 1.102-.592A7.003 7.003 0 0 0 19 14v-4\'/><path d=\'M12 4C8 4 4.5 6 4 8c-.243.97-.919 1.952-2 3 1.31-.082 1.972-.29 3-1 .54.92.982 1.356 2 2 1.452-.647 1.954-1.098 2.5-2 .595.995 1.151 1.427 2.5 2 1.31-.621 1.862-1.058 2.5-2 .629.977 1.162 1.423 2.5 2 1.209-.548 1.68-.967 2-2 1.032.916 1.683 1.157 3 1-1.297-1.036-1.758-2.03-2-3-.5-2-4-4-8-4Z\'/>',
    label: 'Fruits à coque',
    group: 'produits'
  },
  coffee: {
    svg: '<path d=\'M10 2v2\'/><path d=\'M14 2v2\'/><path d=\'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1\'/><path d=\'M6 2v2\'/>',
    label: 'Café, thé',
    group: 'boissons'
  },
  cupSoda: {
    svg: '<path d=\'m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8\'/><path d=\'M5 8h14\'/><path d=\'M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0\'/><path d=\'m12 8 1-6h2\'/>',
    label: 'Sodas',
    group: 'boissons'
  },
  glassWater: {
    svg: '<path d=\'M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z\'/><path d=\'M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0\'/>',
    label: 'Eaux',
    group: 'boissons'
  },
  milk: {
    svg: '<path d=\'M8 2h8\'/><path d=\'M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2\'/><path d=\'M7 15a6.472 6.472 0 0 1 5 0 6.47 6.47 0 0 0 5 0\'/>',
    label: 'Laitages',
    group: 'boissons'
  },
  beer: {
    svg: '<path d=\'M17 11h1a3 3 0 0 1 0 6h-1\'/><path d=\'M9 12v6\'/><path d=\'M13 12v6\'/><path d=\'M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z\'/><path d=\'M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8\'/>',
    label: 'Bières',
    group: 'boissons'
  },
  wine: {
    svg: '<path d=\'M8 22h8\'/><path d=\'M7 10h10\'/><path d=\'M12 15v7\'/><path d=\'M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z\'/>',
    label: 'Vins',
    group: 'boissons'
  },
  martini: {
    svg: '<path d=\'M12 12 4.207 4.207A.707.707 0 0 1 4.707 3h14.586a.707.707 0 0 1 .5 1.207z\'/><path d=\'M12 12v10\'/><path d=\'M7 22h10\'/>',
    label: 'Cocktails',
    group: 'boissons'
  },
  cakeSlice: {
    svg: '<path d=\'M16 13H3\'/><path d=\'M16 17H3\'/><path d=\'m7.2 7.9-3.388 2.5A2 2 0 0 0 3 12.01V20a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-8.654c0-2-2.44-6.026-6.44-8.026a1 1 0 0 0-1.082.057L10.4 5.6\'/><circle cx=\'9\' cy=\'7\' r=\'2\'/>',
    label: 'Pâtisseries',
    group: 'desserts'
  },
  cake: {
    svg: '<path d=\'M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8\'/><path d=\'M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1\'/><path d=\'M2 21h20\'/><path d=\'M7 8v3\'/><path d=\'M12 8v3\'/><path d=\'M17 8v3\'/><path d=\'M7 4h.01\'/><path d=\'M12 4h.01\'/><path d=\'M17 4h.01\'/>',
    label: 'Gâteaux',
    group: 'desserts'
  },
  iceCreamCone: {
    svg: '<path d=\'m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11\'/><path d=\'M17 7A5 5 0 0 0 7 7\'/><path d=\'M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4\'/>',
    label: 'Glaces',
    group: 'desserts'
  },
  cookie: {
    svg: '<path d=\'M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5\'/><path d=\'M8.5 8.5v.01\'/><path d=\'M16 15.5v.01\'/><path d=\'M12 12v.01\'/><path d=\'M11 17v.01\'/><path d=\'M7 14v.01\'/>',
    label: 'Biscuits',
    group: 'desserts'
  },
  dessert: {
    svg: '<path d=\'M10.162 3.167A10 10 0 0 0 2 13a2 2 0 0 0 4 0v-1a2 2 0 0 1 4 0v4a2 2 0 0 0 4 0v-4a2 2 0 0 1 4 0v1a2 2 0 0 0 4-.006 10 10 0 0 0-8.161-9.826\'/><path d=\'M20.804 14.869a9 9 0 0 1-17.608 0\'/><circle cx=\'12\' cy=\'4\' r=\'2\'/>',
    label: 'Desserts',
    group: 'desserts'
  },
  croissant: {
    svg: '<path d=\'M10.2 18H4.774a1.5 1.5 0 0 1-1.352-.97 11 11 0 0 1 .132-6.487\'/><path d=\'M18 10.2V4.774a1.5 1.5 0 0 0-.97-1.352 11 11 0 0 0-6.486.132\'/><path d=\'M18 5a4 3 0 0 1 4 3 2 2 0 0 1-2 2 10 10 0 0 0-5.139 1.42\'/><path d=\'M5 18a3 4 0 0 0 3 4 2 2 0 0 0 2-2 10 10 0 0 1 1.42-5.14\'/><path d=\'M8.709 2.554a10 10 0 0 0-6.155 6.155 1.5 1.5 0 0 0 .676 1.626l9.807 5.42a2 2 0 0 0 2.718-2.718l-5.42-9.807a1.5 1.5 0 0 0-1.626-.676\'/>',
    label: 'Viennoiseries',
    group: 'desserts'
  },
  candy: {
    svg: '<path d=\'M10 7v10.9\'/><path d=\'M14 6.1V17\'/><path d=\'M16 7V3a1 1 0 0 1 1.707-.707 2.5 2.5 0 0 0 2.152.717 1 1 0 0 1 1.131 1.131 2.5 2.5 0 0 0 .717 2.152A1 1 0 0 1 21 8h-4\'/><path d=\'M16.536 7.465a5 5 0 0 0-7.072 0l-2 2a5 5 0 0 0 0 7.07 5 5 0 0 0 7.072 0l2-2a5 5 0 0 0 0-7.07\'/><path d=\'M8 17v4a1 1 0 0 1-1.707.707 2.5 2.5 0 0 0-2.152-.717 1 1 0 0 1-1.131-1.131 2.5 2.5 0 0 0-.717-2.152A1 1 0 0 1 3 16h4\'/>',
    label: 'Confiseries',
    group: 'desserts'
  },
  popcorn: {
    svg: '<path d=\'M18 8a2 2 0 0 0 0-4 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0 0 4\'/><path d=\'M10 22 9 8\'/><path d=\'m14 22 1-14\'/><path d=\'M20 8c.5 0 .9.4.8 1l-2.6 12c-.1.5-.7 1-1.2 1H7c-.6 0-1.1-.4-1.2-1L3.2 9c-.1-.6.3-1 .8-1Z\'/>',
    label: 'À grignoter',
    group: 'desserts'
  },
  utensils: {
    svg: '<path d=\'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2\'/><path d=\'M7 2v20\'/><path d=\'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7\'/>',
    label: 'Menu du jour',
    group: 'service'
  },
  utensilsCrossed: {
    svg: '<path d=\'m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8\'/><path d=\'M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7\'/><path d=\'m2.1 21.8 6.4-6.3\'/><path d=\'m19 5-7 7\'/>',
    label: 'Formules',
    group: 'service'
  },
  chefHat: {
    svg: '<path d=\'M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z\'/><path d=\'M6 17h12\'/>',
    label: 'Suggestions du chef',
    group: 'service'
  },
  sun: {
    svg: '<circle cx=\'12\' cy=\'12\' r=\'4\'/><path d=\'M12 2v2\'/><path d=\'M12 20v2\'/><path d=\'m4.93 4.93 1.41 1.41\'/><path d=\'m17.66 17.66 1.41 1.41\'/><path d=\'M2 12h2\'/><path d=\'M20 12h2\'/><path d=\'m6.34 17.66-1.41 1.41\'/><path d=\'m19.07 4.93-1.41 1.41\'/>',
    label: 'Midi, brunch',
    group: 'service'
  },
  moon: {
    svg: '<path d=\'M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\'/>',
    label: 'Soir',
    group: 'service'
  },
  star: {
    svg: '<path d=\'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\'/>',
    label: 'Nos incontournables',
    group: 'service'
  },
  heart: {
    svg: '<path d=\'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\'/>',
    label: 'Coups de cœur',
    group: 'service'
  },
  sparkles: {
    svg: '<path d=\'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\'/><path d=\'M20 2v4\'/><path d=\'M22 4h-4\'/><circle cx=\'4\' cy=\'20\' r=\'2\'/>',
    label: 'Nouveautés',
    group: 'service'
  },
  tag: {
    svg: '<path d=\'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z\'/><circle cx=\'7.5\' cy=\'7.5\' r=\'.5\' fill=\'currentColor\'/>',
    label: 'Promotions',
    group: 'service'
  },
  baby: {
    svg: '<path d=\'M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5\'/><path d=\'M15 12h.01\'/><path d=\'M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1\'/><path d=\'M9 12h.01\'/>',
    label: 'Menu enfant',
    group: 'service'
  }
} as const;

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
