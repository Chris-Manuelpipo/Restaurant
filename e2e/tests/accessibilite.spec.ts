import { expect, test } from '@playwright/test';

/**
 * Accessibilité du menu client (§8 du cahier des charges).
 *
 * Quatre exigences, vérifiées sur la page réelle : navigation clavier visible, cibles
 * tactiles d'au moins 44 px, respect de `prefers-reduced-motion`, contraste du texte.
 */

const MENU = process.env.E2E_MENU_URL ?? 'http://localhost:5181';
const SLUG = 'le-braise-du-carrefour';

test('la navigation au clavier atteint les plats, avec un focus visible', async ({ page }) => {
  await page.goto(`${MENU}/r/${SLUG}`);
  await expect(page.getByRole('heading', { name: 'Le Braisé du Carrefour' })).toBeVisible();

  // Une dizaine de tabulations doit suffire à atteindre le premier plat.
  let reached = false;
  for (let i = 0; i < 14 && !reached; i += 1) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() =>
      Boolean(document.activeElement?.classList.contains('item-row')),
    );
  }
  expect(reached, 'un plat doit être atteignable au clavier').toBe(true);

  // Et le focus doit se voir : contour dessiné, pas seulement implicite.
  const outline = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });
  expect(outline.style).not.toBe('none');
  expect(parseFloat(outline.width)).toBeGreaterThan(0);

  // La touche Entrée ouvre la fiche du plat, comme le ferait un doigt.
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();

  // Échap la referme.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('les cibles tactiles font au moins 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${MENU}/r/${SLUG}`);
  await expect(page.getByRole('heading', { name: 'Le Braisé du Carrefour' })).toBeVisible();

  const tooSmall = await page.evaluate(() => {
    const interactive = [...document.querySelectorAll('button, a[role="button"], a[href]')];
    return interactive
      .filter((element) => {
        const box = element.getBoundingClientRect();
        // On ignore ce qui est hors écran : seul ce qu'on peut toucher compte.
        if (box.width === 0 || box.height === 0) return false;
        return box.height < 44 && box.width < 44;
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`.slice(0, 60));
  });

  expect(tooSmall, `cibles trop petites : ${tooSmall.join(', ')}`).toEqual([]);
});

test('le mouvement se coupe quand le système le demande', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${MENU}/r/${SLUG}`);
  await expect(page.getByRole('heading', { name: 'Le Braisé du Carrefour' })).toBeVisible();

  const durations = await page.evaluate(() =>
    [...document.querySelectorAll('.reveal, .item-row, .chip')].map((element) => {
      const style = getComputedStyle(element);
      return Math.max(parseFloat(style.animationDuration), parseFloat(style.transitionDuration));
    }),
  );

  // Toutes les durées doivent être ramenées à l'imperceptible.
  expect(durations.every((duration) => duration < 0.05)).toBe(true);
});

test('la page a un seul titre de premier niveau, et une langue déclarée', async ({ page }) => {
  await page.goto(`${MENU}/r/${SLUG}`);
  await expect(page.getByRole('heading', { name: 'Le Braisé du Carrefour' })).toBeVisible();

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('lang', /fr|en/);
});

test('le texte contraste suffisamment avec le fond, sur les deux chartes', async ({ page }) => {
  for (const slug of [SLUG, 'casa-lina']) {
    await page.goto(`${MENU}/r/${slug}`);
    await expect(page.locator('h1')).toBeVisible();

    const ratio = await page.evaluate(() => {
      const luminance = (color: string): number => {
        const [r, g, b] = color.match(/\d+/g)!.map(Number) as [number, number, number];
        const channel = (value: number): number => {
          const c = value / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };

      const style = getComputedStyle(document.querySelector('h1')!);
      const bodyStyle = getComputedStyle(document.body);
      const a = luminance(style.color);
      const b = luminance(bodyStyle.backgroundColor);
      const [hi, lo] = a > b ? [a, b] : [b, a];
      return (hi + 0.05) / (lo + 0.05);
    });

    expect(ratio, `contraste insuffisant sur ${slug}`).toBeGreaterThanOrEqual(4.5);
  }
});
