import { useTranslation } from '../lib/i18n';
import type { PublicOpening } from '@evolyx/shared';
import type { JSX } from 'react';

/**
 * Pastille d'ouverture. Le menu reste consultable restaurant fermé : cette pastille informe,
 * elle ne barre rien.
 */
export function StatusPill({ opening }: { opening: PublicOpening }): JSX.Element {
  const { t } = useTranslation();

  return (
    <span className="status-pill">
      <span className="dot" data-closed={!opening.isOpen} aria-hidden />
      {opening.isOpen ? t('open') : t('closed')}
      {opening.nextChangeLabel ? (
        <>
          <span style={{ color: 'var(--line)' }}>·</span>
          <span style={{ color: 'var(--muted)' }}>{opening.nextChangeLabel}</span>
        </>
      ) : null}
    </span>
  );
}
