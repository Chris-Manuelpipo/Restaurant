import { useMemo, useRef, useState, type JSX } from 'react';
import { Button, SearchInput, VisualGlyph, useToast } from '@evolyx/ui';
import {
  CATEGORY_ICONS,
  ICON_GROUP_LABELS,
  ICON_SVG_ATTRS,
  formatCategoryIcon,
  parseCategoryVisual,
  type CategoryIconKey,
  type CategoryVisual,
  type IconGroup,
} from '@evolyx/shared';
import { EMOJI_GROUP_LABELS, searchEmojis, type EmojiGroup } from '../lib/emojis';
import { mediaUrl } from '../lib/api';

/**
 * Choix du visuel d'une catégorie.
 *
 * Trois voies, dans l'ordre où un restaurateur les adopte :
 *  - **l'icône** — sobre, cohérente d'une catégorie à l'autre, c'est ce qui fait sérieux ;
 *  - **l'emoji** — immédiat, familier, souvent le premier réflexe ;
 *  - **la photo** — la plus parlante, mais il faut l'avoir prise.
 *
 * Le choix se voit tout de suite dans l'aperçu, à la taille réelle du menu client.
 */

type Tab = 'icon' | 'emoji' | 'photo';

export function VisualPicker({
  icon,
  imageUrl,
  name,
  onChange,
  onUpload,
  uploading,
}: {
  icon: string | null;
  imageUrl: string | null;
  name: string;
  /** Reçoit la valeur à écrire dans `icon`, et l'image à conserver ou non. */
  onChange: (next: { icon: string | null; imageUrl: string | null }) => void;
  /** Envoi du fichier ; renvoie l'URL servie par l'API. */
  onUpload?: (file: File) => Promise<string>;
  uploading?: boolean;
}): JSX.Element {
  const toast = useToast();
  const current = parseCategoryVisual(icon, imageUrl);
  const [tab, setTab] = useState<Tab>(() =>
    current.kind === 'image' ? 'photo' : current.kind === 'emoji' ? 'emoji' : 'icon',
  );
  const [query, setQuery] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const select = (visual: CategoryVisual): void => {
    onChange({
      icon: formatCategoryIcon(visual),
      // Choisir une icône ou un emoji retire la photo : un seul visuel à la fois.
      imageUrl: visual.kind === 'image' ? visual.url : null,
    });
  };

  const upload = async (file: File): Promise<void> => {
    if (!onUpload) return;
    try {
      const url = await onUpload(file);
      onChange({ icon: null, imageUrl: url });
    } catch {
      toast.error("La photo n'a pas pu être envoyée.");
    }
  };

  return (
    <div className="visual-picker">
      {/* Aperçu : exactement la taille qu'aura la vignette dans le menu du client. */}
      <div className="visual-picker__preview">
        <VisualGlyph visual={current} name={name} size={64} className="evx-glyph evx-glyph--lg" />
        <div className="min-w-0">
          <p className="m-0 text-[13px] font-semibold truncate">{name || 'Votre catégorie'}</p>
          <p className="m-0 text-[12px]" style={{ color: 'var(--ink-3)' }}>
            {describe(current)}
          </p>
          {current.kind !== 'none' ? (
            <button
              type="button"
              className="evx-btn evx-btn--ghost evx-btn--sm mt-1 !px-2"
              onClick={() => onChange({ icon: null, imageUrl: null })}
            >
              Retirer le visuel
            </button>
          ) : null}
        </div>
      </div>

      <div className="visual-picker__tabs">
        {(
          [
            ['icon', 'Icônes'],
            ['emoji', 'Emoji'],
            ['photo', 'Photo'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              setQuery('');
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== 'photo' ? (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={tab === 'icon' ? 'Chercher une icône…' : 'Chercher un emoji…'}
          autoFocusKey={null}
          className="mb-3"
        />
      ) : null}

      {tab === 'icon' ? <IconGrid query={query} current={current} onSelect={select} /> : null}
      {tab === 'emoji' ? <EmojiGrid query={query} current={current} onSelect={select} /> : null}

      {tab === 'photo' ? (
        <div className="visual-picker__photo">
          {imageUrl ? (
            <img src={mediaUrl(imageUrl)!} alt="" className="visual-picker__photo-preview" />
          ) : (
            <div className="visual-picker__photo-empty">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="2" />
                <path d="m3 17 5-4 4 3 3-2 6 5" />
              </svg>
              <p>Une photo de vos plats vaut mieux qu’un pictogramme.</p>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = '';
            }}
          />
          <div className="flex gap-2 mt-3">
            <Button
              type="button"
              size="sm"
              loading={uploading}
              disabled={!onUpload}
              onClick={() => fileRef.current?.click()}
            >
              {imageUrl ? 'Remplacer la photo' : 'Choisir une photo'}
            </Button>
            {imageUrl ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange({ icon: null, imageUrl: null })}
              >
                Retirer
              </Button>
            ) : null}
          </div>
          {!onUpload ? (
            <p className="mt-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
              Enregistrez d’abord la catégorie : la photo pourra ensuite lui être rattachée.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ── Grilles ────────────────────────────────────────────────────────────── */

function IconGrid({
  query,
  current,
  onSelect,
}: {
  query: string;
  current: CategoryVisual;
  onSelect: (visual: CategoryVisual) => void;
}): JSX.Element {
  const groups = useMemo(() => {
    const needle = normalise(query);
    const entries = Object.entries(CATEGORY_ICONS).filter(
      ([key, definition]) =>
        !needle || normalise(`${definition.label} ${key}`).includes(needle),
    );

    const byGroup = new Map<IconGroup, [string, (typeof CATEGORY_ICONS)[string]][]>();
    for (const [key, definition] of entries) {
      const list = byGroup.get(definition.group) ?? [];
      list.push([key, definition]);
      byGroup.set(definition.group, list);
    }
    return [...byGroup.entries()];
  }, [query]);

  if (groups.length === 0) return <Empty />;

  return (
    <div className="visual-picker__scroll">
      {groups.map(([group, entries]) => (
        <section key={group}>
          <h4 className="visual-picker__group">{ICON_GROUP_LABELS[group]}</h4>
          <div className="visual-picker__grid">
            {entries.map(([key, definition]) => (
              <button
                key={key}
                type="button"
                className="visual-picker__cell"
                aria-pressed={current.kind === 'icon' && current.icon === key}
                title={definition.label}
                onClick={() => onSelect({ kind: 'icon', icon: key as CategoryIconKey })}
              >
                <svg
                  width="23"
                  height="23"
                  viewBox={ICON_SVG_ATTRS.viewBox}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap={ICON_SVG_ATTRS.strokeLinecap}
                  strokeLinejoin={ICON_SVG_ATTRS.strokeLinejoin}
                  dangerouslySetInnerHTML={{ __html: definition.svg }}
                />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EmojiGrid({
  query,
  current,
  onSelect,
}: {
  query: string;
  current: CategoryVisual;
  onSelect: (visual: CategoryVisual) => void;
}): JSX.Element {
  const groups = useMemo(() => {
    const found = searchEmojis(query);
    const byGroup = new Map<EmojiGroup, typeof found>();
    for (const entry of found) {
      const list = byGroup.get(entry.group) ?? [];
      list.push(entry);
      byGroup.set(entry.group, list);
    }
    return [...byGroup.entries()];
  }, [query]);

  if (groups.length === 0) return <Empty />;

  return (
    <div className="visual-picker__scroll">
      {groups.map(([group, entries]) => (
        <section key={group}>
          <h4 className="visual-picker__group">{EMOJI_GROUP_LABELS[group]}</h4>
          <div className="visual-picker__grid">
            {entries.map((entry) => (
              <button
                key={entry.emoji + entry.keywords}
                type="button"
                className="visual-picker__cell visual-picker__cell--emoji"
                aria-pressed={current.kind === 'emoji' && current.emoji === entry.emoji}
                title={entry.keywords.split(' ').slice(0, 3).join(', ')}
                onClick={() => onSelect({ kind: 'emoji', emoji: entry.emoji })}
              >
                {entry.emoji}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Empty(): JSX.Element {
  return (
    <p className="py-8 text-center text-[13px]" style={{ color: 'var(--ink-3)' }}>
      Rien ne correspond. Essayez « poisson », « boisson », « dessert »…
    </p>
  );
}

function describe(visual: CategoryVisual): string {
  switch (visual.kind) {
    case 'icon':
      return `Icône · ${CATEGORY_ICONS[visual.icon]?.label ?? visual.icon}`;
    case 'emoji':
      return 'Emoji';
    case 'image':
      return 'Photo';
    default:
      return 'Aucun visuel — l’initiale sera affichée';
  }
}

const normalise = (value: string): string =>
  value
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
