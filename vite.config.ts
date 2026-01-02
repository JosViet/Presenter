import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';

import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'VietLMS Presenter',
        short_name: 'Presenter',
        description: 'VietLMS LaTeX Presenter for Tablets',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
        globIgnores: ['**/games/**'], // Exclude large game assets
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
      }
    }) as any
  ],
  base: './', // Important for Electron relative paths
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom')
    }
  },
  server: {
    port: 5180,
    strictPort: true,
    fs: {
      // allow: ['..'] // No longer needed to allow parent access if fully decoupled?
      // Actually leave it default or restrict it.
      // But let's remove the explicit 'allow' for '..' if it was just for shared.
    }
  }
})
