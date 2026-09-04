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

  // La barre du navigateur prend la couleur du menu : le passage à la page est sans couture.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', derived.vars['--bg']);
}

/** Couverture : la photo du restaurant si elle existe, sinon le dégradé dérivé de la charte. */
export function coverStyle(coverUrl: string | null): React.CSSProperties | undefined {
  return coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined;
}
