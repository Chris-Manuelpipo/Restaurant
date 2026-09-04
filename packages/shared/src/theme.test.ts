import { describe, expect, it } from 'vitest';
import { deriveTheme, themeToCss } from './theme.js';
import { contrastRatio, mixHex, parseHex, relativeLuminance, toHex } from './color.js';

const BRAISE = { primary: '#FF6A2C', background: '#17130F' } as const;
const CASA = { primary: '#1F3FBF', background: '#F3F5FA' } as const;

describe('color', () => {
  it('lit les hex courts et longs', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('FF6A2C')).toEqual({ r: 255, g: 106, b: 44 });
    expect(parseHex('pas une couleur')).toBeNull();
  });

  it('calcule la luminance relative selon WCAG', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#17130F')).toBeLessThan(0.35);
  });

  it('calcule le contraste dans les deux sens', () => {
    expect(contrastRatio('#000', '#FFF')).toBe(21);
    expect(contrastRatio('#FFF', '#000')).toBe(21);
    expect(contrastRatio('#777', '#777')).toBe(1);
  });

  it('mélange linéairement', () => {
    expect(toHex({ r: 255, g: 106, b: 44 })).toBe('#FF6A2C');
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('deriveTheme', () => {
  it('détecte un fond sombre', () => {
    expect(deriveTheme(BRAISE).isDark).toBe(true);
    expect(deriveTheme(CASA).isDark).toBe(false);
  });

  it('produit toutes les variables attendues', () => {
    const { vars } = deriveTheme(BRAISE);
    for (const key of [
      '--primary',
      '--on-primary',
      '--bg',
      '--surface',
      '--surface-2',
      '--text',
      '--muted',
      '--line',
      '--tile',
      '--cover',
      '--font-display',
      '--font-body',
      '--radius',
    ]) {
      expect(vars[key as keyof typeof vars], key).toBeTruthy();
    }
  });

  it('éclaircit les surfaces sur fond sombre, les fonce sur fond clair', () => {
    const dark = deriveTheme(BRAISE);
    const light = deriveTheme(CASA);
    expect(relativeLuminance(dark.vars['--surface'])).toBeGreaterThan(
      relativeLuminance(dark.vars['--bg']),
    );
    // Sur fond clair les cartes montent vers le blanc, les séparateurs descendent vers le noir.
    expect(relativeLuminance(light.vars['--surface'])).toBeGreaterThan(
      relativeLuminance(light.vars['--bg']),
    );
    expect(relativeLuminance(light.vars['--line'])).toBeLessThan(
      relativeLuminance(light.vars['--bg']),
    );
  });

  it('donne un texte lisible sur les deux chartes de démonstration', () => {
    for (const charte of [BRAISE, CASA]) {
      const { contrast } = deriveTheme(charte);
      expect(contrast.textOnBackground).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('choisit --on-primary du bon côté', () => {
    // Orange clair : le texte posé dessus doit être sombre.
    const orange = deriveTheme({ primary: '#FF6A2C', background: '#17130F' });
    expect(relativeLuminance(orange.vars['--on-primary'])).toBeLessThan(0.2);
    // Bleu profond : le texte posé dessus doit être clair.
    const bleu = deriveTheme({ primary: '#1F3FBF', background: '#F3F5FA' });
    expect(relativeLuminance(bleu.vars['--on-primary'])).toBeGreaterThan(0.5);
    expect(bleu.contrast.onPrimaryOnPrimary).toBeGreaterThanOrEqual(4.5);
  });

  it('avertit sans bloquer quand le texte contraste mal', () => {
    const pale = deriveTheme({ primary: '#EEEEEE', background: '#F2F2F2' });
    expect(pale.warnings.some((w) => w.code === 'LOW_PRIMARY_CONTRAST')).toBe(true);
    // Une charte douteuse produit quand même un thème complet exploitable.
    expect(pale.vars['--text']).toBeTruthy();
  });

  it('bascule la couleur des modules QR quand la principale est trop claire', () => {
    const clair = deriveTheme({ primary: '#FFD166', background: '#FFFFFF' });
    expect(clair.primaryTooLightForQr).toBe(true);
    expect(clair.warnings.some((w) => w.code === 'QR_PRIMARY_TOO_LIGHT')).toBe(true);
    expect(relativeLuminance(clair.qrForeground)).toBeLessThan(relativeLuminance('#FFD166'));

    const fonce = deriveTheme(BRAISE);
    expect(fonce.primaryTooLightForQr).toBe(false);
    expect(fonce.qrForeground).toBe('#FF6A2C');
  });

  it('est pure : deux appels identiques donnent le même résultat', () => {
    expect(deriveTheme(BRAISE)).toEqual(deriveTheme(BRAISE));
  });

  it('retombe sur la charte par défaut quand les couleurs sont invalides', () => {
    const theme = deriveTheme({ primary: 'rouge vif', background: '???' });
    expect(theme.vars['--primary']).toBe('#C2410C');
    expect(theme.vars['--bg']).toBe('#FBF8F3');
  });

  it('borne le rayon et sérialise en CSS', () => {
    expect(deriveTheme({ cornerRadius: 999 }).vars['--radius']).toBe('28px');
    expect(deriveTheme({ cornerRadius: -5 }).vars['--radius']).toBe('0px');
    expect(themeToCss(deriveTheme(BRAISE).vars)).toContain('--primary:#FF6A2C');
  });

  it('sélectionne la pile de polices demandée', () => {
    expect(deriveTheme({ fontDisplay: 'fraunces' }).vars['--font-display']).toContain('Fraunces');
    expect(deriveTheme({ fontDisplay: 'system' }).vars['--font-display']).toContain('system-ui');
  });
});
