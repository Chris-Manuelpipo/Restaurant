import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Les tests lisent les sources de `@evolyx/shared` plutôt que son `dist` : on ne veut pas
 * qu'un oubli de build fasse passer une suite sur du code périmé.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@evolyx/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/tests/helpers/setup.ts'],
    globalSetup: ['src/tests/helpers/global-setup.ts'],
    // Les tests d'intégration partagent une base : ils ne peuvent pas tourner en parallèle.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['**/*.test.ts'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
      reporter: ['text', 'html'],
    },
  },
});
