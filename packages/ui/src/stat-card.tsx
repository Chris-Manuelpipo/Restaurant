import type { JSX, ReactNode } from 'react';

/**
 * Carte de statistique.
 *
 * Une carte doit répondre à une question que le gérant se pose vraiment en ouvrant son
 * back-office — « combien de plats sont épuisés ? », « combien n'ont pas de photo ? » — et,
 * quand la réponse appelle une action, y mener d'un clic. Un chiffre qu'on ne peut pas
 * exploiter n'est qu'une décoration.
 */

export type StatTone = 'neutral' | 'accent' | 'warning' | 'danger';

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  onClick,
  active,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  tone?: StatTone;
  /** Rend la carte cliquable : elle filtre alors la liste en dessous. */
  onClick?: () => void;
  active?: boolean;
}): JSX.Element {
  const content = (
    <>
      <span className="evx-stat__icon" aria-hidden>
        {icon}
      </span>
      <span className="evx-stat__body">
        <span className="evx-stat__value">{value}</span>
        <span className="evx-stat__label">{label}</span>
        {hint ? <span className="evx-stat__hint">{hint}</span> : null}
      </span>
    </>
  );

  if (!onClick) {
    return (
      <div className="evx-stat" data-tone={tone}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="evx-stat evx-stat--action"
      data-tone={tone}
      data-active={active || undefined}
      onClick={onClick}
      aria-pressed={active}
    >
      {content}
    </button>
  );
}

/** Rangée de cartes : elle s'adapte seule, de quatre colonnes à une. */
export function StatRow({ children }: { children: ReactNode }): JSX.Element {
  return <div className="evx-stat-row">{children}</div>;
}
