import { useState, type JSX } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Drawer, Field, Input, Select, Textarea, useToast } from '@evolyx/ui';
import { COMMON_ALLERGENS, resolveI18n } from '@evolyx/shared';
import { ApiRequestError, api } from '../../lib/api';
import { GalleryPlaceholder, ImageGallery } from './ImageGallery';
import type { CategoryRow, ItemImage, ItemRow } from './types';

/**
 * Fiche d'un plat.
 *
 * Le panneau suit l'ordre dans lequel on renseigne un plat quand on l'a en tête : ce que
 * c'est, combien ça coûte, à quoi ça ressemble, et ce qu'il faut signaler. Les photos sont
 * juste sous le prix parce que c'est ce qui manque le plus souvent — les laisser en bas de
 * formulaire, c'est s'assurer qu'elles n'y seront jamais.
 */
export function ItemDrawer({
  item,
  categories,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  /** `null` pour une création. */
  item: ItemRow | null;
  categories: CategoryRow[];
  defaultCategoryId?: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const toast = useToast();

  const [name, setName] = useState(resolveI18n(item?.name ?? null));
  const [description, setDescription] = useState(resolveI18n(item?.description ?? null));
  const [categoryId, setCategoryId] = useState(
    item?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? '',
  );
  const [priceMode, setPriceMode] = useState<'simple' | 'variants'>(
    item && item.variants.length > 0 ? 'variants' : 'simple',
  );
  const [basePrice, setBasePrice] = useState(String(item?.basePrice ?? ''));
  const [variants, setVariants] = useState(
    item?.variants.map((variant) => ({ name: resolveI18n(variant.name), price: String(variant.price) })) ?? [
      { name: 'Petit', price: '' },
      { name: 'Grand', price: '' },
    ],
  );
  const [supplements, setSupplements] = useState(
    item?.supplements.map((s) => ({ name: resolveI18n(s.name), price: String(s.price) })) ?? [],
  );
  const [prepMinutes, setPrepMinutes] = useState(String(item?.prepMinutes ?? ''));
  const [allergens, setAllergens] = useState<string[]>(item?.allergens ?? []);
  const [badge, setBadge] = useState(resolveI18n(item?.badge ?? null));
  const [images, setImages] = useState<ItemImage[]>(item?.images ?? []);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      item ? api.patch(`/menu-items/${item.id}`, payload) : api.post('/menu-items', payload),
    onSuccess: async () => {
      toast.success(item ? 'Plat mis à jour.' : 'Plat créé.');
      await onSaved();
    },
    onError: (cause) =>
      setError(cause instanceof ApiRequestError ? cause.message : 'Enregistrement impossible.'),
  });

  const archive = useMutation({
    mutationFn: () => api.delete(`/menu-items/${item!.id}`),
    onSuccess: async () => {
      toast.success('Plat archivé.');
      await onSaved();
    },
    onError: (cause) =>
      setError(cause instanceof ApiRequestError ? cause.message : 'Archivage impossible.'),
  });

  const submit = (): void => {
    setError(null);

    const payload: Record<string, unknown> = {
      categoryId,
      name: { fr: name.trim() },
      description: description.trim() ? { fr: description.trim() } : {},
      badge: badge.trim() ? { fr: badge.trim() } : null,
      prepMinutes: prepMinutes ? Number(prepMinutes) : null,
      allergens,
      supplements: supplements
        .filter((s) => s.name.trim() && s.price)
        .map((s) => ({ name: { fr: s.name.trim() }, price: Number(s.price) })),
    };

    if (priceMode === 'simple') {
      if (!basePrice) {
        setError('Indiquez un prix, ou passez en plusieurs tailles.');
        return;
      }
      payload.basePrice = Number(basePrice);
      payload.variants = [];
    } else {
      const cleaned = variants
        .filter((variant) => variant.name.trim() && variant.price)
        .map((variant) => ({ name: { fr: variant.name.trim() }, price: Number(variant.price) }));
      if (cleaned.length === 0) {
        setError('Ajoutez au moins une taille, ou revenez au prix unique.');
        return;
      }
      payload.basePrice = null;
      payload.variants = cleaned;
    }

    save.mutate(payload);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={item ? resolveI18n(item.name) : 'Nouveau plat'}
      description={item ? 'Les changements de prix sont journalisés.' : undefined}
      width={560}
      footer={
        <>
          {item ? (
            <Button
              variant="danger"
              size="sm"
              className="mr-auto"
              loading={archive.isPending}
              onClick={() => archive.mutate()}
            >
              Archiver
            </Button>
          ) : null}
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={name.trim().length < 2}
            onClick={submit}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <Field label="Nom du plat" required>
        {(id) => (
          <Input
            id={id}
            autoFocus
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            placeholder="Poulet braisé entier"
          />
        )}
      </Field>

      <Field label="Description" hint="Ce que vous diriez au client en le servant.">
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Mariné 12 h au gingembre, braisé lentement au charbon."
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
        hint="Un prix unique, ou plusieurs tailles (petit, moyen, grand) — mais pas les deux."
      >
        {() => (
          <>
            <div className="flex gap-2 mb-3">
              {(
                [
                  ['simple', 'Prix unique'],
                  ['variants', 'Plusieurs tailles'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`evx-btn evx-btn--sm ${priceMode === mode ? 'evx-btn--secondary' : 'evx-btn--ghost'}`}
                  onClick={() => setPriceMode(mode)}
                >
                  {label}
                </button>
              ))}
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
                  placeholder="4500"
                />
                <span style={{ color: 'var(--ink-3)' }}>FCFA</span>
              </div>
            ) : (
              <PriceRows
                rows={variants}
                onChange={setVariants}
                namePlaceholder="Taille"
                addLabel="Ajouter une taille"
              />
            )}
          </>
        )}
      </Field>

      <Field
        label="Photos"
        hint="La première s’affiche sur la carte, les suivantes dans la fiche du plat."
      >
        {() =>
          item ? (
            <ImageGallery itemId={item.id} images={images} onChange={setImages} />
          ) : (
            <GalleryPlaceholder />
          )
        }
      </Field>

      <Field
        label="Suppléments"
        hint="Ce que le client peut ajouter : miondo, plantains, œuf…"
      >
        {() => (
          <PriceRows
            rows={supplements}
            onChange={setSupplements}
            namePlaceholder="Supplément"
            addLabel="Ajouter un supplément"
            allowEmpty
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Préparation" hint="En minutes.">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={0}
              max={600}
              value={prepMinutes}
              onChange={(event) => setPrepMinutes(event.target.value)}
              placeholder="25"
            />
          )}
        </Field>

        <Field label="Pastille" hint="« Le plus commandé », « Nouveau »…">
          {(id) => (
            <Input
              id={id}
              value={badge}
              maxLength={40}
              onChange={(event) => setBadge(event.target.value)}
            />
          )}
        </Field>
      </div>

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
                      active ? current.filter((entry) => entry !== allergen) : [...current, allergen],
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
    </Drawer>
  );
}

/** Lignes « nom + prix » — mêmes gestes pour les tailles et pour les suppléments. */
function PriceRows({
  rows,
  onChange,
  namePlaceholder,
  addLabel,
  allowEmpty,
}: {
  rows: { name: string; price: string }[];
  onChange: (rows: { name: string; price: string }[]) => void;
  namePlaceholder: string;
  addLabel: string;
  allowEmpty?: boolean;
}): JSX.Element {
  return (
    <div className="grid gap-2">
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={row.name}
            placeholder={namePlaceholder}
            onChange={(event) =>
              onChange(rows.map((entry, i) => (i === index ? { ...entry, name: event.target.value } : entry)))
            }
            aria-label={`${namePlaceholder} ${index + 1}`}
          />
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={row.price}
            placeholder="Prix"
            className="!w-32"
            onChange={(event) =>
              onChange(rows.map((entry, i) => (i === index ? { ...entry, price: event.target.value } : entry)))
            }
            aria-label={`Prix ${index + 1}`}
          />
          <button
            type="button"
            className="evx-btn evx-btn--ghost evx-btn--sm !px-2"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            aria-label="Retirer cette ligne"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {rows.length === 0 && allowEmpty ? (
        <p className="text-[12.5px] m-0" style={{ color: 'var(--ink-3)' }}>
          Aucun pour l’instant.
        </p>
      ) : null}

      <Button
        size="sm"
        variant="ghost"
        className="justify-self-start"
        onClick={() => onChange([...rows, { name: '', price: '' }])}
      >
        {addLabel}
      </Button>
    </div>
  );
}
