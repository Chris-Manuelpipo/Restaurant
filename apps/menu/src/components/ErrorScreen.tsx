import { useTranslation } from '../lib/i18n';
import type { JSX } from 'react';

/** Écran d'erreur : dire ce qui s'est passé, et proposer le seul geste utile. */
export function ErrorScreen({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="shell grid place-items-center px-8 text-center" style={{ minHeight: '100dvh' }}>
      <div>
        <div
          className="mx-auto mb-6 h-16 w-16 rounded-2xl grid place-items-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold m-0" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h1>
        {detail ? (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {detail}
          </p>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-7 px-6 rounded-xl font-semibold text-sm"
            style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
          >
            {t('retry')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
