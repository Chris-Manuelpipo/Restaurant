import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Back-office. Contrairement au menu client, il n'a pas de budget serré : il est ouvert
 * une fois le matin sur un poste ou une tablette, pas scanné vingt fois par service.
 * On y met donc ce qu'il faut de confort — formulaires, aperçu vivant, tableaux.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    /**
     * Alias sous forme de liste, et non d'objet : « @evolyx/ui » doit viser le module,
     * tandis que « @evolyx/ui/tokens.css » doit viser le fichier. Un alias par préfixe
     * transformerait le second en « …/index.tsx/tokens.css ».
     */
    alias: [
      {
        find: /^@evolyx\/shared$/,
        replacement: fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
      },
      {
        find: /^@evolyx\/ui$/,
        replacement: fileURLToPath(new URL('../../packages/ui/src/index.tsx', import.meta.url)),
      },
      {
        find: /^@evolyx\/ui\/(.*)$/,
        replacement: `${fileURLToPath(new URL('../../packages/ui/src/', import.meta.url))}$1`,
      },
      { find: /^@\//, replacement: `${fileURLToPath(new URL('./src/', import.meta.url))}` },
    ],
  },
  server: { port: 5180, strictPort: true },
  build: { target: 'es2020' },
});
