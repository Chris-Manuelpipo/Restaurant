import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Menu client — application séparée du back-office.
 *
 * Son poids conditionne l'expérience du client final : elle n'embarque jamais une ligne de
 * l'admin. Budget tenu : moins de 300 Ko transférés au premier chargement, polices comprises.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Menu',
        short_name: 'Menu',
        description: 'Le menu du restaurant, consultable même hors ligne.',
        theme_color: '#17130F',
        background_color: '#17130F',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Les polices sont hors précache : une seule des cinq familles sert à un
        // restaurant donné, les précacher toutes imposerait un mégaoctet au premier scan.
        globPatterns: ['**/*.{js,css,html}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            /**
             * Le menu : réseau d'abord, cache ensuite. Une carte à jour vaut mieux qu'une
             * carte instantanée — mais une carte de la veille vaut infiniment mieux qu'une
             * page blanche dans un restaurant sans réseau.
             */
            urlPattern: /\/api\/v1\/public\/r\/[^/]+\/menu/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'menu-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'menu-fonts',
              expiration: { maxEntries: 6, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Les URL d'images portent le hachage de leur contenu : elles ne changent jamais.
            urlPattern: /\/media\/.*\.(?:webp|jpg|jpeg|png|avif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'menu-images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@evolyx/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        /**
         * Un seul point d'entrée applicatif, et les dépendances à part : le navigateur peut
         * garder le bundle des bibliothèques d'une visite à l'autre, même quand le menu change.
         */
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) return 'react';
            if (id.includes('@tanstack')) return 'tanstack';
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
  server: { port: 5181, strictPort: true },
});
