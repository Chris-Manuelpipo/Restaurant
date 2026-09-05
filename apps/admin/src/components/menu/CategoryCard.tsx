import type { JSX } from 'react';
import { Badge, CategoryGlyph } from '@evolyx/ui';
import { resolveI18n } from '@evolyx/shared';
import { mediaUrl } from '../../lib/api';
import type { CategoryRow, ItemRow } from './types';

/**
 * Carte de catégorie — la porte d'entrée de la carte.
 *
 * Elle doit répondre en un coup d'œil aux trois questions du gérant : combien de plats,
 * combien d'épuisés, et est-ce que mes clients la voient. Le reste (renommer, changer le
 * visuel) se fait par le bouton discret en haut à droite, pour ne pas encombrer le geste
 * principal — qui est d'entrer dans la catégorie.
 */
export function CategoryCard({
  category,
  items,
  onOpen,
  onEdit,
  editable,
  dragHandlers,
  dragging,
}: {
  category: CategoryRow;
  items: ItemRow[];
  onOpen: () => void;
  onEdit: () => void;
  editable: boolean;
  dragHandlers?: {
    draggable: boolean;
    onDragStart: () => void;
    onDragOver: (event: React.DragEvent) => void;
    onDrop: () => void;
    onDragEnd: () => void;
  };
  dragging?: boolean;
}): JSX.Element {
  const soldOut = items.filter((item) => item.status === 'SOLD_OUT').length;
  const withoutPhoto = items.filter((item) => item.images.length === 0).length;
  const name = resolveI18n(category.name);

  return (
    <article
      className="cat-card"
      data-hidden={!category.isVisible || undefined}
      data-dragging={dragging || undefined}
      draggable={dragHandlers?.draggable}
      onDragStart={dragHandlers?.onDragStart}
      onDragOver={dragHandlers?.onDragOver}
      onDrop={dragHandlers?.onDrop}
      onDragEnd={dragHandlers?.onDragEnd}
    >
      {/* Toute la carte est cliquable : c'est le geste qu'on fait cinquante fois par jour. */}
      <button type="button" className="cat-card__open" onClick={onOpen}>
        <span className="sr-only">Ouvrir la catégorie {name}</span>
      </button>

      <div className="cat-card__head">
        <CategoryGlyph
          icon={category.icon}
          imageUrl={mediaUrl(category.imageUrl)}
          name={name}
          size={52}
          className="evx-glyph evx-glyph--lg"
        />

        <div className="min-w-0 flex-1">
          <h3 className="cat-card__name">{name}</h3>
          <p className="cat-card__count">
            {items.length} plat{items.length > 1 ? 's' : ''}
          </p>
        </div>

        {editable ? (
          <button
            type="button"
            className="cat-card__edit"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            aria-label={`Modifier la catégorie ${name}`}
            title="Modifier"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="cat-card__foot">
        {soldOut > 0 ? (
          <Badge tone="danger">
            {soldOut} épuisé{soldOut > 1 ? 's' : ''}
          </Badge>
        ) : null}
        {!category.isVisible ? <Badge tone="neutral">Masquée</Badge> : null}
        {withoutPhoto > 0 && items.length > 0 ? (
          <Badge tone="warning">
            {withoutPhoto} sans photo
          </Badge>
        ) : null}
        {soldOut === 0 && category.isVisible && withoutPhoto === 0 && items.length > 0 ? (
          <Badge tone="success">À jour</Badge>
        ) : null}
        {items.length === 0 ? <Badge tone="neutral">Vide</Badge> : null}

        <span className="cat-card__arrow" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>

      {dragHandlers ? (
        <span className="cat-card__grip" aria-hidden title="Glisser pour réordonner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.6" />
            <circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" />
            <circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" />
            <circle cx="15" cy="18" r="1.6" />
          </svg>
        </span>
      ) : null}
    </article>
  );
}
