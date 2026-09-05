import type { JSX, ReactNode } from 'react';

/** En-tête commun à tous les écrans : titre, phrase d'accroche, actions principales. */
export function PageHeader({
  title,
  lede,
  actions,
}: {
  title: string;
  lede?: string;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div className="topbar">
      <div className="min-w-0">
        <h1
          className="text-[19px] font-bold tracking-[-0.025em] truncate"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h1>
        {lede ? (
          <p className="m-0 text-[12.5px] truncate" style={{ color: 'var(--ink-3)' }}>
            {lede}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
