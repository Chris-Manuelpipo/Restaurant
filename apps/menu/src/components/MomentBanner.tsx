import type { JSX } from 'react';
/**
 * Le bandeau du moment, composé par le serveur : promotions en cours, puis ce qui manque.
 * Une seule phrase, jamais un bloc — elle doit se lire d'un coup d'œil en s'asseyant.
 */
export function MomentBanner({ text }: { text: string }): JSX.Element {
  return (
    <div className="moment reveal" style={{ animationDelay: '.21s' }} role="status">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="shrink-0 mt-px"
        style={{ color: 'var(--primary)' }}
        aria-hidden
      >
        <path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1.5-.6-2.4-1-3 2.4 1 4 3.4 4 6a6 6 0 1 1-12 0c0-5 6-6 6-12z" />
      </svg>
      <span>{text}</span>
    </div>
  );
}
