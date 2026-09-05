import { useState, type JSX } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Drawer, Field, Input, Switch, useToast } from '@evolyx/ui';
import { resolveI18n } from '@evolyx/shared';
import { ApiRequestError, api } from '../../lib/api';
import { VisualPicker } from '../VisualPicker';
import type { CategoryRow } from './types';

/**
 * Création et modification d'une catégorie.
 *
 * En panneau latéral plutôt qu'en fenêtre modale : la carte reste visible derrière, et le
 * gérant ne perd pas le fil de ce qu'il regardait.
 */
export function CategoryDrawer({
  category,
  onClose,
  onSaved,
}: {
  /** `null` pour une création. */
  category: CategoryRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const toast = useToast();
  const [name, setName] = useState(resolveI18n(category?.name ?? null));
  const [icon, setIcon] = useState<string | null>(category?.icon ?? null);
  const [imageUrl, setImageUrl] = useState<string | null>(category?.imageUrl ?? null);
  const [isVisible, setIsVisible] = useState(category?.isVisible ?? true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: () => {
      const payload = { name: { fr: name.trim() }, icon, imageUrl, isVisible };
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

  const archive = useMutation({
    mutationFn: () => api.delete(`/categories/${category!.id}`),
    onSuccess: async () => {
      toast.success('Catégorie archivée.');
      await onSaved();
    },
    onError: (cause) =>
      setError(cause instanceof ApiRequestError ? cause.message : 'Archivage impossible.'),
  });

  /** L'envoi de photo exige une catégorie déjà enregistrée : elle porte l'identifiant. */
  const uploadImage = category
    ? async (file: File): Promise<string> => {
        setUploading(true);
        try {
          const updated = await api.upload<CategoryRow>(`/categories/${category.id}/image`, file);
          return updated.imageUrl ?? '';
        } finally {
          setUploading(false);
        }
      }
    : undefined;

  return (
    <Drawer
      open
      onClose={onClose}
      title={category ? resolveI18n(category.name) : 'Nouvelle catégorie'}
      description={
        category
          ? `${category._count?.menuItems ?? 0} plat(s) dans cette catégorie`
          : 'Grillades, Boissons, Desserts… le rangement que verront vos clients.'
      }
      width={520}
      footer={
        <>
          {category ? (
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
            onClick={() => save.mutate()}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <Field label="Nom de la catégorie" required>
        {(id) => (
          <Input
            id={id}
            autoFocus
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="Grillades"
          />
        )}
      </Field>

      <Field
        label="Visuel"
        hint="Une icône pour l’allure sobre, un emoji pour aller vite, une photo pour donner envie."
      >
        {() => (
          <VisualPicker
            icon={icon}
            imageUrl={imageUrl}
            name={name}
            uploading={uploading}
            onUpload={uploadImage}
            onChange={(next) => {
              setIcon(next.icon);
              setImageUrl(next.imageUrl);
            }}
          />
        )}
      </Field>

      <Field label="Visible sur le menu">
        {() => (
          <div className="flex items-center gap-3">
            <Switch
              checked={isVisible}
              onChange={setIsVisible}
              label="Visible sur le menu client"
            />
            <span className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
              {isVisible
                ? 'Vos clients voient cette catégorie.'
                : 'Masquée : ses plats disparaissent du menu client.'}
            </span>
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
