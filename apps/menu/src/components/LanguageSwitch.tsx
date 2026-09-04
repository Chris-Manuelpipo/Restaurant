import type { JSX } from 'react';
/** Sélecteur de langue — visible uniquement quand le restaurant en propose plusieurs. */
export function LanguageSwitch({
  locales,
  current,
  onChange,
}: {
  locales: string[];
  current: string;
  onChange: (locale: string) => void;
}): JSX.Element {
  return (
    <div
      className="absolute top-[14px] right-[14px] z-[3] flex gap-[2px] p-[3px] rounded-full backdrop-blur-md"
      style={{
        background: 'color-mix(in oklab, var(--bg) 55%, transparent)',
        border: '1px solid color-mix(in oklab, var(--text) 16%, transparent)',
      }}
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => onChange(locale)}
          aria-pressed={locale === current}
          className="px-[11px] py-[5px] rounded-full text-xs font-semibold tracking-[0.04em] transition-colors"
          style={
            locale === current
              ? { background: 'var(--text)', color: 'var(--bg)' }
              : { color: 'color-mix(in oklab, var(--text) 70%, transparent)' }
          }
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
