import {
  BLACK,
  WHITE,
  bestForeground,
  contrastRatio,
  mixHex,
  parseHex,
  relativeLuminance,
  toHex,
} from './color.js';
import {
  BODY_FONT_STACK,
  CONTRAST_AA,
  DISPLAY_FONTS,
  QR_LUMINANCE_CEILING,
  type DisplayFontKey,
} from './constants.js';

/** La charte telle que le restaurant la saisit, et telle qu'elle est stockée en base. */
export interface ThemeInput {
  primary: string;
  background: string;
  fontDisplay: DisplayFontKey;
  cornerRadius: number;
}

export const DEFAULT_THEME: ThemeInput = {
  primary: '#C2410C',
  background: '#FBF8F3',
  fontDisplay: 'fraunces',
  cornerRadius: 14,
};

/** Les variables CSS posées à la racine. Une seule source, serveur et client confondus. */
export interface ThemeVars {
  '--primary': string;
  '--on-primary': string;
  '--bg': string;
  '--surface': string;
  '--surface-2': string;
  '--text': string;
  '--muted': string;
  '--line': string;
  '--tile': string;
  '--cover': string;
  '--font-display': string;
  '--font-body': string;
  '--radius': string;
}

export interface DerivedTheme {
  vars: ThemeVars;
  /** Fond sombre : luminance relative < 0,35. Décide du sens de tous les mélanges. */
  isDark: boolean;
  contrast: {
    /** Le ratio demandé par le cahier des charges : texte courant sur le fond. */
    textOnBackground: number;
    /** Lisibilité d'un prix ou d'un titre en couleur principale sur le fond. */
    primaryOnBackground: number;
    /** Lisibilité du texte posé sur un bouton plein. */
    onPrimaryOnPrimary: number;
  };
  /** Vrai si la couleur principale est trop claire pour servir de couleur de modules QR. */
  primaryTooLightForQr: boolean;
  /** Couleur de repli des modules QR quand la principale est trop claire. */
  qrForeground: string;
  warnings: ThemeWarning[];
}

export interface ThemeWarning {
  code: 'LOW_TEXT_CONTRAST' | 'LOW_PRIMARY_CONTRAST' | 'QR_PRIMARY_TOO_LIGHT';
  /** Message prêt à afficher, en français : l'interface avertit, elle ne bloque jamais. */
  message: string;
  ratio?: number;
}

const DARK_BACKGROUND_THRESHOLD = 0.35;

function fontStack(key: DisplayFontKey): string {
  return (DISPLAY_FONTS.find((f) => f.key === key) ?? DISPLAY_FONTS[0]).stack;
}

/**
 * Dérive la palette complète depuis un couple (principale, fond).
 *
 * Fonction **pure** : mêmes entrées, mêmes sorties, aucun accès au DOM ni à l'heure. C'est ce
 * qui permet de l'exécuter à l'identique dans le navigateur du gérant (aperçu qui suit la
 * frappe), dans le menu client, et sur le serveur au moment de composer un PDF de QR codes.
 */
export function deriveTheme(input: Partial<ThemeInput> = {}): DerivedTheme {
  const primary = normalise(input.primary, DEFAULT_THEME.primary);
  const background = normalise(input.background, DEFAULT_THEME.background);
  const fontDisplay = input.fontDisplay ?? DEFAULT_THEME.fontDisplay;
  const radius = Math.min(28, Math.max(0, Math.round(input.cornerRadius ?? DEFAULT_THEME.cornerRadius)));

  const bgLuminance = relativeLuminance(background);
  const isDark = bgLuminance < DARK_BACKGROUND_THRESHOLD;

  // Sur fond sombre on éclaircit par petites touches ; sur fond clair les surfaces montent
  // franchement vers le blanc et les séparateurs descendent vers le noir.
  const surface = isDark ? mixHex(background, WHITE, 0.045) : mixHex(background, WHITE, 0.72);
  const surface2 = isDark ? mixHex(background, WHITE, 0.09) : mixHex(background, BLACK, 0.035);
  const tile = isDark ? mixHex(background, WHITE, 0.05) : mixHex(background, WHITE, 0.5);
  const line = isDark ? mixHex(background, WHITE, 0.12) : mixHex(background, BLACK, 0.09);

  // Le texte n'est jamais du blanc pur ni du noir pur : on le teinte du fond pour éviter
  // l'éblouissement en salle sombre et la dureté en plein soleil.
  const text = isDark ? mixHex(WHITE, background, 0.06) : mixHex(BLACK, background, 0.12);
  const muted = mixHex(text, background, 0.42);

  const onPrimary =
    bestForeground(primary) === 'white' ? mixHex(WHITE, primary, 0.08) : mixHex(BLACK, primary, 0.1);

  const cover = coverGradient(primary);

  const contrast = {
    textOnBackground: contrastRatio(text, background),
    primaryOnBackground: contrastRatio(primary, background),
    onPrimaryOnPrimary: contrastRatio(onPrimary, primary),
  };

  const primaryLuminance = relativeLuminance(primary);
  const primaryTooLightForQr = primaryLuminance > QR_LUMINANCE_CEILING;
  // Repli : on reste dans la charte en assombrissant la principale plutôt qu'en tombant
  // sur un noir arbitraire — le code imprimé garde un air de famille avec l'enseigne.
  const qrForeground = primaryTooLightForQr ? mixHex(primary, BLACK, 0.78) : toHex(parseHex(primary)!);

  const warnings: ThemeWarning[] = [];
  if (contrast.textOnBackground < CONTRAST_AA) {
    warnings.push({
      code: 'LOW_TEXT_CONTRAST',
      ratio: contrast.textOnBackground,
      message: `Le texte n'est qu'à ${fmt(contrast.textOnBackground)}:1 sur votre fond. En plein soleil, vos clients auront du mal à lire.`,
    });
  }
  if (contrast.primaryOnBackground < 3) {
    warnings.push({
      code: 'LOW_PRIMARY_CONTRAST',
      ratio: contrast.primaryOnBackground,
      message: `Votre couleur principale ressort peu sur le fond (${fmt(contrast.primaryOnBackground)}:1). Les prix et les titres risquent de passer inaperçus.`,
    });
  }
  if (primaryTooLightForQr) {
    warnings.push({
      code: 'QR_PRIMARY_TOO_LIGHT',
      message:
        'Votre couleur principale est trop claire pour un code QR fiable : les codes seront imprimés dans une version assombrie de cette couleur.',
    });
  }

  return {
    vars: {
      '--primary': toHex(parseHex(primary)!),
      '--on-primary': onPrimary,
      '--bg': toHex(parseHex(background)!),
      '--surface': surface,
      '--surface-2': surface2,
      '--text': text,
      '--muted': muted,
      '--line': line,
      '--tile': tile,
      '--cover': cover,
      '--font-display': fontStack(fontDisplay),
      '--font-body': BODY_FONT_STACK,
      '--radius': `${radius}px`,
    },
    isDark,
    contrast,
    primaryTooLightForQr,
    qrForeground,
    warnings,
  };
}

/** Sérialise les variables pour un attribut `style` ou une règle `:root`. */
export function themeToCss(vars: ThemeVars): string {
  return Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(';');
}

/** Les mêmes variables sous la forme attendue par la prop `style` de React. */
export function themeToStyle(vars: ThemeVars): Record<string, string> {
  return { ...vars };
}

function normalise(value: string | undefined, fallback: string): string {
  return value && parseHex(value) ? value : fallback;
}

/** Couverture par défaut : un dégradé tiré de la couleur principale, sans photo à charger. */
function coverGradient(primary: string): string {
  const deep = mixHex(primary, BLACK, 0.45);
  const light = mixHex(primary, WHITE, 0.32);
  return `linear-gradient(140deg, ${deep} 0%, ${toHex(parseHex(primary)!)} 48%, ${light} 100%)`;
}

const fmt = (n: number): string => n.toFixed(1).replace('.', ',');
