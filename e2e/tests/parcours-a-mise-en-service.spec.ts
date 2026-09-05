import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PARCOURS A — Mise en service (§10 du cahier des charges)
 *
 *  Le platform-admin crée un restaurant → l'admin reçoit un lien d'invitation,
 *  définit son mot de passe → il traverse les cinq étapes avec l'aperçu qui
 *  suit chaque frappe → il publie → le menu est servi → le PDF des QR se
 *  télécharge et chaque code redirige vers le bon menu.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const API = process.env.E2E_API_URL ?? 'http://localhost:3010';
const MENU = process.env.E2E_MENU_URL ?? 'http://localhost:5181';
const PLATFORM_PASSWORD = process.env.SEED_PASSWORD ?? 'MotDePasseDemo2026';

/** Chaque exécution crée son propre restaurant : la recette ne dépend d'aucun état. */
const stamp = Date.now().toString(36);
const SLUG = `recette-${stamp}`;
const RESTAURANT = `Chez Recette ${stamp}`;
const ADMIN_EMAIL = `admin.${stamp}@recette.cm`;
const ADMIN_PASSWORD = 'MotDePasseDeRecette2026';

test.describe.configure({ mode: 'serial' });

let invitationUrl = '';

test('le platform-admin crée un restaurant et obtient un lien d’invitation', async ({ request }) => {
  const token = await platformToken(request);

  const response = await request.post(`${API}/api/v1/platform/restaurants`, {
    headers: { authorization: `Bearer ${token}` },
    data: {
      name: RESTAURANT,
      slug: SLUG,
      adminEmail: ADMIN_EMAIL,
      adminFullName: 'Administrateur de recette',
    },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.restaurant.slug).toBe(SLUG);
  expect(body.restaurant.status).toBe('TRIAL');

  invitationUrl = body.invitation.url as string;
  expect(invitationUrl).toContain('/invitation/');
});

test('l’administrateur définit son mot de passe et arrive sur la mise en service', async ({ page }) => {
  await page.goto(invitationUrl);

  await expect(page.getByText(RESTAURANT).first()).toBeVisible();
  await page.getByLabel('Mot de passe', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByLabel('Confirmation').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(page.getByText('Étape 1 sur 5').first()).toBeVisible();
});

test('les cinq étapes se traversent, l’aperçu suivant chaque frappe', async ({ page }) => {
  await connect(page);
  await page.goto('/mise-en-service');

  /* — Étape 1 : identité ————————————————————————————————— */
  await expect(page.getByRole('heading', { name: /votre enseigne/i })).toBeVisible();

  const tagline = 'Cuisine du marché, tous les midis.';
  await page.getByLabel('Accroche').fill(tagline);

  // L'aperçu reprend la frappe immédiatement, sans enregistrement préalable.
  await expect(page.locator('.phone__screen')).toContainText(tagline);

  await page.getByRole('button', { name: /Continuer/ }).click();

  /* — Étape 2 : charte ——————————————————————————————————— */
  await expect(page.getByRole('heading', { name: /vos couleurs/i })).toBeVisible();

  await page.getByRole('button', { name: '#FF6A2C' }).click();
  await page.getByRole('button', { name: '#17130F' }).click();

  // Le contraste est calculé et affiché, sans jamais bloquer la saisie.
  await expect(page.getByText(/Contraste confortable/)).toBeVisible();

  await page.getByRole('button', { name: /Fraunces/ }).click();
  await page.getByRole('button', { name: /Continuer/ }).click();

  /* — Étape 3 : infos et horaires ———————————————————————— */
  await expect(page.getByRole('heading', { name: /Où vous trouver/i })).toBeVisible();
  await page.getByLabel('Adresse').fill('Rue de la Recette, Douala');
  await page.getByLabel('Téléphone').fill('+237 6 00 00 00 00');
  await page.getByRole('button', { name: /Continuer/ }).click();

  /* — Étape 4 : le menu par collage ——————————————————————— */
  await expect(page.getByRole('heading', { name: /Collez votre carte/i })).toBeVisible();

  await page.getByLabel('Votre carte').fill(
    [
      'GRILLADES',
      'Poulet braisé entier – 4 500',
      'Brochettes de bœuf : 1000',
      'Côtelettes de porc  3.500 F',
      '',
      'BOISSONS',
      'Jus de gingembre – 1 000',
      'Crevettes sautées à l’ail et au persil',
    ].join('\n'),
  );
  await page.getByRole('button', { name: 'Lire ma carte' }).click();

  // Quatre lignes comprises, une à corriger : le parseur ne devine jamais un prix.
  await expect(page.getByText('4 plats reconnus')).toBeVisible();
  await expect(page.getByText('1 à corriger')).toBeVisible();

  await page.getByLabel(/Prix pour/).fill('5500');
  await expect(page.getByText('5 plats seront créés')).toBeVisible();

  await page.getByRole('button', { name: /Continuer/ }).click();

  /* — Étape 5 : les codes QR ——————————————————————————— */
  await expect(page.getByRole('heading', { name: /Vos codes/i })).toBeVisible();
  await page.getByLabel('Combien ?').fill('4');
  await page.getByRole('button', { name: /Générer 4 codes/ }).click();

  await expect(page.getByText('4 points d’accès')).toBeVisible();
  await expect(page.getByText('Table 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Table 4', { exact: true })).toBeVisible();

  /* — Publication ——————————————————————————————————————— */
  await page.getByRole('button', { name: /Publier mon menu/ }).click();
  await expect(page).toHaveURL(/\/carte/);
  await expect(page.getByText('Poulet braisé entier')).toBeVisible();
});

test('le menu publié est servi au client, avec la charte choisie', async ({ page }) => {
  await page.goto(`${MENU}/r/${SLUG}`);

  await expect(page.getByRole('heading', { name: RESTAURANT })).toBeVisible();
  await expect(page.getByText('Cuisine du marché, tous les midis.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Grillades' })).toBeVisible();
  await expect(page.getByText('Poulet braisé entier')).toBeVisible();

  // La charte du restaurant est bien appliquée, dérivée par deriveTheme().
  const background = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
  );
  expect(background.toUpperCase()).toBe('#17130F');
});

test('le pack PDF se télécharge et chaque code mène au bon menu', async ({ page, request }) => {
  await connect(page);
  await page.goto('/codes-qr');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Pack A6' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toContain('.pdf');

  // Le contenu est bien un PDF, pas une page d'erreur déguisée.
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe('%PDF-');

  // Chaque code imprimé redirige vers le menu de ce restaurant, et lui seul.
  const codes = await page.locator('code').allTextContents();
  expect(codes.length).toBeGreaterThan(0);

  for (const code of codes.slice(0, 2)) {
    const response = await request.get(`${API}/api/v1/public/q/${code.trim()}`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers().location).toContain(`/r/${SLUG}`);
  }
});

/* ── Utilitaires ────────────────────────────────────────────────────────── */

async function platformToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API}/api/v1/auth/login`, {
    data: { email: 'platform@evolyx.cm', password: PLATFORM_PASSWORD },
  });
  expect(response.ok(), 'le compte plateforme doit exister — lancez `pnpm seed`').toBeTruthy();
  return (await response.json()).accessToken as string;
}

async function connect(page: Page): Promise<void> {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(ADMIN_EMAIL);
  await page.getByLabel('Mot de passe').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/(carte|mise-en-service)/);
}
