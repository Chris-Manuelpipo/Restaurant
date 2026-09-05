import { chromium } from '@playwright/test';

/**
 * Mesure du menu client dans les conditions du cahier des charges :
 * réseau « Slow 4G », processeur ralenti quatre fois, cache vide.
 *
 * On pilote Chrome par le protocole DevTools plutôt que par un outil clé en main : on veut
 * les trois chiffres qui comptent (poids transféré, LCP, premier rendu) sur la page réelle,
 * pas un score composite.
 *
 *   node e2e/scripts/measure.mjs [url]
 */

const URL_CIBLE = process.argv[2] ?? 'http://localhost:5181/r/le-braise-du-carrefour';
const PASSES = 3;

/** Profil « Slow 4G » de Chrome DevTools. */
const SLOW_4G = {
  offline: false,
  downloadThroughput: (400 * 1024) / 8,
  uploadThroughput: (400 * 1024) / 8,
  latency: 400,
};

async function mesure(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  await cdp.send('Network.enable');
  await cdp.send('Network.clearBrowserCache');
  await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  let transferred = 0;
  const parType = new Map();

  page.on('response', async (response) => {
    try {
      const headers = await response.allHeaders();
      const taille = Number(headers['content-length'] ?? 0);
      const type = (headers['content-type'] ?? 'autre').split(';')[0];
      transferred += taille;
      parType.set(type, (parType.get(type) ?? 0) + taille);
    } catch {
      /* réponse disparue : sans importance pour l'ordre de grandeur */
    }
  });

  const debut = Date.now();
  await page.goto(URL_CIBLE, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForSelector('h1', { timeout: 60_000 });

  // Le LCP n'est définitif qu'une fois la page stabilisée.
  await page.waitForTimeout(2500);

  const metrics = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const paint = performance.getEntriesByType('paint');
        const nav = performance.getEntriesByType('navigation')[0];

        // Le LCP ne se lit pas par getEntriesByType : il faut un observateur, avec
        // `buffered` pour récupérer les entrées émises avant son installation.
        let lcp = null;
        let lcpElement = null;
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) {
            const last = entries[entries.length - 1];
            lcp = last.startTime;
            lcpElement = last.element
              ? `${last.element.tagName.toLowerCase()}${last.element.className ? '.' + String(last.element.className).split(' ')[0] : ''}`
              : last.url ?? '?';
          }
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });

        setTimeout(() => {
          observer.disconnect();
          resolve({
            fcp: paint.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? null,
            lcp,
            lcpElement,
            domContentLoaded: nav?.domContentLoadedEventEnd ?? null,
            load: nav?.loadEventEnd ?? null,
          });
        }, 400);
      }),
  );

  const cls = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 300);
      }),
  );

  // `content-length` est absent des réponses compressées en flux : l'API Resource Timing,
  // elle, expose la taille réellement transférée, en-têtes compris.
  const transferredReal = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .concat(performance.getEntriesByType('navigation'))
      .reduce((sum, entry) => sum + (entry.transferSize ?? 0), 0),
  );

  await context.close();
  return {
    ...metrics,
    cls,
    transferred: Math.max(transferred, transferredReal),
    parType,
    wall: Date.now() - debut,
  };
}

const browser = await chromium.launch({ channel: 'chrome' });
const runs = [];
for (let i = 0; i < PASSES; i += 1) runs.push(await mesure(browser));
await browser.close();

const mediane = (valeurs) => {
  const tri = valeurs.filter((v) => v != null).sort((a, b) => a - b);
  return tri.length ? tri[Math.floor(tri.length / 2)] : null;
};
const ms = (v) => (v == null ? 'n/d' : `${(v / 1000).toFixed(2)} s`);

console.log(`\n  Menu client — ${URL_CIBLE}`);
console.log('  Slow 4G (400 kb/s, 400 ms de latence) · CPU ×4 · cache vide · 3 passes\n');
console.log(`    Premier rendu (FCP)      ${ms(mediane(runs.map((r) => r.fcp)))}`);
console.log(
  `    Plus grand contenu (LCP) ${ms(mediane(runs.map((r) => r.lcp)))}   ← budget 2,50 s  [${runs[0].lcpElement ?? '?'}]`,
);
console.log(`    DOM prêt                 ${ms(mediane(runs.map((r) => r.domContentLoaded)))}`);
console.log(`    Chargement complet       ${ms(mediane(runs.map((r) => r.load)))}`);
console.log(`    Décalage cumulé (CLS)    ${mediane(runs.map((r) => r.cls))?.toFixed(4) ?? 'n/d'}   ← budget 0,10`);
console.log(
  `    Transféré                ${(mediane(runs.map((r) => r.transferred)) / 1024).toFixed(1)} Ko (images comprises)`,
);
const parType = runs[0].parType;
for (const [type, taille] of [...parType].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
  if (taille > 0) console.log(`       · ${type.padEnd(26)} ${(taille / 1024).toFixed(1)} Ko`);
}
console.log('');

const lcp = mediane(runs.map((r) => r.lcp));
if (lcp != null && lcp > 2500) {
  console.error('  ✗ LCP au-dessus du budget.\n');
  process.exit(1);
}
console.log('  ✓ Budget tenu.\n');
