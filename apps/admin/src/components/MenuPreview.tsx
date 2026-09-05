import { useQuery } from '@tanstack/react-query';
import { deriveTheme, formatAmount, type PublicMenuResponse, type ThemeInput } from '@evolyx/shared';
import type { JSX } from 'react';
import { API_URL } from '../lib/api';

/**
 * Aperçu client, dans un cadre de téléphone.
 *
 * Deux propriétés le rendent digne de confiance :
 *
 *  - il applique `deriveTheme()`, **la** fonction du menu client et des PDF. Ce que le gérant
 *    voit ici est ce que verra son client, au pixel de couleur près ;
 *  - il interroge le vrai endpoint public, avec le paramètre `at` : prévisualiser « dimanche
 *    à 11 h » fait réellement remonter le brunch, en passant par les mêmes règles de
 *    visibilité que le serveur appliquera dimanche prochain.
 */

export interface PreviewMoment {
  label: string;
  at: string | null;
}

/** Les trois instants que le gérant veut vérifier avant de publier. */
export function previewMoments(): PreviewMoment[] {
  const now = new Date();

  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
  nextSunday.setHours(11, 0, 0, 0);

  const nextFriday = new Date(now);
  nextFriday.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7));
  nextFriday.setHours(21, 0, 0, 0);

  return [
    { label: 'Maintenant', at: null },
    { label: 'Dimanche 11 h', at: nextSunday.toISOString() },
    { label: 'Vendredi 21 h', at: nextFriday.toISOString() },
  ];
}

export function MenuPreview({
  slug,
  theme,
  at,
  overrides,
}: {
  slug: string;
  /** Charte en cours d'édition : l'aperçu suit la frappe, sans attendre l'enregistrement. */
  theme?: Partial<ThemeInput>;
  at?: string | null;
  /** Champs modifiés mais pas encore enregistrés (nom, accroche). */
  overrides?: { name?: string; tagline?: string | null };
}): JSX.Element {
  const query = useQuery({
    queryKey: ['preview', slug, at ?? 'now'],
    queryFn: async (): Promise<PublicMenuResponse> => {
      const url = new URL(`/api/v1/public/r/${slug}/menu`, API_URL);
      if (at) url.searchParams.set('at', at);
      const response = await fetch(url);
      if (!response.ok) throw new Error('aperçu indisponible');
      return (await response.json()) as PublicMenuResponse;
    },
    staleTime: 5_000,
  });

  const menu = query.data;
  const derived = deriveTheme(theme ?? menu?.restaurant.theme ?? {});
  const vars = derived.vars;

  const screenStyle = {
    background: vars['--bg'],
    color: vars['--text'],
    fontFamily: vars['--font-body'],
  } as const;

  return (
    <div className="phone">
      <div className="phone__screen" style={screenStyle}>
        <div className="phone__notch" />

        <div style={{ height: 86, background: vars['--cover'] }} />

        <div className="px-[13px] pb-3 -mt-5 relative">
          <div
            className="w-10 h-10 rounded-[13px] grid place-items-center"
            style={{
              background: vars['--surface'],
              border: `1px solid ${vars['--line']}`,
              color: vars['--primary'],
              fontFamily: vars['--font-display'],
              fontSize: 17,
              boxShadow: '0 6px 14px rgb(0 0 0 / .25)',
            }}
          >
            {(overrides?.name ?? menu?.restaurant.name ?? 'R').charAt(0).toUpperCase()}
          </div>

          <h4
            className="mt-[9px] mb-0 text-[16px] font-semibold tracking-[-0.01em]"
            style={{ fontFamily: vars['--font-display'] }}
          >
            {overrides?.name ?? menu?.restaurant.name ?? 'Votre restaurant'}
          </h4>

          <p className="mt-[3px] mb-0 text-[9.5px]" style={{ color: vars['--muted'] }}>
            {overrides?.tagline ?? menu?.restaurant.tagline ?? 'Votre accroche apparaîtra ici.'}
          </p>

          {menu ? (
            <span
              className="inline-flex items-center gap-[5px] mt-2 px-2 py-[3px] rounded-full text-[8.5px]"
              style={{ background: vars['--surface'], border: `1px solid ${vars['--line']}` }}
            >
              <i
                className="w-[5px] h-[5px] rounded-full block"
                style={{ background: menu.opening.isOpen ? '#4ADE80' : '#F87171' }}
              />
              {menu.opening.isOpen ? 'Ouvert' : 'Fermé'}
              {menu.opening.nextChangeLabel ? ` · ${menu.opening.nextChangeLabel}` : ''}
            </span>
          ) : null}
        </div>

        {menu ? (
          <>
            {/* Toutes les catégories, pas seulement les premières : une règle de visibilité
                porte souvent sur une catégorie enfouie — le gérant doit pouvoir la vérifier. */}
            <div
              className="flex gap-[5px] px-[13px] py-[9px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ borderBottom: `1px solid ${vars['--line']}` }}
            >
              {menu.categories.map((category, index) => (
                <span
                  key={category.id}
                  className="px-[9px] py-1 rounded-full text-[8.5px] whitespace-nowrap"
                  style={
                    index === 0
                      ? { background: vars['--primary'], color: vars['--on-primary'], fontWeight: 600 }
                      : {
                          background: vars['--surface'],
                          border: `1px solid ${vars['--line']}`,
                          color: vars['--muted'],
                        }
                  }
                >
                  {category.name}
                </span>
              ))}
            </div>

            <div
              className="px-[13px] py-[11px] overflow-y-auto"
              style={{ maxHeight: 300, overscrollBehavior: 'contain' }}
            >
              {menu.categories.flatMap((category) =>
                category.items.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="grid gap-[9px] py-2"
                  style={{
                    gridTemplateColumns: '38px 1fr',
                    borderBottom: `1px solid ${vars['--line']}`,
                  }}
                >
                  <div
                    className="w-[38px] h-[38px] rounded-[9px]"
                    style={{
                      background: item.images[0]
                        ? `center / cover url(${API_URL}${item.images[0].thumb.replace(API_URL, '')})`
                        : vars['--tile'],
                      border: `1px solid ${vars['--line']}`,
                    }}
                  />
                  <div className="min-w-0">
                    <h5 className="m-0 text-[10.5px] font-semibold flex justify-between gap-2">
                      <span className="truncate">{item.name}</span>
                      <em className="not-italic tabular-nums shrink-0">
                        {item.hasVariants ? 'dès ' : ''}
                        {formatAmount(item.fromPrice)} F
                      </em>
                    </h5>
                    <p
                      className="mt-[3px] mb-0 text-[9px] leading-[1.35] line-clamp-2"
                      style={{ color: vars['--muted'] }}
                    >
                      {item.status === 'SOLD_OUT'
                        ? 'Épuisé'
                        : `${category.name} · ${item.description ?? ''}`}
                    </p>
                  </div>
                </div>
                )),
              )}
            </div>
          </>
        ) : (
          <div className="px-[13px] py-6 text-[10px]" style={{ color: vars['--muted'] }}>
            {query.isError ? 'Aperçu indisponible.' : 'Chargement de l’aperçu…'}
          </div>
        )}
      </div>
    </div>
  );
}
