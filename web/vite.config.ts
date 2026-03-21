import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load .env so VITE_API_URL is available for the dev proxy target
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico'],
        manifest: {
          name: 'Wacky Races UK Live Tracker',
          short_name: 'WackyRaces',
          description: 'Real-time GPS tracking for the 2026 Europe Rally',
          theme_color: '#0a0a0a',
          background_color: '#0a0a0a',
          display: 'standalone',
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/v1': {
          target: env.VITE_API_URL ?? 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
