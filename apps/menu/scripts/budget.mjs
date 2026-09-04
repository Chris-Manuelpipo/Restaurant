import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

/**
 * Budget de performance du menu client.
 *
 * Le cahier des charges fixe **300 Ko transférés au premier chargement**, polices comprises,
 * images exclues. On mesure ce qui part réellement sur le réseau lors d'un scan de table :
 *
 *   app shell   — le JS et le CSS, toujours téléchargés ;
 *   polices     — deux seulement : Inter pour le corps, et **la** police de titre choisie par
 *                 le restaurant. Les trois autres familles sont dans `dist/` pour servir les
 *                 autres restaurants, mais aucun client ne les télécharge. On retient la plus
 *                 lourde des quatre, pour rester du côté prudent de la mesure.
 *
 * Les `.woff2` sont déjà compressés : leur taille brute est leur taille transférée.
 */
const BUDGET_KB = 300;
const dist = new URL('../dist/', import.meta.url).pathname;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else out.push(path);
  }
  return out;
}

async function measure(file) {
  const content = await readFile(file);
  const name = file.replace(dist, '');
  const size = (await stat(file)).size;
  const isFont = name.endsWith('.woff2');
  return {
    name,
    size,
    gzip: isFont ? size : gzipSync(content).length,
    transferred: isFont ? size : brotliCompressSync(content).length,
    isFont,
  };
}

const files = await walk(dist);
const measured = await Promise.all(
  files.filter((f) => /\.(js|css|woff2)$/.test(f) && !/registerSW\.js$/.test(f)).map(measure),
);

const shell = measured.filter((f) => !f.isFont);
const fonts = measured.filter((f) => f.isFont);
const body = fonts.find((f) => f.name.includes('inter-'));
const displays = fonts.filter((f) => f !== body);
const heaviestDisplay = displays.sort((a, b) => b.transferred - a.transferred)[0];

const firstLoad = [...shell, body, heaviestDisplay].filter(Boolean);
const total = firstLoad.reduce((sum, f) => sum + f.transferred, 0);

const kb = (n) => (n / 1024).toFixed(1).padStart(8);
const short = (n) => n.replace('assets/', '').replace(/-[A-Za-z0-9_-]{8}\./, '.');

console.log('\n  Menu client — poids du premier chargement\n');
console.log('    fichier                                        brut     gzip  transféré');
console.log('    ' + '─'.repeat(69));
for (const file of firstLoad.sort((a, b) => b.transferred - a.transferred)) {
  console.log(
    `    ${short(file.name).padEnd(42).slice(0, 42)} ${kb(file.size)} ${kb(file.gzip)} ${kb(file.transferred)}`,
  );
}
console.log('    ' + '─'.repeat(69));
console.log(`    ${'PREMIER CHARGEMENT'.padEnd(42)} ${''.padStart(8)} ${''.padStart(8)} ${kb(total)}`);

const unused = displays.filter((f) => f !== heaviestDisplay);
if (unused.length > 0) {
  const weight = unused.reduce((sum, f) => sum + f.size, 0);
  console.log(
    `\n    Hors budget : ${unused.length} polices de titre (${(weight / 1024).toFixed(1)} Ko) —` +
      ' servies uniquement aux restaurants qui les ont choisies.',
  );
}

const kbTotal = total / 1024;
console.log(`\n  Transféré : ${kbTotal.toFixed(1)} Ko  ·  budget : ${BUDGET_KB} Ko`);

if (kbTotal > BUDGET_KB) {
  console.error(`\n  ✗ Budget dépassé de ${(kbTotal - BUDGET_KB).toFixed(1)} Ko.\n`);
  process.exit(1);
}
console.log(`  ✓ Budget tenu, marge de ${(BUDGET_KB - kbTotal).toFixed(1)} Ko.\n`);
