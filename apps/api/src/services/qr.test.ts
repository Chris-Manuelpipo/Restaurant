import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import sharp from 'sharp';
import { generateQrPng } from './qr.js';

/**
 * Un code QR qui ne se relit pas est un autocollant.
 *
 * Ces tests ne mesurent donc pas des pixels : ils **décodent** l'image produite, exactement
 * comme le ferait le téléphone d'un client. C'est la seule vérification qui compte, parce
 * que le défaut qu'elle attrape — un logo trop gros pour la correction d'erreur — ne se voit
 * pas à l'œil : l'image reste jolie, elle ne se scanne simplement plus.
 */

const URL = 'https://menu.evolyx.cm/r/casa-lina';

/** Le logo le plus hostile qui soit : un carré plein, opaque, sans transparence à rogner. */
async function solidLogo(color: string): Promise<Buffer> {
  return sharp({ create: { width: 512, height: 512, channels: 4, background: color } })
    .png()
    .toBuffer();
}

/** Relit le PNG comme le ferait un scanner, et rend le texte trouvé. */
async function decode(png: Buffer): Promise<string | null> {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

describe('generateQrPng', () => {
  it('produit un code relisible sans logo', async () => {
    const { png } = await generateQrPng(URL);
    await expect(decode(png)).resolves.toBe(URL);
  });

  it('reste relisible avec un logo noir opaque au centre', async () => {
    const { png } = await generateQrPng(URL, { logo: await solidLogo('#000000') });
    await expect(decode(png)).resolves.toBe(URL);
  });

  it('reste relisible avec la charte du restaurant appliquée aux modules', async () => {
    const { png } = await generateQrPng(URL, {
      theme: { primary: '#1F3FBF' },
      logo: await solidLogo('#1F3FBF'),
    });
    await expect(decode(png)).resolves.toBe(URL);
  });

  /*
   * Le format réellement imprimé : 900 px pour une étiquette de 70 mm. C'est la taille que
   * produit le PDF de table, celle qui avait cessé de fonctionner.
   */
  it('reste relisible à la taille utilisée par le PDF de table', async () => {
    const { png } = await generateQrPng(URL, { size: 900, logo: await solidLogo('#000000') });
    await expect(decode(png)).resolves.toBe(URL);
  });

  /*
   * Une impression usée, photocopiée, lue de travers : on simule la perte en réduisant
   * fortement l'image avant de la relire. Si le logo mangeait trop de modules, la marge de
   * correction serait déjà consommée et cette relecture échouerait.
   */
  it('survit à une réduction agressive, comme une photocopie', async () => {
    const { png } = await generateQrPng(URL, { size: 900, logo: await solidLogo('#000000') });
    const degraded = await sharp(png).resize(300, 300).png().toBuffer();
    await expect(decode(degraded)).resolves.toBe(URL);
  });

  it('assombrit une charte trop claire plutôt que de rendre le code illisible', async () => {
    const { png, adjusted } = await generateQrPng(URL, { theme: { primary: '#FFE47A' } });
    expect(adjusted).toBe(true);
    await expect(decode(png)).resolves.toBe(URL);
  });
});
