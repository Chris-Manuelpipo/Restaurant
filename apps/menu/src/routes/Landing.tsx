import type { JSX } from 'react';
/**
 * Écran d'accueil : on n'arrive ici qu'en tapant l'adresse à la main. Un menu se rejoint
 * en scannant le code de sa table — c'est ce que cet écran explique, sans détour.
 */
export function Landing(): JSX.Element {
  return (
    <div className="shell grid place-items-center px-8 text-center" style={{ minHeight: '100dvh' }}>
      <div>
        <div
          className="mx-auto mb-7 h-20 w-20 rounded-3xl grid place-items-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <path d="M14 14h3v3h-3zM18 18h3v3h-3z" />
          </svg>
        </div>
        <h1 className="text-[26px] font-semibold m-0 leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Scannez le code de votre table
        </h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Le menu du restaurant s’ouvre aussitôt, sans compte ni installation.
        </p>
        <p className="mt-10 text-[11.5px]" style={{ color: 'var(--muted)' }}>
          Menu servi par <b style={{ color: 'var(--text)' }}>Evolyx</b>
        </p>
      </div>
    </div>
  );
}
