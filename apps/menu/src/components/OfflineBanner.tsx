import { useTranslation } from 'react-i18next';
import type { JSX } from 'react';

/**
 * Bandeau hors ligne : discret, jamais bloquant.
 * Le client doit savoir que la carte peut avoir bougé — sans que cela l'empêche de la lire.
 */
export function OfflineBanner({ savedAt }: { savedAt: string }): JSX.Element {
  const { t, i18n } = useTranslation();

  const date = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(savedAt));

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 px-[14px] py-[7px] text-[12.5px] border-b"
      style={{ background: 'var(--surface-2)', color: 'var(--muted)', borderColor: 'var(--line)' }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-70">
        <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0" />
        <path d="M12 20h.01M2 2l20 20" />
      </svg>
      {t('offlineSaved', { date })}
    </div>
  );
}
