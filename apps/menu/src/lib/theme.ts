import { deriveTheme, type ThemeInput } from '@evolyx/shared';

/**
 * Application de la charte du restaurant.
 *
 * `deriveTheme()` est la même fonction que côté serveur : ce qui s'affiche ici est exactement
 * ce que le back-office montrait en aperçu, et exactement ce qui sera imprimé sur les PDF.
 */
export function applyTheme(theme: Partial<ThemeInput>): void {
  const derived = deriveTheme(theme);
  const root = document.documentElement;

  for (const [name, value] of Object.entries(derived.vars)) {
    root.style.setProperty(name, value);
  }

  // Le grain et les ombres changent de sens selon la clarté du fond.
  document.body.dataset.light = String(!derived.isDark);
  root.style.colorScheme = derived.isDark ? 'dark' : 'light';

  /**
   * Le fond est posé en style **en ligne**, et pas seulement par la feuille de styles : le
   * `<head>` porte un fond de secours codé en dur, qui peint la page avant que le moindre
   * script ne tourne. Hors de toute couche de cascade, ce fond de secours l'emporterait
   * sinon sur la charte — et une charte claire se retrouverait sur un fond sombre partout
   * où le menu ne couvre pas l'écran.
   */
  root.style.background = derived.vars['--bg'];
  document.body.style.background = derived.vars['--bg'];
  document.body.style.color = derived.vars['--text'];

  // La barre du navigateur prend la couleur du menu : le passage à la page est sans couture.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', derived.vars['--bg']);
}

/**
 * La couverture reste le dégradé dérivé de la charte, peint sans aucune requête. La photo,
 * quand il y en a une, se pose **par-dessus**, en fondu.
 *
 * Ce n'est pas un détail de style : en fond CSS, la photo devenait l'élément le plus grand de
 * la page, et le navigateur ne considérait la page « peinte » qu'une fois cette image arrivée
 * — soit trois secondes de plus sur un réseau lent, pour une image purement décorative. Le
 * texte, lui, est l'information : c'est lui qui doit arriver en premier.
 */
export const COVER_FADE_MS = 400;
