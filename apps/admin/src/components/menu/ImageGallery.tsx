import { useRef, useState, type JSX } from 'react';
import { useToast } from '@evolyx/ui';
import { api, mediaUrl } from '../../lib/api';
import type { ItemImage } from './types';

/**
 * Galerie de photos d'un plat.
 *
 * La **première** photo est celle qui apparaît sur la carte ; les suivantes n'apparaissent
 * que dans la fiche du plat, côté client. C'est dit explicitement sous la première vignette,
 * parce que c'est la seule chose qu'on ne devine pas — et l'ordre se change par glisser.
 */
export function ImageGallery({
  itemId,
  images,
  onChange,
}: {
  itemId: string;
  images: ItemImage[];
  onChange: (images: ItemImage[]) => void;
}): JSX.Element {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const upload = async (files: FileList): Promise<void> => {
    setBusy(true);
    try {
      let latest = images;
      // Une requête par fichier : l'API traite et dérive chaque image séparément.
      for (const file of Array.from(files).slice(0, 6)) {
        const updated = await api.upload<{ images: ItemImage[] }>(
          `/menu-items/${itemId}/images`,
          file,
        );
        latest = updated.images;
      }
      onChange(latest);
      toast.success(files.length > 1 ? 'Photos ajoutées.' : 'Photo ajoutée.');
    } catch {
      toast.error("La photo n'a pas pu être envoyée. Format accepté : JPEG, PNG ou WebP, 8 Mo max.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (imageId: string): Promise<void> => {
    try {
      const updated = await api.delete<{ images: ItemImage[] }>(
        `/menu-items/${itemId}/images/${imageId}`,
      );
      onChange(updated.images);
    } catch {
      toast.error('Suppression impossible.');
    }
  };

  const reorder = async (from: number, to: number): Promise<void> => {
    if (from === to) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onChange(next); // affichage immédiat, l'API confirme ensuite

    try {
      const updated = await api.post<{ images: ItemImage[] }>(
        `/menu-items/${itemId}/images/reorder`,
        { ids: next.map((image) => image.id) },
      );
      onChange(updated.images);
    } catch {
      onChange(images);
      toast.error("L'ordre n'a pas pu être enregistré.");
    }
  };

  return (
    <div>
      <div className="gallery">
        {images.map((image, index) => (
          <figure
            key={image.id}
            className="gallery__item"
            data-main={index === 0 || undefined}
            data-dragging={dragIndex === index || undefined}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) void reorder(dragIndex, index);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
          >
            <img src={mediaUrl(image.variants.medium)!} alt="" loading="lazy" />

            {index === 0 ? <figcaption>Sur la carte</figcaption> : null}

            <div className="gallery__actions">
              {index > 0 ? (
                <button
                  type="button"
                  onClick={() => void reorder(index, 0)}
                  title="Mettre en avant"
                  aria-label="Mettre cette photo sur la carte"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void remove(image.id)}
                title="Retirer"
                aria-label="Retirer cette photo"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </figure>
        ))}

        <button
          type="button"
          className="gallery__add"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <svg className="evx-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
          <span>{images.length === 0 ? 'Ajouter une photo' : 'Ajouter'}</span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files?.length) void upload(event.target.files);
          event.target.value = '';
        }}
      />

      <p className="mt-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
        {images.length > 1
          ? 'La première photo s’affiche sur la carte ; les autres dans la fiche du plat. Glissez pour changer l’ordre.'
          : 'Une deuxième photo apparaîtra dans la fiche du plat, côté client.'}
      </p>
    </div>
  );
}

/** Bouton d'envoi utilisé quand le plat n'existe pas encore et n'a donc pas d'identifiant. */
export function GalleryPlaceholder(): JSX.Element {
  return (
    <div className="gallery">
      <div className="gallery__pending">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="m3 17 5-4 4 3 3-2 6 5" />
        </svg>
        <span>Enregistrez le plat pour y ajouter des photos.</span>
      </div>
    </div>
  );
}
