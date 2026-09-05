import { memo } from 'react';
import type { JSX, ReactNode } from 'react';
import type { Motif } from '../lib/motifs';

/**
 * Le dessin qui remplace la photo manquante.
 *
 * Trait d'encre : un seul poids de trait, pas d'aplat, tout en `currentColor` — le glyphe
 * hérite donc de la couleur du texte, et une charte claire comme une charte nuit le rendent
 * juste sans qu'on ait rien à prévoir. Un seul détail par dessin est tiré vers `--primary` :
 * la vapeur, la cerise, la flamme. C'est ce détail qui rattache la vignette à la charte du
 * restaurant plutôt qu'à un jeu d'icônes générique.
 *
 * Les tracés vivent dans un `viewBox` de 64, avec 44 unités de contenu utile. L'épaisseur du
 * trait reste une propriété CSS, réglée par le contexte : `stroke-width` en unités du dessin
 * grossirait avec lui, et le même glyphe passerait du filet à la grosse patte selon qu'il
 * occupe une vignette ou une pleine feuille.
 *
 * Rien n'est chargé depuis le réseau, rien n'est mis en cache : ce fichier fait quelques
 * kilo-octets dans le bundle, et le budget de 300 Ko du premier chargement reste intact.
 *
 * Référence visuelle : docs/maquettes/03-illustrations.html
 */

/** Le détail teinté par la charte du restaurant. */
function Accent({ children }: { children: ReactNode }): JSX.Element {
  return <g stroke="var(--primary)">{children}</g>;
}

const MOTIFS: Record<Motif, ReactNode> = {
  /* Grillade : la pièce, la grille en dessous, la braise en dessous encore. */
  grill: (
    <>
      <path d="M20 20h24a8 8 0 0 1 0 16H20a8 8 0 0 1 0-16Z" />
      <path d="M27 28h10" opacity=".45" />
      <path d="M10 42h44M10 49h44" />
      <path d="M18 42v7M32 42v7M46 42v7" opacity=".35" />
      <Accent>
        <path d="M24 59c0-2.5 2.5-3 2.5-5.5M32 60c0-3 3-3.5 3-6M40 59c0-2.5 2.5-3 2.5-5.5" />
      </Accent>
    </>
  ),

  /* Volaille : la chair en goutte, l'os à deux brins, les condyles au bout.
     Un cercle et un trait faisaient une sucette : c'est le fût à deux brins qui
     transforme la forme en pilon. */
  poultry: (
    <>
      <ellipse cx="24" cy="40" rx="15" ry="12.5" transform="rotate(-45 24 40)" />
      <path d="M35.5 31.5 45.5 21.5M32.5 28.5 42.5 18.5" />
      <circle cx="48" cy="24" r="4.2" />
      <circle cx="45" cy="15" r="4.2" />
      <Accent>
        <path d="M16 35a12 12 0 0 1 7-7" />
      </Accent>
    </>
  ),

  /* Poisson : corps, queue, ouïe. La bulle prend la couleur de la charte. */
  fish: (
    <>
      <path d="M6 32c6-9 14-13 21-13s15 4 19 13c-4 9-12 13-19 13S12 41 6 32Z" />
      <path d="m46 32 11-8v16l-11-8Z" />
      <path d="M25 22c-2 6-2 14 0 20" opacity=".4" />
      <circle cx="16" cy="29" r="1.7" fill="currentColor" stroke="none" />
      <Accent>
        <circle cx="12" cy="20" r="2.4" />
      </Accent>
    </>
  ),

  /* Bol : le riz qui déborde, la vapeur. La base du plat en sauce. */
  bowl: (
    <>
      <path d="M11 33h42a21 21 0 0 1-42 0Z" />
      <path d="M7 33h50" />
      <path d="M18 33a14 9 0 0 1 28 0" opacity=".55" />
      <Accent>
        <path d="M25 22c0-3 3-4 3-7s-3-4-3-6M39 22c0-3 3-4 3-7s-3-4-3-6" opacity=".8" />
      </Accent>
    </>
  ),

  /* Soupe : le même bol, la cuillère plantée, davantage de vapeur. */
  soup: (
    <>
      <path d="M11 35h42a21 21 0 0 1-42 0Z" />
      <path d="M7 35h50" />
      <g transform="rotate(20 45 24)">
        <ellipse cx="45" cy="17" rx="4.5" ry="6.5" />
        <path d="M45 23.5v11" />
      </g>
      <Accent>
        <path d="M20 26c0-3 3-4 3-7s-3-4-3-6M30 26c0-3 3-4 3-7s-3-4-3-6" opacity=".8" />
      </Accent>
    </>
  ),

  /* Salade : une feuille, deux rondelles, un brin — jamais deux feuilles symétriques
     encadrant une tomate, qui font un visage avant de faire une salade. */
  salad: (
    <>
      <path d="M11 34h42a21 21 0 0 1-42 0Z" />
      <path d="M7 34h50" />
      <path d="M17 34c-7-5-5-15 2-16 5 4 4 12-2 16Z" />
      <circle cx="41" cy="30" r="3.5" opacity=".6" />
      <path d="M47 34c3-3 2-8-1-9" opacity=".5" />
      <Accent>
        <circle cx="30" cy="28" r="4.5" />
      </Accent>
    </>
  ),

  /* Pizza : la part, la croûte, la garniture. */
  pizza: (
    <>
      <path d="M32 9 53 49Q32 55 11 49Z" />
      <path d="M50 45Q32 50 14 45" opacity=".45" />
      <Accent>
        <circle cx="32" cy="31" r="2.8" />
        <circle cx="25" cy="41" r="2.8" />
        <circle cx="39" cy="41" r="2.8" />
      </Accent>
    </>
  ),

  /* Burger : pain, salade, steak, pain. */
  burger: (
    <>
      <path d="M12 26a20 20 0 0 1 40 0Z" />
      <path d="M23 19h2.5M35 20h2.5" opacity=".5" />
      <path d="M12 29q5 3 10 0t10 0 10 0 10 0" opacity=".7" />
      <rect x="12" y="33" width="40" height="8" rx="4" />
      <path d="M12 44h40a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6Z" />
    </>
  ),

  /* Sandwich roulé : shawarma, wrap, panini.
     Sans les plis du papier ni la coupe ouverte, la forme n'est qu'une gélule. */
  sandwich: (
    <g transform="rotate(-38 32 32)">
      <path d="M24 21h20a11 11 0 0 1 0 22H24a11 11 0 0 1 0-22Z" />
      <ellipse cx="24" cy="32" rx="5" ry="11" />
      <path d="M34 22.5v19M42 24.5v15" opacity=".3" />
      <Accent>
        <path d="M24 27c3.5 1.5 3.5 8 0 9.5" />
      </Accent>
    </g>
  ),

  /* Frites, alloco, accompagnements : trois bâtonnets dans leur cornet. */
  fries: (
    <>
      <rect x="23.5" y="14" width="5.5" height="13" rx="1.6" />
      <rect x="30.5" y="9" width="5.5" height="18" rx="1.6" />
      <rect x="37.5" y="13" width="5.5" height="14" rx="1.6" />
      <path d="M21 27h24l-3 25a3 3 0 0 1-3 2.6H27a3 3 0 0 1-3-2.6L21 27Z" />
      <Accent>
        <path d="M25 36h16" opacity=".8" />
      </Accent>
    </>
  ),

  /* Pâtes : le bol, la guirlande de nouilles, la fourchette. */
  pasta: (
    <>
      <path d="M11 34h42a21 21 0 0 1-42 0Z" />
      <path d="M7 34h50" />
      <path d="M15 34c1-7 6-10 11-7s9-1 10-6 7-5 10 0" />
      <Accent>
        <path d="M20 34c2-5 5-7 8-5" />
      </Accent>
    </>
  ),

  /* Dessert : la part glacée, la cerise. */
  dessert: (
    <>
      <path d="M16 32v16a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4V32" />
      <path d="M16 32c4-6 8 0 12-4s8 4 12 0 4 4 8 4" />
      <path d="M16 42h32" opacity=".35" />
      <Accent>
        {/* La cerise est posée sur le glaçage, pas suspendue au-dessus : détachée,
            elle se lisait comme une loupe. */}
        <circle cx="34" cy="24.5" r="3.5" />
        <path d="M34 21v-3" />
      </Accent>
    </>
  ),

  /* Café, thé : la tasse, l'anse, la soucoupe. */
  coffee: (
    <>
      <path d="M14 24h24v12a12 12 0 0 1-24 0V24Z" />
      <path d="M38 27h4.5a6 6 0 0 1 0 12H38" />
      <path d="M8 51h40" />
      <Accent>
        <path d="M22 20c0-3 3-4.5 3-7.5S22 9 22 6M32 20c0-3 3-4.5 3-7.5S32 9 32 6" opacity=".8" />
      </Accent>
    </>
  ),

  /* Cocktail : la coupe, le pied, la cerise piquée. */
  cocktail: (
    <>
      <path d="M12 16h40L32 38 12 16Z" />
      <path d="M18 21h28" opacity=".35" />
      <path d="M32 38v12M22 52h20" />
      <Accent>
        <circle cx="46" cy="13" r="3.2" />
        <path d="m43.5 10.5 8-6" opacity=".8" />
      </Accent>
    </>
  ),

  /* Boissons : la bouteille et son étiquette. */
  bottle: (
    <>
      <path d="M27 6h10v9l4.5 7a9 9 0 0 1 1.5 5v22a4 4 0 0 1-4 4H25a4 4 0 0 1-4-4V27a9 9 0 0 1 1.5-5L27 15V6Z" />
      <path d="M27 13h10" opacity=".4" />
      <Accent>
        <path d="M21.5 33h21M21.5 43h21" opacity=".8" />
      </Accent>
    </>
  ),

  /* Repli sobre : l'assiette et ses couverts. */
  plate: (
    <>
      <circle cx="32" cy="32" r="15" />
      <circle cx="32" cy="32" r="10" opacity=".35" />
      <path d="M9 19v6a2.5 2.5 0 0 0 5 0v-6" />
      <path d="M11.5 27v18" />
      <path d="M53 19c3 4 3 8 0 11v15" />
    </>
  ),

  /* Repli soigné : la cloche de service. */
  cloche: (
    <>
      <path d="M11 42a21 21 0 0 1 42 0Z" />
      <path d="M7 42h50" />
      <path d="M21 40a11 11 0 0 1 7-10" opacity=".35" />
      <Accent>
        <circle cx="32" cy="17.5" r="3" />
      </Accent>
    </>
  ),
};

export const DishGlyph = memo(function DishGlyph({ motif }: { motif: Motif }): JSX.Element {
  return (
    <svg
      className="dish-glyph"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {MOTIFS[motif]}
    </svg>
  );
});
