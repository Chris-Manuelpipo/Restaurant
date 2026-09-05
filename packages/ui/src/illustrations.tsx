import type { JSX } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Illustrations du back-office.

   Deux registres, et ils ne se mélangent pas :

     · les **scènes** (`Scene*`) sont en aplats, façon risographie — deux ou trois tons
       tirés de la charte Evolyx, un décalage de repérage, un grain. Elles ouvrent une
       étape de mise en service : on en voit une à la fois, elles ont le droit d'être
       grandes et d'avoir une intention ;

     · les **spots** (`Art*`) sont au trait d'encre, comme les vignettes du menu client.
       Ils occupent un écran vide, où il ne faut surtout pas hurler.

   Tout est en couleurs Evolyx — ivoire, encre, vert forêt, ambre. Jamais la charte du
   restaurant : ces dessins appartiennent à l'outil, pas au client de l'outil.

   Référence visuelle : docs/maquettes/03-illustrations.html
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Le grain qui fait tenir les aplats.
 *
 * Sans lui, du papier découpé sur un écran n'est que du plat. Le filtre est déclaré une
 * fois par scène, avec un identifiant propre : deux scènes affichées côte à côte ne
 * doivent pas se voler leur filtre.
 */
function Grain({ id }: { id: string }): JSX.Element {
  return (
    <>
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} opacity="0.06" />
    </>
  );
}

/**
 * Étape 1 — l'enseigne.
 *
 * Une devanture : le store, l'enseigne suspendue, la vitrine, le pot devant la porte.
 * Le décalage de repérage — la silhouette ambre glissée de trois pixels sous la façade —
 * est ce qui distingue le dessin d'un aplat propre fait à la machine.
 */
export function SceneIdentity(): JSX.Element {
  return (
    <svg
      className="evx-scene"
      viewBox="0 0 600 176"
      role="img"
      aria-label="Une devanture de restaurant : store rayé, enseigne suspendue et vitrine."
      preserveAspectRatio="xMidYMax meet"
    >
      {/* Le sol, posé en premier : tout le reste s'y appuie. */}
      <path d="M8 158h584" stroke="var(--rule)" strokeWidth="2" strokeLinecap="round" />

      {/* Décalage de repérage — la couche « mal calée » de l'imprimeur. */}
      <g transform="translate(5 5)" opacity="0.28">
        <rect x="150" y="30" width="300" height="128" rx="5" fill="var(--amber)" />
      </g>

      {/* La façade. */}
      <rect x="150" y="30" width="300" height="128" rx="5" fill="var(--card)" />
      <rect x="150" y="30" width="300" height="128" rx="5" fill="none" stroke="var(--rule)" />

      {/* La vitrine, et deux tables devinées derrière. */}
      <rect x="176" y="74" width="116" height="60" rx="3" fill="var(--accent-soft)" />
      <path d="M234 74v60M176 104h116" stroke="var(--card)" strokeWidth="2.5" />
      <circle cx="205" cy="120" r="7" fill="var(--accent)" opacity="0.35" />
      <circle cx="263" cy="120" r="7" fill="var(--accent)" opacity="0.2" />

      {/* La porte. */}
      <rect x="318" y="80" width="66" height="78" rx="3" fill="var(--paper)" />
      <rect x="318" y="80" width="66" height="78" rx="3" fill="none" stroke="var(--rule)" />
      <circle cx="330" cy="120" r="3" fill="var(--ink-3)" />

      {/* Le store : un aplat vert, puis une dent sur deux reprise en ambre.
          Le rayon des festons (26 pour une corde de 40) les garde peu profonds : à 20,
          chaque dent devenait un demi-cercle, et le store un jeu de ballons. */}
      <path
        d="M140 26h320v18a26 26 0 0 1-40 0 26 26 0 0 1-40 0 26 26 0 0 1-40 0 26 26 0 0 1-40 0 26 26 0 0 1-40 0 26 26 0 0 1-40 0 26 26 0 0 1-40 0 26 26 0 0 1-40 0Z"
        fill="var(--accent)"
      />
      {[180, 260, 340, 420].map((x) => (
        <path key={x} d={`M${x} 26h40v18a26 26 0 0 1-40 0Z`} fill="var(--amber)" opacity="0.9" />
      ))}
      <path d="M136 20h328a4 4 0 0 1 0 8H136a4 4 0 0 1 0-8Z" fill="var(--ink)" />

      {/* L'enseigne suspendue : c'est le nom que le gérant est en train de saisir. */}
      <path d="M460 40h34" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      <path d="M478 40v10M492 40v10" stroke="var(--ink-3)" strokeWidth="2" />
      <rect x="462" y="50" width="76" height="52" rx="6" fill="var(--ink)" />
      <rect x="470" y="58" width="60" height="36" rx="3" fill="none" stroke="var(--amber)" strokeWidth="1.5" opacity="0.8" />
      <path d="M486 70h28M486 78h20" stroke="var(--paper)" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      <circle cx="478" cy="74" r="3.5" fill="var(--amber)" />

      {/* Le pot, devant la porte. */}
      <path d="M96 132h34l-4 26h-26l-4-26Z" fill="var(--amber)" opacity="0.85" />
      <path d="M92 126h42v8H92z" fill="var(--ink)" opacity="0.75" />
      <path
        d="M113 126c-14 0-20-10-18-22 12-1 19 8 18 22Zm0 0c14 0 21-8 20-20-12-2-21 6-20 20Z"
        fill="var(--accent)"
      />

      {/* L'ardoise du jour, qui ferme la composition à droite et répond à l'enseigne.
          Elle a des pieds : en simple trapèze, elle se lisait comme un cône de chantier. */}
      <path
        d="M562 149l-5 9M584 149l5 9"
        stroke="var(--ink)"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.75"
      />
      <rect x="554" y="105" width="38" height="46" rx="3" fill="var(--ink)" opacity="0.85" />
      <path
        d="M562 120h22M562 131h15"
        stroke="var(--amber)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      <Grain id="evx-grain-identity" />
    </svg>
  );
}

/**
 * Écran vide des codes QR — un chevalet de table, tel qu'il finira sur la table 7.
 *
 * Le dessin montre l'objet fini plutôt qu'une abstraction de « code manquant » : ce que le
 * gérant doit se représenter, c'est le carton debout, pas la ligne absente d'un tableau.
 */
export function ArtTableTent(): JSX.Element {
  return (
    <svg
      className="evx-art"
      viewBox="0 0 120 100"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Le carton, et son pied replié vu en perspective. */}
      <rect x="32" y="10" width="56" height="66" rx="4" />
      <path d="M88 76l11 8H21l11-8" opacity=".4" />
      {/* La table. */}
      <path d="M10 84h100" />

      {/* Le code. Trois repères d'angle et une trame régulière sur un pas de 4 :
          moins dense, le dessin se lisait comme un formulaire, pas comme un QR. */}
      <rect x="39" y="17" width="11" height="11" rx="1.5" stroke="var(--accent)" />
      <rect x="70" y="17" width="11" height="11" rx="1.5" />
      <rect x="39" y="48" width="11" height="11" rx="1.5" />
      <path
        d="M56 17v5M62 17v3M66 21v3M56 26v3M62 26v6M39 34h4M47 34h4M56 34h3M64 34h5M74 34v4M39 40h3M48 40v4M56 40h6M68 40v4M76 40h5M56 47v5M62 48h5M71 48v4M77 48v3M56 56h4M64 56h3M71 56h6"
        opacity=".65"
      />

      {/* Le libellé de la table, sous le code. */}
      <path d="M40 67h28" opacity=".3" />
    </svg>
  );
}
