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
 *  - **logo occupant 6 % de la surface du code**, mesurés sur le code lui-même et non sur
 *    l'image entière — voir LOGO_SIDE_RATIO ;
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

/**
 * Côté de la pastille blanche, en fraction du côté **du code** — zone silencieuse exclue.
 *
 * Le calcul précédent prenait 20 % de la surface de l'image entière, ce qui donnait une
 * pastille de 45 % du côté : près de 28 % des modules effacés, soit exactement la limite
 * théorique de la correction H. Sur un tirage imprimé, lu de biais par un téléphone d'entrée
 * de gamme, il ne restait plus rien pour absorber la graisse et le reflet — le code ne
 * passait plus.
 *
 * 25 % du côté valent 6 % de la surface : un cinquième seulement du budget de correction est
 * consommé, et le logo reste parfaitement lisible sur une étiquette de sept centimètres.
 */
const LOGO_SIDE_RATIO = 0.25;

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

  /*
   * L'image rendue contient le code *et* sa zone silencieuse. Rapporter la pastille à la
   * largeur de l'image la surdimensionnerait d'un dixième : on repart donc du nombre réel
   * de modules, que la bibliothèque nous donne sans refaire l'encodage.
   */
  const modules = QRCode.create(url, { errorCorrectionLevel: 'H' }).modules.size;
  const codeSide = (size * modules) / (modules + QUIET_ZONE_MODULES * 2);

  const side = Math.round(codeSide * LOGO_SIDE_RATIO);
  const padding = Math.round(side * 0.14);
  const radius = Math.round(side * 0.24);

  const badge = await sharp(
    Buffer.from(
      // Pastille arrondie : les angles laissent voir les modules, autant de perte en moins.
      `<svg width="${side}" height="${side}" xmlns="http://www.w3.org/2000/svg">` +
        `<rect width="${side}" height="${side}" rx="${radius}" ry="${radius}" fill="#FFFFFF"/>` +
        `</svg>`,
    ),
  )
    .composite([
      {
        input: await sharp(options.logo)
          .resize(side - padding * 2, side - padding * 2, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 },
          })
          .png()
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
