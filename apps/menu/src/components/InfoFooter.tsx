import { DAY_NAMES, useTranslation } from '../lib/i18n';
import type { PublicOpening, PublicRestaurant } from '@evolyx/shared';

import type { JSX } from 'react';

/**
 * Pied de page : comment nous joindre, quand nous sommes ouverts.
 *
 * Les trois actions sont les seules que le client veut vraiment depuis sa table — appeler,
 * écrire, venir. Elles ouvrent l'application native, sans écran intermédiaire.
 */
export function InfoFooter({
  restaurant,
  opening,
  tableCode,
}: {
  restaurant: PublicRestaurant;
  opening: PublicOpening;
  tableCode?: string;
}): JSX.Element {
  const { t, locale } = useTranslation();
  const days = DAY_NAMES[locale] ?? DAY_NAMES.fr!;
  const today = new Date().getDay();

  const maps = restaurant.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`
    : null;

  return (
    <footer
      className="mt-3 px-5 pt-[26px] pb-10 border-t"
      style={{
        borderColor: 'var(--line)',
        background:
          'linear-gradient(180deg, transparent, color-mix(in oklab, var(--surface) 55%, transparent))',
      }}
    >
      <h2 className="m-0 mb-4 text-[19px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
        {t('findUs')}
      </h2>

      <div className="grid grid-cols-3 gap-[9px] mb-6">
        {restaurant.phone ? (
          <a href={`tel:${restaurant.phone.replace(/\s/g, '')}`} className="action-tile" role="button">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            {t('call')}
          </a>
        ) : null}

        {restaurant.whatsapp ? (
          <a
            href={`https://wa.me/${restaurant.whatsapp.replace(/[^0-9]/g, '')}`}
            className="action-tile"
            role="button"
            rel="noreferrer"
            target="_blank"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.2 14.8l-.4-.2-2.6.7.7-2.5-.3-.4A8 8 0 0 1 12 4zm-3 4c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.7 2.7 4.2 3.7 2 .8 2.5.7 2.9.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.6-.3-1.5-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.3.1-.4l.4-.5.2-.4v-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4z" />
            </svg>
            {t('whatsapp')}
          </a>
        ) : null}

        {maps ? (
          <a href={maps} className="action-tile" role="button" rel="noreferrer" target="_blank">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {t('directions')}
          </a>
        ) : null}
      </div>

      {restaurant.address ? (
        <p className="m-0 mb-[22px] text-[13.5px] leading-[1.6]" style={{ color: 'var(--muted)' }}>
          {restaurant.address}
        </p>
      ) : null}

      <h2 className="m-0 mb-4 text-[19px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
        {t('hours')}
      </h2>

      <table className="w-full border-collapse text-[13.5px]">
        <tbody>
          {opening.hours.map((row) => {
            const isToday = row.dayOfWeek === today;
            return (
              <tr key={row.dayOfWeek} style={isToday ? { color: 'var(--primary)', fontWeight: 600 } : undefined}>
                <td className="py-2 border-b" style={{ borderColor: 'var(--line)' }}>
                  {days[row.dayOfWeek]}
                </td>
                <td
                  className="py-2 border-b text-right tabular-nums"
                  style={{ borderColor: 'var(--line)', color: isToday ? 'var(--primary)' : 'var(--muted)' }}
                >
                  {row.isOpen ? `${row.openTime} – ${row.closeTime}` : t('closed')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p
        className="mt-[30px] pt-5 border-t text-center text-[11.5px] tracking-[0.02em]"
        style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
      >
        {t('servedBy')} <b style={{ color: 'var(--text)' }}>Evolyx</b>
        {tableCode ? (
          <>
            {' · '}
            {t('table')} {tableCode}
          </>
        ) : null}
      </p>
    </footer>
  );
}
