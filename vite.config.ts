import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// L'app est servie sous https://maiwennlrc.github.io/budget-app/
// → tous les chemins doivent commencer par /budget-app/
export default defineConfig({
  base: '/budget-app/',
  // Date de construction, affichée dans Réglages pour vérifier qu'on a la dernière version.
  define: {
    __VERSION__: JSON.stringify(
      new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }),
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        // pdf.js (le lecteur de PDF) pèse ~1,3 Mo : on l'autorise dans le cache hors ligne.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Mon budget',
        short_name: 'Mon budget',
        description: "Suivi de budget et audit d'abonnements, 100 % local",
        lang: 'fr',
        theme_color: '#7b3f61',
        background_color: '#fdf3ee',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/budget-app/',
        scope: '/budget-app/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
