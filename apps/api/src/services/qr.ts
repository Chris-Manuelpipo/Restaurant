import QRCode from 'qrcode';
import sharp from 'sharp';
import { deriveTheme, type ThemeInput } from '@evolyx/shared';

/**
 * Génération des codes QR.
 *
 * Ils seront imprimés une fois pour toutes et collés sous des tables : ils doivent survivre
 * à la graisse, au soleil et aux photocopies. D'où les choix suivants, tous délibérés :
 *
 *  - **correction H** (30 % de redondance), pour tolérer un logo au centre et l'usure ;
 *  - **marge de 4 modules**, la zone silencieuse minimale de la norme — sans elle, un scanner
 *    posé sur une nappe à motifs échoue ;
 *  - **logo ≤ 20 % de la surface**, au-delà la redondance ne suffit plus ;
 *  - **modules nettement sombres** : si la couleur du restaurant est trop claire, on bascule
 *    sur une version assombrie de cette même couleur et on le signale dans l'interface.
 */

export interface QrOptions {
  /** Charte du restaurant : décide de la couleur des modules. */
  theme?: Partial<ThemeInput>;
  /** Logo PNG à poser au centre. Optionnel — l'absence n'est pas un défaut. */
  logo?: Buffer;
  /** Largeur du PNG produit, en pixels. */
  size?: number;
  /** Fond des modules clairs. Blanc par défaut : c'est ce qui s'imprime le mieux. */
  background?: string;
}

export interface QrResult {
  png: Buffer;
  /** Couleur réellement utilisée pour les modules. */
  foreground: string;
  /** Vrai si la charte a dû être assombrie pour rester scannable. */
  adjusted: boolean;
}

const QUIET_ZONE_MODULES = 4;
const LOGO_AREA_RATIO = 0.2;

export async function generateQrPng(url: string, options: QrOptions = {}): Promise<QrResult> {
  const theme = deriveTheme(options.theme ?? {});
  const foreground = theme.qrForeground;
  const size = options.size ?? 1024;
  const background = options.background ?? '#FFFFFF';

  const base = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    margin: QUIET_ZONE_MODULES,
    width: size,
    type: 'png',
    color: { dark: foreground, light: background },
  });

  if (!options.logo) {
    return { png: base, foreground, adjusted: theme.primaryTooLightForQr };
  }

  // Côté du logo tel que sa surface reste sous 20 % de celle du code.
  const side = Math.round(size * Math.sqrt(LOGO_AREA_RATIO));
  const padding = Math.round(side * 0.1);

  const badge = await sharp({
    create: {
      width: side,
      height: side,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp(options.logo)
          .resize(side - padding * 2, side - padding * 2, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          })
          .flatten({ background: '#FFFFFF' })
          .toBuffer(),
        top: padding,
        left: padding,
      },
    ])
    .png()
    .toBuffer();

  const png = await sharp(base)
    .composite([{ input: badge, gravity: 'center' }])
    .png()
    .toBuffer();

  return { png, foreground, adjusted: theme.primaryTooLightForQr };
}

/** Version SVG : utile pour un aperçu léger dans le back-office. */
export function generateQrSvg(url: string, theme?: Partial<ThemeInput>): Promise<string> {
  const derived = deriveTheme(theme ?? {});
  return QRCode.toString(url, {
    errorCorrectionLevel: 'H',
    margin: QUIET_ZONE_MODULES,
    type: 'svg',
    color: { dark: derived.qrForeground, light: '#FFFFFF' },
  });
}
