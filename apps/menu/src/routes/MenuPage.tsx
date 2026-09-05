import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { PublicMenuItem, PublicMenuResponse } from '@evolyx/shared';

import { MenuNotFound, MenuUnavailable, fetchMenu, readSnapshot, saveSnapshot } from '../lib/api';
import { applyTheme, coverStyle } from '../lib/theme';
import { loadDisplayFont } from '../lib/fonts';
import { OfflineBanner } from '../components/OfflineBanner';
import { CategoryNav } from '../components/CategoryNav';
import { ItemRow } from '../components/ItemRow';
import { ItemSheet } from '../components/ItemSheet';
import { InfoFooter } from '../components/InfoFooter';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { StatusPill } from '../components/StatusPill';
import { MomentBanner } from '../components/MomentBanner';
import { MenuSkeleton } from '../components/MenuSkeleton';
import { ErrorScreen } from '../components/ErrorScreen';

export function MenuPage(): JSX.Element {
  const { slug } = useParams({ from: '/r/$slug' });
  const { t: tableCode, locale: forcedLocale } = useSearch({ from: '/r/$slug' });
  const { t, i18n } = useTranslation();

  const [locale, setLocale] = useState<string | undefined>(forcedLocale);
  const [selected, setSelected] = useState<PublicMenuItem | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  /** Réveil périodique : un menu laissé ouvert doit finir par se signaler comme daté. */
  const [, setTick] = useState(0);

  /* Une seule requête peint toute la page. */
  const query = useQuery({
    queryKey: ['menu', slug, locale ?? 'default'],
    queryFn: () => fetchMenu(slug, locale),
    // La dernière carte connue s'affiche immédiatement, avant même la réponse réseau.
    initialData: () => readSnapshot(slug, locale ?? 'default')?.payload,
    initialDataUpdatedAt: () => {
      const saved = readSnapshot(slug, locale ?? 'default')?.savedAt;
      return saved ? new Date(saved).getTime() : undefined;
    },
  });

  const menu: PublicMenuResponse | undefined = query.data;

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const goOnline = (): void => setOnline(true);
    const goOffline = (): void => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (!menu) return;
    applyTheme(menu.restaurant.theme);
    void loadDisplayFont(menu.restaurant.theme.fontDisplay);
    void i18n.changeLanguage(menu.locale);
    document.title = menu.restaurant.name;
    saveSnapshot(slug, locale ?? 'default', menu);
  }, [menu, slug, locale, i18n]);

  const savedAt = useMemo(
    () => readSnapshot(slug, locale ?? 'default')?.savedAt ?? null,
    [slug, locale, menu],
  );

  /**
   * Quand faut-il prévenir que la carte n'est peut-être plus à jour ?
   *
   * Pas sur `navigator.onLine` : il dit seulement qu'une interface réseau est active. Le cas
   * courant ici est le Wi-Fi du restaurant sans lien Internet — il répond « oui » alors que
   * rien ne passe. Pas davantage sur l'échec de la requête : le service worker sert sa copie
   * et la requête réussit.
   *
   * Le signal fiable est l'âge de la réponse. Le serveur horodate chaque menu (`generatedAt`)
   * et ne le garde que trente secondes ; une carte calculée il y a plus de cinq minutes vient
   * forcément d'un cache — service worker, cache HTTP ou instantané local, peu importe lequel.
   */
  const STALE_AFTER_MS = 5 * 60 * 1000;
  const age = menu ? Date.now() - new Date(menu.generatedAt).getTime() : 0;
  const servingSnapshot =
    Boolean(savedAt) && (!online || query.isError || age > STALE_AFTER_MS);

  /* Défilement vers une catégorie, sans dépendance ni calcul au scroll. */
  const sections = useRef(new Map<string, HTMLElement>());
  const scrollTo = (categoryId: string): void => {
    sections.current.get(categoryId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (query.isLoading && !menu) return <MenuSkeleton />;

  if (!menu) {
    const error = query.error;
    return (
      <ErrorScreen
        title={error instanceof MenuNotFound ? t('notFound') : t('notFoundHelp')}
        detail={error instanceof MenuUnavailable ? error.message : t('notFoundHelp')}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { restaurant, opening, categories, moment } = menu;

  return (
    <div className="shell">
      {servingSnapshot && savedAt ? <OfflineBanner savedAt={menu.generatedAt} /> : null}

      <header className="cover reveal" style={coverStyle(restaurant.coverUrl)}>
        {!restaurant.coverUrl ? <div className="cover-grid" /> : null}
        {restaurant.enabledLocales.length > 1 ? (
          <LanguageSwitch
            locales={restaurant.enabledLocales}
            current={menu.locale}
            onChange={setLocale}
          />
        ) : null}
      </header>

      <section className="relative -mt-[46px] z-[2] px-5 pb-[18px]">
        <div className="logo-badge reveal" style={{ animationDelay: '.05s' }}>
          {restaurant.logoUrl ? (
            <img src={restaurant.logoUrl} alt="" width={88} height={88} />
          ) : (
            restaurant.name.charAt(0).toUpperCase()
          )}
        </div>

        <h1 className="title-display mt-4 reveal" style={{ animationDelay: '.09s' }}>
          {restaurant.name}
        </h1>

        {restaurant.tagline ? (
          <p
            className="mt-[7px] text-[14.5px] max-w-[34ch] reveal"
            style={{ color: 'var(--muted)', animationDelay: '.13s' }}
          >
            {restaurant.tagline}
          </p>
        ) : null}

        <div className="mt-[14px] reveal" style={{ animationDelay: '.17s' }}>
          <StatusPill opening={opening} />
        </div>
      </section>

      {moment ? <MomentBanner text={moment} /> : null}

      <CategoryNav categories={categories} onSelect={scrollTo} />

      <main className="px-5 pb-10">
        {categories.map((category) => (
          <section
            key={category.id}
            id={`cat-${category.id}`}
            className="pt-[30px] scroll-mt-16"
            ref={(node) => {
              if (node) sections.current.set(category.id, node);
              else sections.current.delete(category.id);
            }}
          >
            <div className="flex items-baseline gap-3 mb-1">
              <h2 className="cat-title m-0">{category.name}</h2>
              <span className="rule-line" />
            </div>

            <div className="mt-[10px]">
              {category.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  currency={restaurant.currency}
                  onOpen={() => setSelected(item)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      <InfoFooter restaurant={restaurant} opening={opening} tableCode={tableCode} />

      <ItemSheet
        item={selected}
        currency={restaurant.currency}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
