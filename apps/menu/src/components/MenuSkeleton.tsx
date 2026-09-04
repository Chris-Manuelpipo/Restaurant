import type { JSX } from 'react';
/**
 * Squelette de chargement.
 *
 * Il reprend exactement la géométrie du menu réel : quand le contenu arrive, rien ne bouge.
 * C'est ce qui évite le décalage de mise en page que le cahier des charges proscrit.
 */
export function MenuSkeleton(): JSX.Element {
  return (
    <div className="shell" aria-busy="true" aria-live="polite">
      <div className="cover" style={{ opacity: 0.5 }} />
      <div className="px-5 -mt-[46px] relative z-[2]">
        <div className="logo-badge" style={{ opacity: 0.5 }} />
        <div className="h-8 w-3/5 rounded-lg mt-4" style={{ background: 'var(--surface-2)' }} />
        <div className="h-4 w-4/5 rounded mt-3" style={{ background: 'var(--surface)' }} />
      </div>
      <div className="px-5 mt-8 space-y-4">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="grid grid-cols-[92px_1fr] gap-[14px] py-[13px]">
            <div className="h-[92px] w-[92px] rounded-[13px]" style={{ background: 'var(--surface)' }} />
            <div className="space-y-2 pt-1">
              <div className="h-4 w-2/3 rounded" style={{ background: 'var(--surface-2)' }} />
              <div className="h-3 w-full rounded" style={{ background: 'var(--surface)' }} />
              <div className="h-3 w-1/2 rounded" style={{ background: 'var(--surface)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
