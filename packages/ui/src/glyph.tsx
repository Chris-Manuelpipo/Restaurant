import type { JSX } from 'react';
import {
  CATEGORY_ICONS,
  ICON_SVG_ATTRS,
  parseCategoryVisual,
  type CategoryVisual,
} from '@evolyx/shared';

/**
 * Le visuel d'une catégorie, quelle que soit sa forme : emoji, icône du jeu curé, ou photo.
 *
 * Un seul composant pour les trois, parce que l'appelant ne devrait pas avoir à savoir ce que
 * le restaurant a choisi. Sans visuel, on affiche l'initiale du nom — jamais un carré vide.
 */
export function CategoryGlyph({
  icon,
  imageUrl,
  name,
  size = 40,
  className,
}: {
  icon?: string | null;
  imageUrl?: string | null;
  /** Sert d'ultime recours : la première lettre, comme sur un contact de téléphone. */
  name?: string;
  size?: number;
  className?: string;
}): JSX.Element {
  const visual = parseCategoryVisual(icon, imageUrl);
  return <VisualGlyph visual={visual} name={name} size={size} className={className} />;
}

export function VisualGlyph({
  visual,
  name,
  size = 40,
  className,
}: {
  visual: CategoryVisual;
  name?: string;
  size?: number;
  className?: string;
}): JSX.Element {
  const box = { width: size, height: size } as const;

  if (visual.kind === 'image') {
    return (
      <span className={className} style={box}>
        <img
          src={visual.url}
          alt=""
          width={size}
          height={size}
          className="evx-glyph__img"
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  if (visual.kind === 'icon') {
    const definition = CATEGORY_ICONS[visual.icon];
    return (
      <span className={className} style={box} aria-hidden>
        <svg
          width={Math.round(size * 0.55)}
          height={Math.round(size * 0.55)}
          viewBox={ICON_SVG_ATTRS.viewBox}
          fill={ICON_SVG_ATTRS.fill}
          stroke={ICON_SVG_ATTRS.stroke}
          strokeWidth={ICON_SVG_ATTRS.strokeWidth}
          strokeLinecap={ICON_SVG_ATTRS.strokeLinecap}
          strokeLinejoin={ICON_SVG_ATTRS.strokeLinejoin}
          // Tracé issu de notre propre jeu généré, jamais d'une saisie utilisateur.
          dangerouslySetInnerHTML={{ __html: definition?.svg ?? '' }}
        />
      </span>
    );
  }

  if (visual.kind === 'emoji') {
    return (
      <span className={className} style={{ ...box, fontSize: Math.round(size * 0.5) }} aria-hidden>
        {visual.emoji}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ ...box, fontSize: Math.round(size * 0.42), fontWeight: 700 }}
      aria-hidden
    >
      {(name ?? '?').charAt(0).toUpperCase()}
    </span>
  );
}
