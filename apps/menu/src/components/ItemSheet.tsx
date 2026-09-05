import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from '../lib/i18n';
import { formatMoney, type PublicMenuItem } from '@evolyx/shared';

/**
 * Fiche détaillée d'un plat, en feuille montante.
 *
 * Le lot 1 ne prend aucune commande : la feuille informe, elle n'ajoute rien à un panier.
 * Les variantes et suppléments sont pourtant sélectionnables — le total affiché aide le
 * client à décider, et c'est exactement l'état que le module Commande reprendra.
 */
export function ItemSheet({
  item,
  currency,
  onClose,
}: {
  item: PublicMenuItem | null;
  currency: string;
  onClose: () => void;
}): JSX.Element | null {
  const { t } = useTranslation();
  // La feuille est montée avec `key={item.id}` : changer de plat la remonte, et l'état repart
  // proprement de zéro. C'est plus sûr qu'un effet qui remet les champs à leur valeur initiale.
  const [variantId, setVariantId] = useState<string | null>(item?.variants[0]?.id ?? null);
  const [extras, setExtras] = useState<Set<string>>(() => new Set());
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!item) return;
    closeRef.current?.focus();

    // La page derrière ne doit pas défiler pendant que la feuille est ouverte.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [item, onClose]);

  if (!item) return null;

  const variant = item.variants.find((v) => v.id === variantId);
  const base = variant?.price ?? item.basePrice ?? item.fromPrice;
  const total =
    base + item.supplements.filter((s) => extras.has(s.id)).reduce((sum, s) => sum + s.price, 0);

  const toggleExtra = (id: string): void => {
    setExtras((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const image = item.images[0];

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden />
      <aside
        className="sheet"
        data-open="true"
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
      >
        <div className="grip" />

        <div
          className="h-[172px] mx-[14px] mt-[14px] rounded-2xl relative overflow-hidden"
          style={{ background: 'var(--cover)' }}
        >
          {image ? (
            <picture>
              <source
                srcSet={`${image.medium} 480w, ${image.large} 960w`}
                sizes="(max-width: 520px) 100vw, 492px"
                type="image/webp"
              />
              <img
                src={image.fallback}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                width={image.width}
                height={image.height}
              />
            </picture>
          ) : null}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('closeSheet')}
            className="absolute top-3 right-3 h-11 w-11 rounded-full grid place-items-center backdrop-blur-md"
            style={{ background: 'color-mix(in oklab, var(--bg) 55%, transparent)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <h2
            className="m-0 text-[25px] font-semibold tracking-[-0.015em]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {item.name}
          </h2>

          {item.description ? (
            <p className="mt-[9px] text-sm leading-[1.55]" style={{ color: 'var(--muted)' }}>
              {item.description}
            </p>
          ) : null}

          {item.variants.length > 0 ? (
            <div className="mt-[22px]">
              <Group title={t('size')} note={t('required')} />
              <div role="radiogroup" aria-label={t('size')}>
                {item.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={v.id === variantId}
                    className="opt"
                    onClick={() => setVariantId(v.id)}
                  >
                    <span className="radio" aria-hidden />
                    <span className="flex-1 text-[14.5px] font-medium">{v.name}</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatMoney(v.price, currency)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {item.supplements.length > 0 ? (
            <div className="mt-[22px]">
              <Group title={t('supplements')} note={t('optional')} />
              {item.supplements.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={extras.has(s.id)}
                  data-selected={extras.has(s.id)}
                  className="opt"
                  onClick={() => toggleExtra(s.id)}
                >
                  <span className="check" aria-hidden>
                    {extras.has(s.id) ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                        <path d="m5 13 4 4L19 7" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="flex-1 text-[14.5px] font-medium">{s.name}</span>
                  <span className="text-sm font-semibold tabular-nums">
                    + {formatMoney(s.price, currency)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {item.allergens.length > 0 ? (
            <div className="mt-[22px]">
              <Group title={t('allergens')} />
              <div className="flex flex-wrap gap-[6px]">
                {item.allergens.map((allergen) => (
                  <span key={allergen} className="tag">
                    {allergen}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div
          className="sticky bottom-0 px-5 pt-4 flex items-center justify-between gap-4"
          style={{
            paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
            background: 'linear-gradient(180deg, transparent, var(--surface) 22%)',
          }}
        >
          <div>
            <small
              className="block text-[11px] font-medium uppercase tracking-[0.07em]"
              style={{ color: 'var(--muted)' }}
            >
              {t('price')}
            </small>
            <span
              className="text-2xl font-semibold tabular-nums"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {formatMoney(total, currency)}
            </span>
          </div>
          <p className="text-[12.5px] text-right max-w-[19ch] leading-[1.4]" style={{ color: 'var(--muted)' }}>
            {t('orderWithServer')}
          </p>
        </div>
      </aside>
    </>
  );
}

function Group({ title, note }: { title: string; note?: string }): JSX.Element {
  return (
    <div className="flex items-baseline justify-between mb-[10px]">
      <h3
        className="m-0 text-xs font-bold uppercase tracking-[0.1em]"
        style={{ color: 'var(--muted)' }}
      >
        {title}
      </h3>
      {note ? (
        <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
          {note}
        </span>
      ) : null}
    </div>
  );
}
