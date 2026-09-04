import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from 'pdf-lib';
import { deriveTheme, parseHex, type ThemeInput } from '@evolyx/shared';
import { generateQrPng } from './qr.js';

/**
 * Pack d'impression des codes QR.
 *
 * Deux formats, deux usages :
 *  - **A6** : une page par point d'accès, à découper et plastifier pour poser sur les tables ;
 *  - **A4** : une planche récapitulative, à garder au comptoir pour retrouver quel code
 *    correspond à quelle table sans retourner les chevalets.
 *
 * Le code lisible figure sous le QR : un client dont l'appareil photo refuse de coopérer doit
 * pouvoir taper le code à la main.
 */

export interface PdfAccessPoint {
  code: string;
  label: string;
  url: string;
}

export interface PdfOptions {
  restaurantName: string;
  menuUrl: string;
  theme?: Partial<ThemeInput>;
  logo?: Buffer;
  format: 'a6' | 'a4';
}

/** Millimètres → points PostScript. */
const mm = (value: number): number => (value * 72) / 25.4;

const A6 = { width: mm(105), height: mm(148) };
const A4 = { width: mm(210), height: mm(297) };

export async function buildAccessPointsPdf(
  points: PdfAccessPoint[],
  options: PdfOptions,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Codes QR — ${options.restaurantName}`);
  pdf.setCreator('Evolyx');
  pdf.setProducer('Evolyx');

  const display = await pdf.embedFont(StandardFonts.HelveticaBold);
  const body = await pdf.embedFont(StandardFonts.Helvetica);
  const logo = options.logo ? await embedPng(pdf, options.logo) : undefined;

  if (options.format === 'a4') {
    await drawSheet(pdf, points, options, { display, body, logo });
  } else {
    for (const point of points) {
      await drawCard(pdf, point, options, { display, body, logo });
    }
  }

  return pdf.save();
}

interface Assets {
  display: PDFFont;
  body: PDFFont;
  logo?: PDFImage;
}

async function embedPng(pdf: PDFDocument, buffer: Buffer): Promise<PDFImage | undefined> {
  try {
    return await pdf.embedPng(buffer);
  } catch {
    return undefined; // un logo illisible ne doit pas empêcher l'impression des codes
  }
}

function color(hex: string) {
  const parsed = parseHex(hex) ?? { r: 0, g: 0, b: 0 };
  return rgb(parsed.r / 255, parsed.g / 255, parsed.b / 255);
}

/* ── A6 : une carte par point d'accès ──────────────────────────────────────── */

async function drawCard(
  pdf: PDFDocument,
  point: PdfAccessPoint,
  options: PdfOptions,
  assets: Assets,
): Promise<void> {
  const theme = deriveTheme(options.theme ?? {});
  const page = pdf.addPage([A6.width, A6.height]);
  const ink = color(theme.qrForeground);
  const muted = rgb(0.45, 0.44, 0.42);

  const margin = mm(10);
  let cursor = A6.height - margin;

  // Bandeau de charte : trois millimètres de couleur, c'est ce qui fait « à nous ».
  page.drawRectangle({
    x: 0,
    y: A6.height - mm(4),
    width: A6.width,
    height: mm(4),
    color: ink,
  });
  cursor -= mm(2);

  if (assets.logo) {
    const side = mm(14);
    page.drawImage(assets.logo, {
      x: (A6.width - side) / 2,
      y: cursor - side,
      width: side,
      height: side,
    });
    cursor -= side + mm(5);
  }

  const nameSize = fitText(options.restaurantName, assets.display, A6.width - margin * 2, 15);
  page.drawText(options.restaurantName, {
    x: centered(options.restaurantName, assets.display, nameSize, A6.width),
    y: cursor,
    size: nameSize,
    font: assets.display,
    color: rgb(0.1, 0.09, 0.08),
  });
  cursor -= mm(9);

  const invite = 'Scannez pour voir le menu';
  page.drawText(invite, {
    x: centered(invite, assets.body, 9.5, A6.width),
    y: cursor,
    size: 9.5,
    font: assets.body,
    color: muted,
  });
  cursor -= mm(6);

  // Le code occupe les deux tiers de la carte : c'est lui qu'on scanne à un mètre,
  // dans une salle mal éclairée, avec un téléphone qui a du mal à faire la mise au point.
  const qrSide = mm(70);
  const { png } = await generateQrPng(point.url, {
    theme: options.theme,
    logo: options.logo,
    size: 900,
  });
  const image = await pdf.embedPng(png);
  page.drawImage(image, {
    x: (A6.width - qrSide) / 2,
    y: cursor - qrSide,
    width: qrSide,
    height: qrSide,
  });
  cursor -= qrSide + mm(8);

  // Le libellé de la table, en gros : c'est ce que le serveur lit d'un coup d'œil.
  page.drawText(point.label, {
    x: centered(point.label, assets.display, 17, A6.width),
    y: cursor,
    size: 17,
    font: assets.display,
    color: ink,
  });
  cursor -= mm(7);

  // Le code, espacé, pour la saisie manuelle.
  const spaced = point.code.split('').join(' ');
  page.drawText(spaced, {
    x: centered(spaced, assets.body, 12, A6.width),
    y: cursor,
    size: 12,
    font: assets.body,
    color: muted,
  });

  const footer = shortUrl(options.menuUrl);
  page.drawText(footer, {
    x: centered(footer, assets.body, 7.5, A6.width),
    y: mm(8),
    size: 7.5,
    font: assets.body,
    color: rgb(0.6, 0.59, 0.57),
  });
}

/* ── A4 : planche récapitulative ───────────────────────────────────────────── */

async function drawSheet(
  pdf: PDFDocument,
  points: PdfAccessPoint[],
  options: PdfOptions,
  assets: Assets,
): Promise<void> {
  const theme = deriveTheme(options.theme ?? {});
  const ink = color(theme.qrForeground);
  const muted = rgb(0.45, 0.44, 0.42);

  const columns = 3;
  const rows = 4;
  const perPage = columns * rows;
  const margin = mm(14);
  const cellWidth = (A4.width - margin * 2) / columns;
  const cellHeight = (A4.height - margin * 2 - mm(18)) / rows;

  for (let index = 0; index < points.length; index += perPage) {
    const page = pdf.addPage([A4.width, A4.height]);
    const slice = points.slice(index, index + perPage);

    page.drawRectangle({ x: 0, y: A4.height - mm(3), width: A4.width, height: mm(3), color: ink });

    page.drawText(options.restaurantName, {
      x: margin,
      y: A4.height - margin,
      size: 16,
      font: assets.display,
      color: rgb(0.1, 0.09, 0.08),
    });

    const subtitle = `Codes QR · page ${Math.floor(index / perPage) + 1} sur ${Math.ceil(points.length / perPage)}`;
    page.drawText(subtitle, {
      x: margin,
      y: A4.height - margin - mm(6),
      size: 9,
      font: assets.body,
      color: muted,
    });

    for (const [position, point] of slice.entries()) {
      const col = position % columns;
      const row = Math.floor(position / columns);
      const x = margin + col * cellWidth;
      const y = A4.height - margin - mm(18) - (row + 1) * cellHeight;

      const qrSide = Math.min(cellWidth, cellHeight) - mm(16);
      const { png } = await generateQrPng(point.url, { theme: options.theme, size: 640 });
      const image = await pdf.embedPng(png);

      page.drawImage(image, {
        x: x + (cellWidth - qrSide) / 2,
        y: y + mm(12),
        width: qrSide,
        height: qrSide,
      });

      page.drawText(point.label, {
        x: x + centeredIn(point.label, assets.display, 10, cellWidth),
        y: y + mm(7),
        size: 10,
        font: assets.display,
        color: ink,
      });

      page.drawText(point.code, {
        x: x + centeredIn(point.code, assets.body, 8, cellWidth),
        y: y + mm(2.5),
        size: 8,
        font: assets.body,
        color: muted,
      });
    }
  }
}

/* ── Mise en page ──────────────────────────────────────────────────────────── */

function centered(text: string, font: PDFFont, size: number, width: number): number {
  return (width - font.widthOfTextAtSize(text, size)) / 2;
}

function centeredIn(text: string, font: PDFFont, size: number, cellWidth: number): number {
  return (cellWidth - font.widthOfTextAtSize(text, size)) / 2;
}

/** Réduit la taille jusqu'à ce que le texte tienne : un nom long ne doit pas déborder. */
function fitText(text: string, font: PDFFont, maxWidth: number, startSize: number): number {
  let size = startSize;
  while (size > 8 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
