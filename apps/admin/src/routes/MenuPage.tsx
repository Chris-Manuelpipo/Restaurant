import { useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Breadcrumb,
  Button,
  CategoryGlyph,
  EmptyState,
  SearchInput,
  SegmentedControl,
  Spin,
  StatCard,
  StatRow,
  useToast,
} from '@evolyx/ui';
import { formatAmount, resolveI18n, type ItemStatus } from '@evolyx/shared';
import { ApiRequestError, api, mediaUrl } from '../lib/api';
import { useSession } from '../lib/session';
import { PageHeader } from '../components/PageHeader';
import { CategoryCard } from '../components/menu/CategoryCard';
import { CategoryDrawer } from '../components/menu/CategoryDrawer';
import { ItemDrawer } from '../components/menu/ItemDrawer';
import { ItemList } from '../components/menu/ItemList';
import { displayPrice, type CategoryRow, type ItemRow } from '../components/menu/types';

/**
 * La carte — l'écran le plus ouvert du back-office.
 *
 * Deux vues, et une seule idée : ne jamais afficher plus d'une catégorie de plats à la fois.
 * Une vraie carte compte des dizaines de plats ; les empiler tous dans une page revient à
 * demander au gérant de faire défiler pour trouver le poulet.
 *
 *   1. **Les catégories**, en cartes cliquables — chacune dit combien de plats elle contient,
 *      combien sont épuisés, et si le client la voit.
 *   2. **Les plats d'une catégorie**, en grille ou en liste, avec une barre de catégories qui
 *      permet de sauter à la suivante sans repasser par l'accueil.
 *
 * Et par-dessus les deux : une recherche qui traverse toute la carte, pour le cas — fréquent —
 * où l'on cherche un plat sans se souvenir de son rangement.
 */

type Density = 'grid' | 'list';
type Filter = 'all' | 'sold_out' | 'no_photo';

/** Pseudo-catégorie : « toute la carte », utilisée par les filtres transversaux. */
const ALL_CATEGORIES = '__all__';

const DENSITY_KEY = 'evolyx:menu-density';

/**
 * Tableaux vides **stables** : `?? []` produirait un nouveau tableau à chaque rendu, et tous
 * les `useMemo` qui en dépendent se recalculeraient pour rien — sur une carte de cent plats,
 * cela se voit.
 */
const NO_CATEGORIES: CategoryRow[] = [];
const NO_ITEMS: ItemRow[] = [];

export function MenuPage(): JSX.Element {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = useSession();
  const writable = can('menu:write');

  /* La catégorie ouverte : null = on est sur la vue des catégories. */
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [density, setDensity] = useState<Density>(() => readDensity());

  const [editingItem, setEditingItem] = useState<ItemRow | 'new' | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | 'new' | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<CategoryRow[]>('/categories'),
  });
  const items = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => api.get<ItemRow[]>('/menu-items'),
  });

  const invalidate = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['menu-items'] }),
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
      queryClient.invalidateQueries({ queryKey: ['preview'] }),
    ]);
  };

  /** Le geste du quotidien : un aller-retour, un retour visuel immédiat. */
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ItemStatus }) =>
      api.patch(`/menu-items/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['menu-items'] });
      const previous = queryClient.getQueryData<ItemRow[]>(['menu-items']);
      queryClient.setQueryData<ItemRow[]>(['menu-items'], (current) =>
        current?.map((item) => (item.id === id ? { ...item, status } : item)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(['menu-items'], context?.previous);
      toast.error("Le changement n'a pas été enregistré.");
    },
    onSuccess: (_data, { status }) => {
      toast.success(status === 'SOLD_OUT' ? 'Plat marqué épuisé.' : 'Plat de nouveau disponible.');
      void invalidate();
    },
  });

  const reorderCategories = useMutation({
    mutationFn: (ids: string[]) => api.post('/categories/reorder', { ids }),
    onSuccess: () => void invalidate(),
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : 'Réordonnancement impossible.'),
  });

  /* ── Données dérivées ───────────────────────────────────────────────────── */

  const allCategories = categories.data ?? NO_CATEGORIES;
  const allItems = items.data ?? NO_ITEMS;

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, ItemRow[]>();
    for (const item of allItems) {
      const list = map.get(item.categoryId) ?? [];
      list.push(item);
      map.set(item.categoryId, list);
    }
    return map;
  }, [allItems]);

  const stats = useMemo(() => {
    const soldOut = allItems.filter((item) => item.status === 'SOLD_OUT').length;
    const noPhoto = allItems.filter((item) => item.images.length === 0).length;
    const priced = allItems.map((item) => displayPrice(item).amount).filter((amount) => amount > 0);
    const average = priced.length
      ? Math.round(priced.reduce((sum, amount) => sum + amount, 0) / priced.length)
      : 0;
    return { total: allItems.length, soldOut, noPhoto, average, categories: allCategories.length };
  }, [allItems, allCategories]);

  const searching = search.trim().length > 0;

  const visibleItems = useMemo(() => {
    let list = searching
      ? allItems.filter((item) => matches(item, search))
      : openCategoryId === ALL_CATEGORIES
        ? allItems
        : (itemsByCategory.get(openCategoryId ?? '') ?? []);

    if (filter === 'sold_out') list = list.filter((item) => item.status === 'SOLD_OUT');
    if (filter === 'no_photo') list = list.filter((item) => item.images.length === 0);
    return list;
  }, [allItems, itemsByCategory, openCategoryId, search, searching, filter]);

  const openCategory = allCategories.find((category) => category.id === openCategoryId) ?? null;
  const crossCutting = openCategoryId === ALL_CATEGORIES;

  const categoryNameOf = (item: ItemRow): string | null => {
    const found = allCategories.find((category) => category.id === item.categoryId);
    return found ? resolveI18n(found.name) : null;
  };

  if (categories.isLoading || items.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spin label="Chargement de votre carte…" />
      </div>
    );
  }

  /* ── Vue « plats » — dans une catégorie, ou en résultat de recherche ────── */

  if (openCategory || searching || crossCutting) {
    return (
      <>
        <PageHeader
          title={openCategory ? resolveI18n(openCategory.name) : filterTitle(filter, searching)}
          lede={
            openCategory
              ? `${(itemsByCategory.get(openCategory.id) ?? []).length} plat(s) dans cette catégorie`
              : `${visibleItems.length} plat(s) dans toute la carte`
          }
          actions={
            writable ? (
              <Button size="sm" variant="primary" onClick={() => setEditingItem('new')}>
                Nouveau plat
              </Button>
            ) : null
          }
        />

        <div className="page page--wide">
          <div className="menu-toolbar">
            <Breadcrumb
              items={[
                {
                  label: 'La carte',
                  onClick: () => {
                    setOpenCategoryId(null);
                    setSearch('');
                    setFilter('all');
                  },
                },
                { label: openCategory ? resolveI18n(openCategory.name) : filterTitle(filter, searching) },
              ]}
            />

            <div className="flex items-center gap-2 flex-wrap">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Chercher un plat…"
                className="min-w-[240px] flex-1"
              />
              <SegmentedControl<Density>
                label="Densité d’affichage"
                value={density}
                onChange={(next) => {
                  setDensity(next);
                  writeDensity(next);
                }}
                options={[
                  {
                    value: 'grid',
                    label: 'Grille',
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" />
                        <rect x="14" y="14" width="7" height="7" rx="1.5" />
                      </svg>
                    ),
                  },
                  {
                    value: 'list',
                    label: 'Liste',
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    ),
                  },
                ]}
              />
            </div>
          </div>

          {/* Sauter d'une catégorie à l'autre sans revenir en arrière. */}
          {!searching && !crossCutting ? (
            <div className="cat-strip">
              {allCategories.map((category) => {
                const count = (itemsByCategory.get(category.id) ?? []).length;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-current={category.id === openCategoryId}
                    onClick={() => {
                      setOpenCategoryId(category.id);
                      setFilter('all');
                    }}
                  >
                    <CategoryGlyph
                      icon={category.icon}
                      imageUrl={mediaUrl(category.imageUrl)}
                      name={resolveI18n(category.name)}
                      size={22}
                      className="evx-glyph !border-0 !bg-transparent"
                    />
                    {resolveI18n(category.name)}
                    <span className="cat-strip__count">{count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {filter !== 'all' ? (
            <button
              type="button"
              className="evx-btn evx-btn--ghost evx-btn--sm mb-3"
              onClick={() => {
                setFilter('all');
                if (crossCutting) setOpenCategoryId(null);
              }}
            >
              ← Retirer le filtre « {filter === 'sold_out' ? 'épuisés' : 'sans photo'} »
            </button>
          ) : null}

          {visibleItems.length === 0 ? (
            <EmptyState
              title={searching ? 'Aucun plat ne correspond' : 'Cette catégorie est vide'}
              description={
                searching
                  ? 'Essayez un autre mot, ou vérifiez l’orthographe.'
                  : 'Ajoutez-y un premier plat — ou collez votre carte entière depuis la mise en service.'
              }
              action={
                writable && !searching ? (
                  <Button variant="primary" onClick={() => setEditingItem('new')}>
                    Ajouter un plat
                  </Button>
                ) : null
              }
            />
          ) : (
            <ItemList
              items={visibleItems}
              density={density}
              editable={writable || can('menu:status')}
              pendingId={setStatus.isPending ? setStatus.variables?.id : undefined}
              onToggleSoldOut={(item) =>
                setStatus.mutate({
                  id: item.id,
                  status: item.status === 'SOLD_OUT' ? 'AVAILABLE' : 'SOLD_OUT',
                })
              }
              onEdit={(item) => setEditingItem(item)}
              categoryNameOf={searching || crossCutting ? categoryNameOf : undefined}
            />
          )}
        </div>

        {renderDrawers()}
      </>
    );
  }

  /* ── Vue « catégories » ─────────────────────────────────────────────────── */

  return (
    <>
      <PageHeader
        title="La carte"
        lede="Choisissez une catégorie pour voir ses plats."
        actions={
          writable ? (
            <>
              <Button size="sm" onClick={() => setEditingCategory('new')}>
                Nouvelle catégorie
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setEditingItem('new')}
                disabled={allCategories.length === 0}
              >
                Nouveau plat
              </Button>
            </>
          ) : null
        }
      />

      <div className="page page--wide">
        <StatRow>
          <StatCard
            label="Plats à la carte"
            value={stats.total}
            hint={`${stats.categories} catégorie${stats.categories > 1 ? 's' : ''}`}
            tone="accent"
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 4h16v16H4zM4 9h16M9 9v11" />
              </svg>
            }
          />
          <StatCard
            label="Épuisés"
            value={stats.soldOut}
            hint={stats.soldOut > 0 ? 'Visibles, marqués épuisés' : 'Tout est disponible'}
            tone={stats.soldOut > 0 ? 'danger' : 'neutral'}
            onClick={stats.soldOut > 0 ? () => openFiltered('sold_out') : undefined}
            active={filter === 'sold_out'}
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="m8 8 8 8" />
              </svg>
            }
          />
          <StatCard
            label="Sans photo"
            value={stats.noPhoto}
            hint={stats.noPhoto > 0 ? 'Une photo fait vendre' : 'Toutes illustrées'}
            tone={stats.noPhoto > 0 ? 'warning' : 'neutral'}
            onClick={stats.noPhoto > 0 ? () => openFiltered('no_photo') : undefined}
            active={filter === 'no_photo'}
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="2" />
                <path d="m3 17 5-4 4 3 3-2 6 5" />
              </svg>
            }
          />
          <StatCard
            label="Prix moyen"
            value={stats.average > 0 ? `${formatAmount(stats.average)} F` : '—'}
            hint="Sur les plats affichés"
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
          />
        </StatRow>

        <div className="menu-toolbar mt-6">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Chercher un plat…  (touche /)"
            className="max-w-[420px]"
          />
        </div>

        {allCategories.length === 0 ? (
          <EmptyState
            title="Votre carte est vide"
            description="Créez une première catégorie — Grillades, Boissons — puis ajoutez-y vos plats. Vous pouvez aussi coller votre carte entière depuis la mise en service."
            action={
              writable ? (
                <Button variant="primary" onClick={() => setEditingCategory('new')}>
                  Créer une catégorie
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="cat-grid">
            {allCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                items={itemsByCategory.get(category.id) ?? []}
                editable={writable}
                dragging={dragId === category.id}
                onOpen={() => setOpenCategoryId(category.id)}
                onEdit={() => setEditingCategory(category)}
                dragHandlers={
                  writable
                    ? {
                        draggable: true,
                        onDragStart: () => setDragId(category.id),
                        onDragOver: (event) => event.preventDefault(),
                        onDrop: () => {
                          if (!dragId || dragId === category.id) return;
                          const ids = allCategories.map((entry) => entry.id);
                          const from = ids.indexOf(dragId);
                          const to = ids.indexOf(category.id);
                          const next = [...ids];
                          const [moved] = next.splice(from, 1);
                          next.splice(to, 0, moved!);
                          reorderCategories.mutate(next);
                        },
                        onDragEnd: () => setDragId(null),
                      }
                    : undefined
                }
              />
            ))}

            {writable ? (
              <button type="button" className="cat-card cat-card--add" onClick={() => setEditingCategory('new')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Nouvelle catégorie
              </button>
            ) : null}
          </div>
        )}
      </div>

      {renderDrawers()}
    </>
  );

  /* ── Fonctions locales ──────────────────────────────────────────────────── */

  /**
   * Cliquer sur « Épuisés » ou « Sans photo » ouvre la liste correspondante, toutes catégories
   * confondues : ce sont des questions transversales, pas des questions de rangement.
   */
  function openFiltered(next: Filter): void {
    setFilter(next);
    setOpenCategoryId(ALL_CATEGORIES);
  }

  function renderDrawers(): JSX.Element {
    return (
      <>
        {editingItem ? (
          <ItemDrawer
            item={editingItem === 'new' ? null : editingItem}
            categories={allCategories}
            defaultCategoryId={openCategoryId ?? undefined}
            onClose={() => setEditingItem(null)}
            onSaved={async () => {
              setEditingItem(null);
              await invalidate();
            }}
          />
        ) : null}

        {editingCategory ? (
          <CategoryDrawer
            category={editingCategory === 'new' ? null : editingCategory}
            onClose={() => setEditingCategory(null)}
            onSaved={async () => {
              setEditingCategory(null);
              await invalidate();
            }}
          />
        ) : null}
      </>
    );
  }
}

/* ── Utilitaires ──────────────────────────────────────────────────────────── */

function filterTitle(filter: Filter, searching: boolean): string {
  if (searching) return 'Recherche';
  if (filter === 'sold_out') return 'Plats épuisés';
  if (filter === 'no_photo') return 'Plats sans photo';
  return 'Toute la carte';
}

function matches(item: ItemRow, query: string): boolean {
  const needle = normalise(query);
  if (!needle) return true;
  return normalise(`${resolveI18n(item.name)} ${resolveI18n(item.description)}`).includes(needle);
}

const normalise = (value: string): string =>
  value
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

function readDensity(): Density {
  try {
    return localStorage.getItem(DENSITY_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

function writeDensity(density: Density): void {
  try {
    localStorage.setItem(DENSITY_KEY, density);
  } catch {
    /* stockage refusé : le réglage vaudra pour la session */
  }
}
