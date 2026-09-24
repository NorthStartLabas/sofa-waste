import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves this repo at https://northstartlabas.github.io/sofa-waste/
const base = '/sofa-waste/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A new deploy waits for the next time the phone comes out of a pocket;
      // src/lib/serviceWorker.ts picks the moment. Never a reload mid-tap.
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: 'SOFA Verspilling',
        short_name: 'Verspilling',
        description: 'Keukenverspilling registreren voor SOFA Maastricht.',
        lang: 'nl',
        start_url: base,
        scope: base,
        display: 'standalone',
        theme_color: '#2b3529',
        background_color: '#f6f3ee',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        // Supabase is another origin and always goes to the network.
        navigateFallbackDenylist: [/supabase\.co/],
        globPatterns: ['**/*.{js,css,html,woff,woff2,png,svg}'],
      },
    }),
  ],
})
