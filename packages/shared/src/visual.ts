import { CATEGORY_ICONS, type CategoryIconKey } from './icons.js';

/**
 * Le visuel d'une catégorie.
 *
 * Trois formes, au choix du restaurant, du plus rapide au plus soigné :
 *  - un **emoji**, tapé ou choisi dans le sélecteur — zéro préparation ;
 *  - une **icône** du jeu curé — sobre, cohérente d'une catégorie à l'autre, professionnelle ;
 *  - une **photo** — la plus parlante, mais il faut l'avoir.
 *
 * Tout tient dans une seule colonne préfixée (`emoji:🔥`, `icon:flame`), plus une colonne
 * dédiée pour l'image. Une chaîne sans préfixe est traitée comme un emoji : c'est ce que les
 * premières versions écrivaient, et ces données doivent continuer de s'afficher.
 */

export type CategoryVisual =
  | { kind: 'emoji'; emoji: string }
  | { kind: 'icon'; icon: CategoryIconKey }
  | { kind: 'image'; url: string }
  | { kind: 'none' };

export function parseCategoryVisual(
  icon: string | null | undefined,
  imageUrl?: string | null,
): CategoryVisual {
  if (imageUrl) return { kind: 'image', url: imageUrl };

  const raw = icon?.trim();
  if (!raw) return { kind: 'none' };

  if (raw.startsWith('icon:')) {
    const key = raw.slice(5);
    return key in CATEGORY_ICONS ? { kind: 'icon', icon: key } : { kind: 'none' };
  }

  if (raw.startsWith('emoji:')) {
    const emoji = raw.slice(6);
    return emoji ? { kind: 'emoji', emoji } : { kind: 'none' };
  }

  // Ancien format : l'emoji était stocké nu.
  return { kind: 'emoji', emoji: raw };
}

/** Sérialise un visuel vers la colonne `icon`. L'image, elle, a sa propre colonne. */
export function formatCategoryIcon(visual: CategoryVisual): string | null {
  switch (visual.kind) {
    case 'emoji':
      return `emoji:${visual.emoji}`;
    case 'icon':
      return `icon:${visual.icon}`;
    default:
      return null;
  }
}

/** Le tracé SVG d'un visuel d'icône, prêt à insérer. Null pour les autres formes. */
export function iconSvg(visual: CategoryVisual): string | null {
  return visual.kind === 'icon' ? (CATEGORY_ICONS[visual.icon]?.svg ?? null) : null;
}
