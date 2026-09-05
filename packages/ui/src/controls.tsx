import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';

const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ');

/* ═══════════════════════════════════════════════════════════════════════════
   Contrôles de navigation et de filtrage.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Bascule entre deux ou trois vues d'une même liste — densité, tri, filtre. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  label: string;
}): JSX.Element {
  return (
    <div className="evx-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          title={option.label}
        >
          {option.icon}
          <span className={option.icon ? 'sr-only sm:not-sr-only' : undefined}>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Champ de recherche.
 *
 * Le raccourci « / » y amène le curseur depuis n'importe où : dans un back-office qu'on
 * manipule toute la journée, chercher un plat doit coûter une touche.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Rechercher…',
  autoFocusKey = '/',
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  autoFocusKey?: string | null;
  className?: string;
}): JSX.Element {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocusKey) return;
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (event.key === autoFocusKey && !typing) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [autoFocusKey]);

  return (
    <div className={cx('evx-search', className)}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={input}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
      />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label="Effacer la recherche">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

/**
 * Panneau latéral.
 *
 * Préféré à une fenêtre modale pour l'édition : la liste reste visible derrière, et le gérant
 * garde le fil de ce qu'il était en train de faire. Sur un écran étroit, il occupe toute la
 * largeur — c'est alors une page à part entière, ce qui est le bon comportement.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}): JSX.Element | null {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Le panneau glisse : on le monte fermé, puis on l'ouvre à la frame suivante.
    const frame = requestAnimationFrame(() => setMounted(true));

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelAnimationFrame(frame);
      setMounted(false);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="evx-drawer" data-open={mounted}>
      <div className="evx-drawer__scrim" onClick={onClose} aria-hidden />
      <aside
        className="evx-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: width }}
      >
        <header className="evx-drawer__head">
          <div className="min-w-0">
            <h2 className="evx-drawer__title">{title}</h2>
            {description ? <p className="evx-drawer__desc">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="evx-modal__close" aria-label="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="evx-drawer__body">{children}</div>
        {footer ? <footer className="evx-drawer__foot">{footer}</footer> : null}
      </aside>
    </div>
  );
}

/** Fil d'Ariane — deux niveaux suffisent ici, et le premier est cliquable. */
export function Breadcrumb({
  items,
}: {
  items: { label: string; onClick?: () => void }[];
}): JSX.Element {
  return (
    <nav className="evx-crumb" aria-label="Fil d’Ariane">
      {items.map((item, index) => (
        <span key={item.label}>
          {index > 0 ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="m9 6 6 6-6 6" />
            </svg>
          ) : null}
          {item.onClick ? (
            <button type="button" onClick={item.onClick}>
              {item.label}
            </button>
          ) : (
            <b>{item.label}</b>
          )}
        </span>
      ))}
    </nav>
  );
}
