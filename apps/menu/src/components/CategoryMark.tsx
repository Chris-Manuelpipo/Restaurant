import type { JSX } from 'react';
import { CATEGORY_ICONS, ICON_SVG_ATTRS, parseCategoryVisual } from '@evolyx/shared';

/**
 * Le visuel d'une catégorie, côté client.
 *
 * Le même concept que dans le back-office, mais rendu ici sans passer par `@evolyx/ui` : le
 * menu ne doit rien devoir à la bibliothèque du back-office. Vingt lignes dupliquées valent
 * mieux que trente kilo-octets importés — la logique, elle, reste partagée.
 */
export function CategoryMark({
  icon,
  imageUrl,
  size = 16,
}: {
  icon: string | null;
  imageUrl?: string | null;
  size?: number;
}): JSX.Element | null {
  const visual = parseCategoryVisual(icon, imageUrl);

  if (visual.kind === 'image') {
    return (
      <img
        src={visual.url}
        alt=""
        width={size}
        height={size}
        className="rounded-[5px] object-cover"
        style={{ width: size, height: size }}
        loading="lazy"
        decoding="async"
      />
    );
  }

  if (visual.kind === 'icon') {
    const definition = CATEGORY_ICONS[visual.icon];
    if (!definition) return null;
    return (
      <svg
        width={size}
        height={size}
        viewBox={ICON_SVG_ATTRS.viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_SVG_ATTRS.strokeWidth}
        strokeLinecap={ICON_SVG_ATTRS.strokeLinecap}
        strokeLinejoin={ICON_SVG_ATTRS.strokeLinejoin}
        aria-hidden
        // Tracé issu de notre jeu généré, jamais d'une saisie utilisateur.
        dangerouslySetInnerHTML={{ __html: definition.svg }}
      />
    );
  }

  if (visual.kind === 'emoji') {
    return (
      <span aria-hidden style={{ fontSize: size - 1, lineHeight: 1 }}>
        {visual.emoji}
      </span>
    );
  }

  return null;
}
