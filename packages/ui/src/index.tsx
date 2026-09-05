import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type JSX,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Composants du back-office.

   Peu nombreux, délibérément : un back-office de restaurant se manipule debout,
   en salle, souvent d'une main. Chaque composant vise donc la lisibilité et la
   taille de cible tactile avant la sophistication.
   ═══════════════════════════════════════════════════════════════════════════ */

export * from './illustrations';

const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

/* ── Bouton ─────────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, children, className, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx('evx-btn', `evx-btn--${variant}`, `evx-btn--${size}`, className)}
      disabled={disabled || loading}
      data-loading={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

function Spinner(): JSX.Element {
  return (
    <svg className="evx-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ── Champs de formulaire ───────────────────────────────────────────────── */

export interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: (id: string) => ReactNode;
}

/**
 * Un champ = un libellé, une aide facultative, un contrôle, une erreur.
 * L'identifiant est généré ici et transmis au contrôle : l'étiquette est toujours liée.
 */
export function Field({ label, hint, error, required, children }: FieldProps): JSX.Element {
  const id = useId();
  return (
    <div className="evx-field">
      {/* L'astérisque est posée en CSS : le nom accessible du champ reste « Nom du plat »,
          et non « Nom du plat * » — ce que lisent aussi bien un lecteur d'écran qu'un test. */}
      <label htmlFor={id} className={cx('evx-label', required && 'evx-label--required')}>
        {label}
      </label>
      {hint ? <p className="evx-hint">{hint}</p> : null}
      {children(id)}
      {error ? (
        <p className="evx-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx('evx-input', className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx('evx-input evx-textarea', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cx('evx-input evx-select', className)} {...rest}>
        {children}
      </select>
    );
  },
);

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="evx-switch"
    >
      <span className="evx-switch__knob" />
    </button>
  );
}

/* ── Surfaces ───────────────────────────────────────────────────────────── */

export function Card({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <section className={cx('evx-card', className)}>
      {title || actions ? (
        <header className="evx-card__head">
          <div>
            {title ? <h2 className="evx-card__title">{title}</h2> : null}
            {description ? <p className="evx-card__desc">{description}</p> : null}
          </div>
          {actions ? <div className="evx-card__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="evx-card__body">{children}</div>
    </section>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
}): JSX.Element {
  return <span className={cx('evx-badge', `evx-badge--${tone}`)}>{children}</span>;
}

/**
 * `icon` et `art` disent la même chose à deux volumes différents : `icon` est la pastille de
 * 52 px, `art` une illustration au trait de 150 px. Un écran vide qu'on croise souvent garde
 * la pastille ; un écran vide qui *demande une action* mérite le dessin. Quand les deux sont
 * passés, l'illustration gagne — c'est la plus explicite.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  art,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  art?: ReactNode;
}): JSX.Element {
  return (
    <div className="evx-empty">
      {art ? <div className="evx-empty__art">{art}</div> : null}
      {!art && icon ? <div className="evx-empty__icon">{icon}</div> : null}
      <h3 className="evx-empty__title">{title}</h3>
      {description ? <p className="evx-empty__desc">{description}</p> : null}
      {action ? <div className="evx-empty__action">{action}</div> : null}
    </div>
  );
}

/* ── Fenêtre modale ─────────────────────────────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="evx-modal">
      <div className="evx-modal__scrim" onClick={onClose} aria-hidden />
      <div
        className="evx-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: width }}
      >
        <header className="evx-modal__head">
          <div>
            <h2 className="evx-modal__title">{title}</h2>
            {description ? <p className="evx-modal__desc">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="evx-modal__close" aria-label="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="evx-modal__body">{children}</div>
        {footer ? <footer className="evx-modal__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

/* ── Notifications ──────────────────────────────────────────────────────── */

export interface Toast {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Retours d'action. Trois secondes, en bas d'écran : le gérant vient de marquer un plat
 * épuisé, il veut savoir que c'est fait — pas lire un roman.
 */
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast['tone']) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 3200);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="evx-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={cx('evx-toast', `evx-toast--${toast.tone}`)}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast doit être utilisé dans un ToastProvider.');
  return context;
}

/* ── Divers ─────────────────────────────────────────────────────────────── */

export function Spin({ label = 'Chargement…' }: { label?: string }): JSX.Element {
  return (
    <div className="evx-loading" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export { cx };

/* ── Composants livrés dans des fichiers séparés ────────────────────────── */
export { CategoryGlyph, VisualGlyph } from './glyph.js';
export { SegmentedControl, SearchInput, Drawer, Breadcrumb } from './controls.js';
export { StatCard, StatRow, type StatTone } from './stat-card.js';
