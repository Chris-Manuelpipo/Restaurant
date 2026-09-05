import type { JSX } from 'react';
import { Badge, Button } from '@evolyx/ui';
import { formatAmount, resolveI18n } from '@evolyx/shared';
import { mediaUrl } from '../../lib/api';
import { displayPrice, type ItemRow } from './types';

/**
 * Les plats d'une catégorie, en grille ou en liste.
 *
 * Deux densités parce que deux usages : la **grille** montre les photos — c'est celle qu'on
 * veut quand on soigne sa carte ; la **liste** tient trente plats à l'écran — c'est celle
 * qu'on veut en plein service pour marquer trois plats épuisés en dix secondes.
 *
 * Dans les deux cas, le bouton « Épuisé » est en façade : c'est le geste du quotidien, il ne
 * se cache pas derrière un menu.
 */

export interface ItemListProps {
  items: ItemRow[];
  density: 'grid' | 'list';
  editable: boolean;
  /** Identifiant du plat dont le statut est en cours d'envoi. */
  pendingId?: string;
  onToggleSoldOut: (item: ItemRow) => void;
  onEdit: (item: ItemRow) => void;
  /** Rendu quand la recherche traverse plusieurs catégories. */
  categoryNameOf?: (item: ItemRow) => string | null;
}

export function ItemList({
  items,
  density,
  editable,
  pendingId,
  onToggleSoldOut,
  onEdit,
  categoryNameOf,
}: ItemListProps): JSX.Element {
  if (density === 'grid') {
    return (
      <div className="dish-grid">
        {items.map((item) => (
          <DishCard
            key={item.id}
            item={item}
            editable={editable}
            pending={pendingId === item.id}
            onToggleSoldOut={() => onToggleSoldOut(item)}
            onEdit={() => onEdit(item)}
            categoryName={categoryNameOf?.(item) ?? null}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="evx-card">
      {items.map((item) => (
        <DishRow
          key={item.id}
          item={item}
          editable={editable}
          pending={pendingId === item.id}
          onToggleSoldOut={() => onToggleSoldOut(item)}
          onEdit={() => onEdit(item)}
          categoryName={categoryNameOf?.(item) ?? null}
        />
      ))}
    </div>
  );
}

/* ── Carte ──────────────────────────────────────────────────────────────── */

function DishCard({
  item,
  editable,
  pending,
  onToggleSoldOut,
  onEdit,
  categoryName,
}: {
  item: ItemRow;
  editable: boolean;
  pending: boolean;
  onToggleSoldOut: () => void;
  onEdit: () => void;
  categoryName: string | null;
}): JSX.Element {
  const price = displayPrice(item);
  const soldOut = item.status === 'SOLD_OUT';
  const photo = item.images[0];

  return (
    <article className="dish-card" data-sold={soldOut || undefined}>
      <button
        type="button"
        className="dish-card__photo"
        onClick={onEdit}
        aria-label={`Modifier ${resolveI18n(item.name)}`}
      >
        {photo ? (
          <img
            src={mediaUrl(photo.variants.medium)!}
            alt=""
            loading="lazy"
            decoding="async"
            width={320}
            height={200}
          />
        ) : (
          <span className="dish-card__nophoto" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="9" cy="10" r="2" />
              <path d="m3 17 5-4 4 3 3-2 6 5" />
            </svg>
            Sans photo
          </span>
        )}

        {item.images.length > 1 ? (
          <span className="dish-card__count" title={`${item.images.length} photos`} aria-hidden>
            {item.images.length}
          </span>
        ) : null}

        {soldOut ? (
          <span className="dish-card__ribbon" aria-hidden>
            Épuisé
          </span>
        ) : null}
        {item.status === 'DISABLED' ? (
          <span className="dish-card__ribbon" aria-hidden>
            Retiré
          </span>
        ) : null}
      </button>

      <div className="dish-card__body">
        <div className="flex items-start justify-between gap-2">
          <h3 className="dish-card__name">{resolveI18n(item.name)}</h3>
          <span className="dish-card__price">
            {price.from ? <em>dès </em> : null}
            {formatAmount(price.amount)} F
          </span>
        </div>

        {categoryName ? (
          <p className="dish-card__meta">{categoryName}</p>
        ) : (
          <p className="dish-card__meta">
            {resolveI18n(item.description) || 'Pas encore de description'}
          </p>
        )}

        {editable ? (
          <div className="dish-card__actions">
            <Button
              size="sm"
              variant={soldOut ? 'primary' : 'secondary'}
              loading={pending}
              onClick={onToggleSoldOut}
            >
              {soldOut ? 'Remettre' : 'Épuisé'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onEdit}>
              Modifier
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/* ── Ligne ──────────────────────────────────────────────────────────────── */

function DishRow({
  item,
  editable,
  pending,
  onToggleSoldOut,
  onEdit,
  categoryName,
}: {
  item: ItemRow;
  editable: boolean;
  pending: boolean;
  onToggleSoldOut: () => void;
  onEdit: () => void;
  categoryName: string | null;
}): JSX.Element {
  const price = displayPrice(item);
  const soldOut = item.status === 'SOLD_OUT';
  const photo = item.images[0];

  return (
    <div className="row" data-sold={soldOut || undefined}>
      <button type="button" className="dish-row__thumb" onClick={onEdit} aria-label="Modifier">
        {photo ? (
          <img src={mediaUrl(photo.variants.thumb)!} alt="" width={44} height={44} loading="lazy" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m3 17 5-4 4 3 3-2 6 5" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className="m-0 font-semibold truncate">{resolveI18n(item.name)}</p>
        <p className="m-0 text-[12px] truncate" style={{ color: 'var(--ink-3)' }}>
          {categoryName ?? resolveI18n(item.description) ?? '—'}
        </p>
      </div>

      {soldOut ? <Badge tone="danger">Épuisé</Badge> : null}
      {item.status === 'DISABLED' ? <Badge tone="neutral">Retiré</Badge> : null}
      {item.images.length === 0 ? <Badge tone="warning">Sans photo</Badge> : null}

      <span className="w-24 text-right shrink-0 tabular-nums font-semibold">
        {price.from ? (
          <em className="not-italic text-[11px] font-normal" style={{ color: 'var(--ink-3)' }}>
            dès{' '}
          </em>
        ) : null}
        {formatAmount(price.amount)} F
      </span>

      {editable ? (
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant={soldOut ? 'primary' : 'secondary'}
            loading={pending}
            onClick={onToggleSoldOut}
          >
            {soldOut ? 'Remettre' : 'Épuisé'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Modifier
          </Button>
        </div>
      ) : null}
    </div>
  );
}
