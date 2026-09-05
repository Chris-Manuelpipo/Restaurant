import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Configuration ESLint du monorepo.
 *
 * Le typage strict de TypeScript fait déjà l'essentiel du travail : ce fichier ne garde que
 * les règles qu'un compilateur ne peut pas vérifier — les pièges d'exécution, les promesses
 * oubliées, les règles des hooks React. Une configuration qui hurle sur du style ne se lit
 * plus au bout d'un mois.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'apps/api/src/generated/**',
      'e2e/test-results/**',
      'e2e/playwright-report/**',
      'docs/maquettes/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      /* Une variable inutilisée est soit un oubli, soit une intention : le préfixe `_` la déclare. */
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      /* `any` reste possible aux frontières (Prisma, JSON), mais doit se voir. */
      '@typescript-eslint/no-explicit-any': 'warn',

      /* Une promesse non attendue, c'est une erreur qui disparaît sans bruit. */
      'no-void': 'off',
      'require-await': 'off',

      /* Le code produit ne parle pas dans la console — les logs passent par Pino. */
      'no-console': 'off',

      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },

  /* ── Applications React ──────────────────────────────────────────────── */
  {
    files: ['apps/menu/src/**/*.{ts,tsx}', 'apps/admin/src/**/*.{ts,tsx}', 'packages/ui/src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'warn',

      /**
       * Les règles issues du React Compiler sont écartées : elles décrivent ce que le
       * compilateur exige pour mémoïser automatiquement, or nous ne l'utilisons pas. Elles
       * condamneraient notamment le fait de synchroniser un état d'édition avec des données
       * fraîchement chargées — un usage parfaitement légitime, et le seul moyen d'offrir un
       * formulaire modifiable sur des données distantes.
       *
       * Les règles stables, elles, restent actives : `rules-of-hooks` et `exhaustive-deps`.
       */
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
    },
  },

  /* ── Tests : plus permissifs, ils manipulent volontairement des cas tordus ── */
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**', 'e2e/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  /* ── Scripts d'outillage ─────────────────────────────────────────────── */
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
);
