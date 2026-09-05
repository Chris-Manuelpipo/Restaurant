import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { LocaleProvider, useTranslation } from '../lib/i18n';
import type { PublicMenuItem, PublicMenuResponse } from '@evolyx/shared';

import { MenuNotFound, MenuUnavailable, readSnapshot } from '../lib/api';
import { useMenu } from '../lib/useMenu';
import type { Route } from '../lib/router';
import { applyTheme } from '../lib/theme';
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
import { CategoryMark } from '../components/CategoryMark';

export function MenuPage({ route }: { route: Route }): JSX.Element {
  const slug = route.slug!;
  const tableCode = route.table;
  const { t } = useTranslation();

  const [locale, setLocale] = useState<string | undefined>(route.locale);
  const [selected, setSelected] = useState<PublicMenuItem | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  /**
   * L'heure courante vit dans l'état, réveillée chaque minute : un menu laissé ouvert doit
   * finir par se signaler comme daté, et un rendu ne doit jamais dépendre d'une valeur qui
   * change sans que React le sache.
   */
  const [now, setNow] = useState<number>(() => Date.now());

  /* Une seule requête peint toute la page ; la dernière carte connue s'affiche avant elle. */
  const query = useMenu(slug, locale);
  const menu: PublicMenuResponse | undefined = query.data;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
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
    document.title = menu.restaurant.name;
  }, [menu, slug, locale]);

  // `menu` est bien une dépendance : c'est son arrivée qui vient de réécrire l'instantané,
  // donc sa date d'enregistrement. La règle ne peut pas le voir, le commentaire le dit.
  const savedAt = useMemo(
    () => readSnapshot(slug, locale ?? 'default')?.savedAt ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const age = menu ? now - new Date(menu.generatedAt).getTime() : 0;
  const servingSnapshot =
    Boolean(savedAt) && (!online || Boolean(query.error) || age > STALE_AFTER_MS);

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
        onRetry={query.refetch}
      />
    );
  }

  const { restaurant, opening, categories, moment } = menu;

  return (
    <LocaleProvider value={menu.locale}>
    <div className="shell">
      {servingSnapshot && savedAt ? <OfflineBanner savedAt={menu.generatedAt} /> : null}

      <header className="cover reveal">
        {restaurant.coverUrl ? (
          <img
            src={restaurant.coverUrl}
            alt=""
            className="cover-photo"
            width={1280}
            height={640}
            decoding="async"
            fetchPriority="low"
            onLoad={(event) => event.currentTarget.classList.add('is-loaded')}
          />
        ) : (
          <div className="cover-grid" />
        )}
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
            <div className="flex items-center gap-3 mb-1">
              <span style={{ color: 'var(--primary)' }} className="flex items-center">
                <CategoryMark icon={category.icon} imageUrl={category.imageUrl} size={19} />
              </span>
              <h2 className="cat-title m-0">{category.name}</h2>
              <span className="rule-line" />
            </div>

            <div className="mt-[10px]">
              {category.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  currency={restaurant.currency}
                  categoryName={category.name}
                  categoryIcon={category.icon}
                  onOpen={() => setSelected(item)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      <InfoFooter restaurant={restaurant} opening={opening} tableCode={tableCode} />

      <ItemSheet
        key={selected?.id ?? 'none'}
        item={selected}
        currency={restaurant.currency}
        onClose={() => setSelected(null)}
      />
    </div>
    </LocaleProvider>
  );
}
