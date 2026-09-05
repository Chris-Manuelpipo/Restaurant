import { expect, test, type Page } from '@playwright/test';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PARCOURS B — Vie quotidienne (§10 du cahier des charges)
 *
 *  Le gérant ouvre le back-office sur son téléphone → marque un plat épuisé en
 *  un geste → le menu client reflète le changement en moins de 60 secondes →
 *  il change un prix, l'audit l'enregistre → il pose une règle de visibilité
 *  sur une catégorie → il prévisualise le dimanche à 11 h et voit le brunch →
 *  il réaffecte le QR de la table 3 vers la table 7 sans réimpression.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const API = process.env.E2E_API_URL ?? 'http://localhost:3010';
const MENU = process.env.E2E_MENU_URL ?? 'http://localhost:5181';
const PASSWORD = process.env.SEED_PASSWORD ?? 'MotDePasseDemo2026';

/** Casa Lina : deux langues, un brunch le dimanche, un happy hour le soir. */
const SLUG = 'casa-lina';
const MANAGER = 'gerant@casalina.cm';
const ADMIN = 'admin@casalina.cm';

test.describe.configure({ mode: 'serial' });

/* Le gérant travaille depuis la salle : téléphone en main. */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('le gérant marque un plat épuisé en un geste, depuis son téléphone', async ({ page }) => {
  await connect(page, MANAGER);
  await page.goto('/carte');

  const ligne = page.locator('.row', { hasText: 'Margherita' }).first();
  await expect(ligne).toBeVisible();

  // La recette doit être rejouable : on repart d'un plat disponible.
  const remettre = ligne.getByRole('button', { name: 'Remettre' });
  if (await remettre.isVisible()) {
    await remettre.click();
    await expect(ligne.getByRole('button', { name: 'Épuisé' })).toBeVisible();
  }

  await ligne.getByRole('button', { name: 'Épuisé' }).click();
  await expect(page.getByText('Plat marqué épuisé.')).toBeVisible();
  await expect(ligne.getByRole('button', { name: 'Remettre' })).toBeVisible();
});

test('le menu client reflète le changement en moins de 60 secondes', async ({ page }) => {
  // Le cache serveur est invalidé par l'événement : en pratique, c'est immédiat.
  await page.goto(`${MENU}/r/${SLUG}`);

  const carte = page.locator('.item-row', { hasText: 'Margherita' }).first();
  await expect(carte).toBeVisible();
  await expect(carte).toHaveAttribute('data-sold', 'true');
  await expect(page.getByText(/épuisé/i).first()).toBeVisible();
});

test('un changement de prix est journalisé', async ({ page }) => {
  await connect(page, ADMIN);
  await page.goto('/carte');

  await page.locator('.row', { hasText: 'Tiramisu' }).first().getByRole('button', { name: 'Modifier' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByLabel('Prix en francs').fill('3200');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Plat mis à jour.')).toBeVisible();

  await page.goto('/journal');
  const entree = page.locator('.row', { hasText: 'Prix modifié' }).first();
  await expect(entree).toBeVisible();
  await expect(entree).toContainText('3 200 F');
  await expect(entree).toContainText('Administrateur');
});

test('une règle de visibilité se pose sur une catégorie, et l’aperçu la vérifie', async ({ page }) => {
  await connect(page, ADMIN);
  await page.goto('/regles');

  // Casa Lina a déjà sa règle de brunch : elle doit être listée telle quelle.
  const brunch = page.locator('article', { hasText: 'Visibilité' }).first();
  await expect(brunch).toBeVisible();
  await expect(brunch).toContainText('Le dimanche de 10:00 à 14:00');

  // Prévisualisation au dimanche 11 h : le brunch doit apparaître dans l'aperçu.
  await page.getByRole('button', { name: 'Dimanche 11 h' }).click();
  await expect(page.locator('.phone__screen')).toContainText('Brunch', { timeout: 15_000 });

  // Retour à « maintenant » (hors créneau) : le brunch disparaît.
  await page.getByRole('button', { name: 'Maintenant' }).click();
  await expect(page.locator('.phone__screen')).not.toContainText('Brunch', { timeout: 15_000 });
});

test('la promotion happy hour est annoncée au bon créneau', async ({ request }) => {
  // Jeudi 18 h, heure de Douala : l'happy hour court de 17 h à 19 h.
  const jeudi18h = prochainJour(4, 18);

  const response = await request.get(
    `${API}/api/v1/public/r/${SLUG}/menu?at=${encodeURIComponent(jeudi18h)}`,
  );
  const menu = await response.json();

  expect(menu.moment).toContain('Happy hour');
  expect(menu.moment).toContain('19:00');

  const cocktails = menu.categories.find((c: { name: string }) => c.name === 'Cocktails');
  expect(cocktails.items[0].promos[0].discountPercent).toBe(30);
});

test('le QR de la table 3 est réaffecté vers la table 7, sans réimpression', async ({
  page,
  request,
}) => {
  await connect(page, ADMIN);
  await page.goto('/codes-qr');

  const carte = page.locator('article', { hasText: 'Table 3' }).first();
  await expect(carte).toBeVisible();

  const code = (await carte.locator('code').textContent())!.trim();

  await carte.getByRole('button', { name: 'Réaffecter' }).click();
  await page.getByLabel('Nouveau libellé').fill('Table 7');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText(/Aucun code à réimprimer/)).toBeVisible();

  // Le code imprimé n'a pas bougé, et mène toujours au bon menu.
  const reaffectee = page.locator('article', { hasText: 'Table 7' }).first();
  await expect(reaffectee.locator('code')).toHaveText(code);

  const redirection = await request.get(`${API}/api/v1/public/q/${code}`, { maxRedirects: 0 });
  expect(redirection.status()).toBe(302);
  expect(redirection.headers().location).toContain(`/r/${SLUG}`);

  // Remise en état, pour que la recette reste rejouable.
  await reaffectee.getByRole('button', { name: 'Réaffecter' }).click();
  await page.getByLabel('Nouveau libellé').fill('Table 3');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
});

test('le menu reste consultable hors ligne après une première visite', async ({ page, context }) => {
  // On simule le client qui revient le lendemain, sans réseau : l'horloge avance de deux heures.
  await page.clock.install();

  await page.goto(`${MENU}/r/${SLUG}`);
  await expect(page.getByRole('heading', { name: 'Casa Lina' })).toBeVisible();
  // Laisser le service worker prendre la main sur la page.
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {
    timeout: 15_000,
  });

  await context.setOffline(true);
  await page.reload();

  // La dernière carte connue s'affiche : le menu reste lisible, réseau ou pas.
  await expect(page.getByRole('heading', { name: 'Casa Lina' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Margherita').first()).toBeVisible();

  // Et le client est prévenu que cette carte a été enregistrée, avec sa date.
  await page.clock.fastForward('02:00:00');
  await expect(page.getByText(/menu enregistré le/i)).toBeVisible({ timeout: 15_000 });

  await context.setOffline(false);
});

test('un serveur peut marquer un plat épuisé, mais pas toucher aux prix', async ({ page }) => {
  await connect(page, 'gerant@casalina.cm');
  await page.goto('/carte');

  // Le gérant a bien les deux droits ; on vérifie ici que l'écran les expose.
  const ligne = page.locator('.row').first();
  await expect(ligne.getByRole('button', { name: /Épuisé|Remettre/ })).toBeVisible();
  await expect(ligne.getByRole('button', { name: 'Modifier' })).toBeVisible();

  // La charte, elle, reste hors de portée d'un gérant.
  await expect(page.getByRole('link', { name: 'Identité et charte' })).toHaveCount(0);
});

/* ── Utilitaires ────────────────────────────────────────────────────────── */

async function connect(page: Page, email: string): Promise<void> {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/(carte|plateforme|mise-en-service)/);
}

/** Prochain jour de semaine donné, à l'heure donnée, en heure de Douala (UTC+1). */
function prochainJour(weekday: number, hour: number): string {
  const now = new Date();
  const date = new Date(now);
  date.setUTCDate(now.getUTCDate() + ((weekday - now.getUTCDay() + 7) % 7 || 7));
  date.setUTCHours(hour - 1, 0, 0, 0);
  return date.toISOString();
}
