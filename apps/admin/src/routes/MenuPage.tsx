import { useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spin,
  Textarea,
  useToast,
} from '@evolyx/ui';
import {
  COMMON_ALLERGENS,
  formatAmount,
  resolveI18n,
  type I18nText,
  type ItemStatus,
} from '@evolyx/shared';
import { ApiRequestError, api, mediaUrl } from '../lib/api';
import { useSession } from '../lib/session';
import { PageHeader } from '../components/PageHeader';

/**
 * La carte — l'écran ouvert le plus souvent.
 *
 * Deux gestes doivent tenir en un clic, depuis un téléphone, en plein service :
 * marquer un plat épuisé, et corriger un prix. Tout le reste (créer, décrire, photographier)
 * se fait au calme, et peut prendre le temps d'une fenêtre.
 */

interface CategoryRow {
  id: string;
  name: I18nText;
  icon: string | null;
  position: number;
  isVisible: boolean;
  archivedAt: string | null;
  _count?: { menuItems: number };
}

interface ItemRow {
  id: string;
  categoryId: string;
  name: I18nText;
  description: I18nText | null;
  basePrice: number | null;
  prepMinutes: number | null;
  allergens: string[];
  badge: I18nText | null;
  status: ItemStatus;
  position: number;
  archivedAt: string | null;
  variants: { id: string; name: I18nText; price: number }[];
  supplements: { id: string; name: I18nText; price: number }[];
  images: { id: string; variants: { thumb: string } }[];
}

export function MenuPage(): JSX.Element {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = useSession();

  const [editing, setEditing] = useState<ItemRow | 'new' | null>(null);
  const [categoryModal, setCategoryModal] = useState<CategoryRow | 'new' | null>(null);
  const [filter, setFilter] = useState<'all' | 'sold_out'>('all');

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
      toast.success(
        status === 'SOLD_OUT' ? 'Plat marqué épuisé.' : 'Plat de nouveau disponible.',
      );
      void invalidate();
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.delete(`/menu-items/${id}`),
    onSuccess: async () => {
      toast.success('Plat archivé.');
      await invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : 'Archivage impossible.'),
  });

  const byCategory = useMemo(() => {
    const map = new Map<string, ItemRow[]>();
    for (const item of items.data ?? []) {
      if (filter === 'sold_out' && item.status !== 'SOLD_OUT') continue;
      const list = map.get(item.categoryId) ?? [];
      list.push(item);
      map.set(item.categoryId, list);
    }
    return map;
  }, [items.data, filter]);

  if (categories.isLoading || items.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spin />
      </div>
    );
  }

  const soldOutCount = (items.data ?? []).filter((item) => item.status === 'SOLD_OUT').length;
  const writable = can('menu:write');

  return (
    <>
      <PageHeader
        title="La carte"
        lede="Marquez un plat épuisé d’un geste : votre menu client suit en moins d’une minute."
        actions={
          writable ? (
            <>
              <Button size="sm" onClick={() => setCategoryModal('new')}>
                Nouvelle catégorie
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setEditing('new')}
                disabled={(categories.data?.length ?? 0) === 0}
              >
                Nouveau plat
              </Button>
            </>
          ) : null
        }
      />

      <div className="page">
        <div className="flex items-center gap-2 mb-5">
          <button
            type="button"
            className={`evx-btn evx-btn--sm ${filter === 'all' ? 'evx-btn--secondary' : 'evx-btn--ghost'}`}
            onClick={() => setFilter('all')}
          >
            Tout ({items.data?.length ?? 0})
          </button>
          <button
            type="button"
            className={`evx-btn evx-btn--sm ${filter === 'sold_out' ? 'evx-btn--secondary' : 'evx-btn--ghost'}`}
            onClick={() => setFilter('sold_out')}
          >
            Épuisés ({soldOutCount})
          </button>
        </div>

        {(categories.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Votre carte est vide"
            description="Créez une première catégorie — Grillades, Boissons — puis ajoutez-y vos plats. Vous pouvez aussi coller votre carte entière depuis la mise en service."
            action={
              writable ? (
                <Button variant="primary" onClick={() => setCategoryModal('new')}>
                  Créer une catégorie
                </Button>
              ) : null
            }
          />
        ) : null}

        <div className="grid gap-5">
          {(categories.data ?? []).map((category) => {
            const list = byCategory.get(category.id) ?? [];
            if (filter === 'sold_out' && list.length === 0) return null;

            return (
              <section
                key={category.id}
                className="evx-card"
                aria-label={resolveI18n(category.name)}
              >
                <header className="evx-card__head">
                  <div className="flex items-center gap-3">
                    {category.icon ? <span className="text-lg">{category.icon}</span> : null}
                    <div>
                      <h2 className="evx-card__title">{resolveI18n(category.name)}</h2>
                      <p className="evx-card__desc">
                        {list.length} plat{list.length > 1 ? 's' : ''}
                        {category.isVisible ? '' : ' · masquée du menu'}
                      </p>
                    </div>
                  </div>
                  {writable ? (
                    <div className="evx-card__actions">
                      <Button size="sm" variant="ghost" onClick={() => setCategoryModal(category)}>
                        Modifier
                      </Button>
                    </div>
                  ) : null}
                </header>

                <div>
                  {list.length === 0 ? (
                    <p className="px-4 py-6 text-[13px]" style={{ color: 'var(--ink-3)' }}>
                      Aucun plat dans cette catégorie.
                    </p>
                  ) : (
                    list.map((item) => (
                      <div key={item.id} className="row">
                        <div
                          className="w-11 h-11 rounded-[9px] shrink-0 overflow-hidden"
                          style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}
                        >
                          {item.images[0] ? (
                            <img
                              src={mediaUrl(item.images[0].variants.thumb)!}
                              alt=""
                              className="w-full h-full object-cover"
                              width={44}
                              height={44}
                            />
                          ) : null}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate m-0">{resolveI18n(item.name)}</p>
                          <p
                            className="text-[12px] truncate m-0"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            {resolveI18n(item.description) || '—'}
                          </p>
                        </div>

                        {item.status === 'SOLD_OUT' ? <Badge tone="danger">Épuisé</Badge> : null}
                        {item.status === 'DISABLED' ? <Badge tone="neutral">Retiré</Badge> : null}

                        <span className="tabular-nums font-semibold shrink-0 w-24 text-right">
                          {item.basePrice !== null
                            ? `${formatAmount(item.basePrice)} F`
                            : `dès ${formatAmount(Math.min(...item.variants.map((v) => v.price)))} F`}
                        </span>

                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant={item.status === 'SOLD_OUT' ? 'primary' : 'secondary'}
                            loading={setStatus.isPending && setStatus.variables?.id === item.id}
                            onClick={() =>
                              setStatus.mutate({
                                id: item.id,
                                status: item.status === 'SOLD_OUT' ? 'AVAILABLE' : 'SOLD_OUT',
                              })
                            }
                          >
                            {item.status === 'SOLD_OUT' ? 'Remettre' : 'Épuisé'}
                          </Button>

                          {writable ? (
                            <Button size="sm" variant="ghost" onClick={() => setEditing(item)}>
                              Modifier
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {editing ? (
        <ItemModal
          item={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await invalidate();
          }}
          onArchive={
            editing !== 'new'
              ? () => {
                  archive.mutate(editing.id);
                  setEditing(null);
                }
              : undefined
          }
        />
      ) : null}

      {categoryModal ? (
        <CategoryModal
          category={categoryModal === 'new' ? null : categoryModal}
          onClose={() => setCategoryModal(null)}
          onSaved={async () => {
            setCategoryModal(null);
            await invalidate();
          }}
        />
      ) : null}
    </>
  );
}

/* ── Fenêtre d'édition d'un plat ────────────────────────────────────────── */

function ItemModal({
  item,
  categories,
  onClose,
  onSaved,
  onArchive,
}: {
  item: ItemRow | null;
  categories: CategoryRow[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onArchive?: () => void;
}): JSX.Element {
  const toast = useToast();
  const [name, setName] = useState(resolveI18n(item?.name ?? null));
  const [description, setDescription] = useState(resolveI18n(item?.description ?? null));
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? '');
  const [priceMode, setPriceMode] = useState<'simple' | 'variants'>(
    item && item.variants.length > 0 ? 'variants' : 'simple',
  );
  const [basePrice, setBasePrice] = useState(String(item?.basePrice ?? ''));
  const [variants, setVariants] = useState(
    item?.variants.map((v) => ({ name: resolveI18n(v.name), price: String(v.price) })) ?? [
      { name: 'Petit', price: '' },
      { name: 'Grand', price: '' },
    ],
  );
  const [prepMinutes, setPrepMinutes] = useState(String(item?.prepMinutes ?? ''));
  const [allergens, setAllergens] = useState<string[]>(item?.allergens ?? []);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      item ? api.patch(`/menu-items/${item.id}`, payload) : api.post('/menu-items', payload),
    onSuccess: async () => {
      toast.success(item ? 'Plat mis à jour.' : 'Plat créé.');
      await onSaved();
    },
    onError: (cause) => {
      setError(cause instanceof ApiRequestError ? cause.message : 'Enregistrement impossible.');
    },
  });

  const submit = (): void => {
    setError(null);

    const payload: Record<string, unknown> = {
      categoryId,
      name: { fr: name.trim() },
      description: description.trim() ? { fr: description.trim() } : {},
      prepMinutes: prepMinutes ? Number(prepMinutes) : null,
      allergens,
    };

    if (priceMode === 'simple') {
      payload.basePrice = Number(basePrice);
      payload.variants = [];
    } else {
      const cleaned = variants
        .filter((variant) => variant.name.trim() && variant.price)
        .map((variant) => ({ name: { fr: variant.name.trim() }, price: Number(variant.price) }));
      if (cleaned.length === 0) {
        setError('Ajoutez au moins une variante, ou passez en prix unique.');
        return;
      }
      payload.basePrice = null;
      payload.variants = cleaned;
    }

    save.mutate(payload);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? resolveI18n(item.name) : 'Nouveau plat'}
      description={item ? 'Les changements de prix sont journalisés.' : undefined}
      width={560}
      footer={
        <>
          {onArchive ? (
            <Button variant="danger" size="sm" onClick={onArchive} className="mr-auto">
              Archiver
            </Button>
          ) : null}
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            Enregistrer
          </Button>
        </>
      }
    >
      <Field label="Nom du plat" required>
        {(id) => (
          <Input id={id} value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        )}
      </Field>

      <Field label="Description">
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ce que vous diriez au client en le servant."
          />
        )}
      </Field>

      <Field label="Catégorie" required>
        {(id) => (
          <Select id={id} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {resolveI18n(category.name)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        label="Prix"
        hint="Un prix unique, ou des variantes (petit, moyen, grand) — mais pas les deux."
      >
        {() => (
          <>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                className={`evx-btn evx-btn--sm ${priceMode === 'simple' ? 'evx-btn--secondary' : 'evx-btn--ghost'}`}
                onClick={() => setPriceMode('simple')}
              >
                Prix unique
              </button>
              <button
                type="button"
                className={`evx-btn evx-btn--sm ${priceMode === 'variants' ? 'evx-btn--secondary' : 'evx-btn--ghost'}`}
                onClick={() => setPriceMode('variants')}
              >
                Plusieurs tailles
              </button>
            </div>

            {priceMode === 'simple' ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={basePrice}
                  onChange={(event) => setBasePrice(event.target.value)}
                  className="!w-40"
                  aria-label="Prix en francs"
                />
                <span style={{ color: 'var(--ink-3)' }}>FCFA</span>
              </div>
            ) : (
              <div className="grid gap-2">
                {variants.map((variant, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={variant.name}
                      placeholder="Taille"
                      onChange={(event) =>
                        setVariants((current) =>
                          current.map((row, i) =>
                            i === index ? { ...row, name: event.target.value } : row,
                          ),
                        )
                      }
                      aria-label={`Nom de la variante ${index + 1}`}
                    />
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={variant.price}
                      placeholder="Prix"
                      className="!w-32"
                      onChange={(event) =>
                        setVariants((current) =>
                          current.map((row, i) =>
                            i === index ? { ...row, price: event.target.value } : row,
                          ),
                        )
                      }
                      aria-label={`Prix de la variante ${index + 1}`}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setVariants((current) => current.filter((_, i) => i !== index))}
                      aria-label="Retirer cette variante"
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setVariants((current) => [...current, { name: '', price: '' }])}
                >
                  Ajouter une taille
                </Button>
              </div>
            )}
          </>
        )}
      </Field>

      <Field label="Temps de préparation" hint="En minutes. Laissez vide si cela n’a pas de sens.">
        {(id) => (
          <Input
            id={id}
            type="number"
            min={0}
            max={600}
            className="!w-32"
            value={prepMinutes}
            onChange={(event) => setPrepMinutes(event.target.value)}
          />
        )}
      </Field>

      <Field label="Allergènes">
        {() => (
          <div className="flex flex-wrap gap-2">
            {COMMON_ALLERGENS.map((allergen) => {
              const active = allergens.includes(allergen);
              return (
                <button
                  key={allergen}
                  type="button"
                  className={`evx-btn evx-btn--sm ${active ? 'evx-btn--secondary' : 'evx-btn--ghost'}`}
                  aria-pressed={active}
                  onClick={() =>
                    setAllergens((current) =>
                      active ? current.filter((a) => a !== allergen) : [...current, allergen],
                    )
                  }
                >
                  {allergen}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      {error ? (
        <p
          className="mt-4 p-3 rounded-[10px] text-[13px]"
          role="alert"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
        >
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

/* ── Fenêtre d'édition d'une catégorie ──────────────────────────────────── */

function CategoryModal({
  category,
  onClose,
  onSaved,
}: {
  category: CategoryRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const toast = useToast();
  const [name, setName] = useState(resolveI18n(category?.name ?? null));
  const [icon, setIcon] = useState(category?.icon ?? '');
  const [isVisible, setIsVisible] = useState(category?.isVisible ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const payload = { name: { fr: name.trim() }, icon: icon || null, isVisible };
      return category
        ? api.patch(`/categories/${category.id}`, payload)
        : api.post('/categories', payload);
    },
    onSuccess: async () => {
      toast.success(category ? 'Catégorie mise à jour.' : 'Catégorie créée.');
      await onSaved();
    },
    onError: (cause) =>
      setError(cause instanceof ApiRequestError ? cause.message : 'Enregistrement impossible.'),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/categories/${category!.id}`),
    onSuccess: async () => {
      toast.success('Catégorie archivée.');
      await onSaved();
    },
    onError: (cause) =>
      setError(cause instanceof ApiRequestError ? cause.message : 'Archivage impossible.'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? resolveI18n(category.name) : 'Nouvelle catégorie'}
      footer={
        <>
          {category ? (
            <Button
              variant="danger"
              size="sm"
              className="mr-auto"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Archiver
            </Button>
          ) : null}
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <Field label="Nom" required>
        {(id) => (
          <Input
            id={id}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Grillades"
          />
        )}
      </Field>

      <Field label="Icône" hint="Un emoji, pour repérer la catégorie d’un coup d’œil.">
        {(id) => (
          <Input
            id={id}
            maxLength={4}
            className="!w-24 text-center text-xl"
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
            placeholder="🔥"
          />
        )}
      </Field>

      <Field label="Visible sur le menu">
        {() => (
          <label className="flex items-center gap-3 text-[13.5px]">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(event) => setIsVisible(event.target.checked)}
              style={{ accentColor: 'var(--accent)', width: 18, height: 18 }}
            />
            Les clients voient cette catégorie
          </label>
        )}
      </Field>

      {error ? (
        <p
          className="mt-4 p-3 rounded-[10px] text-[13px]"
          role="alert"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
        >
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
