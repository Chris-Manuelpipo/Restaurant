import { useRef, useState, type FormEvent, type JSX } from 'react';
import { Button, Field, Input, SceneIdentity, useToast } from '@evolyx/ui';
import { api, mediaUrl } from '../lib/api';
import type { StepProps } from './types';

/**
 * Étape 1 — identité.
 *
 * L'adresse web se déduit du nom, tant que le gérant ne l'a pas touchée lui-même : c'est le
 * genre de champ qu'on ne veut pas avoir à remplir, mais qu'on veut pouvoir corriger.
 */
export function StepIdentity({ draft, onChange, onNext }: StepProps): JSX.Element {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [slugTouched, setSlugTouched] = useState(draft.slug !== slugify(draft.name));
  const [uploading, setUploading] = useState(false);

  const setName = (name: string): void => {
    onChange({ ...draft, name, ...(slugTouched ? {} : { slug: slugify(name) }) });
  };

  const uploadLogo = async (file: File): Promise<void> => {
    setUploading(true);
    try {
      const { logoUrl } = await api.upload<{ logoUrl: string }>('/restaurant/logo', file);
      onChange({ ...draft, logoUrl });
      toast.success('Logo enregistré.');
    } catch {
      toast.error("Le logo n'a pas pu être envoyé.");
    } finally {
      setUploading(false);
    }
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    void onNext({ name: draft.name, slug: draft.slug, tagline: draft.tagline });
  };

  return (
    <form id="step-identity" onSubmit={submit}>
      <SceneIdentity />
      <span className="eyebrow">Identité</span>
      <h1 className="page-title">Commençons par votre enseigne.</h1>
      <p className="page-lede">
        Ce nom apparaîtra en haut du menu de vos clients, et sur chaque code QR imprimé.
      </p>

      <Field label="Nom du restaurant" required>
        {(id) => (
          <Input
            id={id}
            required
            minLength={2}
            maxLength={80}
            value={draft.name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Le Braisé du Carrefour"
          />
        )}
      </Field>

      <Field
        label="Accroche"
        hint="Une phrase, sous le nom. Ce que vous diriez à un client qui passe devant."
      >
        {(id) => (
          <Input
            id={id}
            maxLength={140}
            value={draft.tagline ?? ''}
            onChange={(event) => onChange({ ...draft, tagline: event.target.value || null })}
            placeholder="Grillades au feu de bois, tous les soirs."
          />
        )}
      </Field>

      <Field
        label="Adresse web"
        required
        hint="L’adresse de votre menu. Choisissez-la bien : elle sera encodée dans vos codes QR."
      >
        {(id) => (
          <div className="flex items-center gap-2">
            <span className="text-[13px] shrink-0" style={{ color: 'var(--ink-3)' }}>
              menu.evolyx.cm /
            </span>
            <Input
              id={id}
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={draft.slug}
              onChange={(event) => {
                setSlugTouched(true);
                onChange({ ...draft, slug: slugify(event.target.value) });
              }}
            />
          </div>
        )}
      </Field>

      <Field label="Logo" hint="Carré de préférence. Il servira aussi au centre de vos codes QR.">
        {() => (
          <div className="flex items-center gap-4">
            <div
              className="w-[72px] h-[72px] rounded-[18px] grid place-items-center overflow-hidden shrink-0"
              style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}
            >
              {draft.logoUrl ? (
                <img src={mediaUrl(draft.logoUrl)!} alt="" className="w-full h-full object-cover" />
              ) : (
                <span
                  className="text-2xl font-bold"
                  style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-display)' }}
                >
                  {draft.name.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadLogo(file);
                }}
              />
              <Button
                type="button"
                size="sm"
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {draft.logoUrl ? 'Remplacer' : 'Choisir un fichier'}
              </Button>
              <p className="mt-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                PNG, JPEG ou WebP · 8 Mo maximum
              </p>
            </div>
          </div>
        )}
      </Field>
    </form>
  );
}

/** « Le Braisé du Carrefour » → « le-braise-du-carrefour ». */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
