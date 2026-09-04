import { memo } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { formatAmount, currencySymbol, type PublicMenuItem } from '@evolyx/shared';

/**
 * Une ligne de plat.
 *
 * Trois détails qui comptent sur le terrain :
 *  - les dimensions de l'image sont posées en dur : aucun décalage de mise en page quand la
 *    photo arrive, même sur une connexion qui la fait attendre dix secondes ;
 *  - `loading="lazy"` sur tout sauf les premières lignes ;
 *  - un plat épuisé reste affiché, grisé, prix barré : le client doit savoir ce qui existe.
 */
export const ItemRow = memo(function ItemRow({
  item,
  currency,
  onOpen,
}: {
  item: PublicMenuItem;
  currency: string;
  onOpen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const image = item.images[0];
  const soldOut = item.status === 'SOLD_OUT';
  const promo = item.promos[0];

  return (
    <button
      type="button"
      className="item-row"
      data-sold={soldOut}
      onClick={onOpen}
      aria-label={item.name}
    >
      <span className="thumb">
        {image ? (
          <picture>
            <source srcSet={`${image.thumb} 160w, ${image.medium} 480w`} sizes="92px" type="image/webp" />
            <img
              src={image.fallback}
              alt=""
              width={92}
              height={92}
              loading="lazy"
              decoding="async"
            />
          </picture>
        ) : (
          <span aria-hidden className="text-[26px] opacity-40">
            {'•'}
          </span>
        )}
        {soldOut ? <span className="badge-sold">{t('soldOut')}</span> : null}
      </span>

      <span className="min-w-0 flex flex-col">
        <span className="flex gap-[10px] items-start justify-between">
          <h3 className="item-name m-0 text-[15.5px] font-semibold leading-[1.3] tracking-[-0.005em]">
            {item.name}
          </h3>
          <span className="price">
            {item.hasVariants ? <span className="from">{t('from')}</span> : null}
            <span className="price-value">{formatAmount(item.fromPrice)}</span>
            <span className="cur">{currencySymbol(currency)}</span>
          </span>
        </span>

        {item.description ? (
          <p
            className="mt-[5px] text-[13.2px] leading-[1.45] line-clamp-2"
            style={{ color: 'var(--muted)' }}
          >
            {item.description}
          </p>
        ) : null}

        {item.badge || promo || item.prepMinutes || item.isPerPerson ? (
          <span className="flex flex-wrap gap-[6px] mt-[9px]">
            {item.badge ? <span className="tag tag-hot">{item.badge}</span> : null}
            {promo ? <span className="tag tag-promo">{promo.label}</span> : null}
            {item.isPerPerson ? <span className="tag tag-plain">{t('perPerson')}</span> : null}
            {item.prepMinutes ? (
              <span className="tag tag-plain">{t('minutes', { count: item.prepMinutes })}</span>
            ) : null}
          </span>
        ) : null}
      </span>
    </button>
  );
});
