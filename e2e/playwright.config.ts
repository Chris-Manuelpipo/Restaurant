import { defineConfig, devices } from '@playwright/test';

/**
 * Recette de bout en bout — les deux parcours du cahier des charges.
 *
 * On pilote le Chrome déjà installé sur la machine (`channel: 'chrome'`) plutôt que de
 * télécharger un navigateur dédié : c'est cent cinquante mégaoctets de moins à installer,
 * et le rendu testé est celui d'un vrai Chrome.
 *
 * Les serveurs (API, back-office, menu) doivent tourner — `pnpm dev` les démarre tous les
 * trois. En intégration continue, `webServer` s'en charge.
 */
const API = process.env.E2E_API_URL ?? 'http://localhost:3010';
const ADMIN = process.env.E2E_ADMIN_URL ?? 'http://localhost:5180';
const MENU = process.env.E2E_MENU_URL ?? 'http://localhost:5181';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: ADMIN,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
  },

  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } },
    },
  ],

  /**
   * Le menu est servi **construit**, pas en mode développement : le service worker n'est
   * actif que dans le bundle de production, et c'est lui qui rend la carte consultable hors
   * ligne. Tester le mode dev reviendrait à tester autre chose que ce qu'on livre.
   *
   * `reuseExistingServer` laisse la main aux serveurs déjà lancés par `pnpm dev`.
   */
  webServer: [
    {
      command: 'pnpm --filter @evolyx/api dev',
      url: `${API}/health`,
      reuseExistingServer: true,
      timeout: 120_000,
      cwd: '..',
    },
    {
      command: 'pnpm --filter @evolyx/admin dev',
      url: `${ADMIN}/connexion`,
      reuseExistingServer: true,
      timeout: 120_000,
      cwd: '..',
    },
    {
      command: 'pnpm --filter @evolyx/menu build && pnpm --filter @evolyx/menu preview',
      url: MENU,
      reuseExistingServer: true,
      timeout: 180_000,
      cwd: '..',
    },
  ],

  metadata: { api: API, admin: ADMIN, menu: MENU },
});

export const URLS = { API, ADMIN, MENU };
