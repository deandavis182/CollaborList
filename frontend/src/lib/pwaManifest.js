/**
 * pwaManifest.js — Web App Manifest configuration.
 *
 * Extracted so it can be imported by vite.config.js (build-time)
 * and tested independently in vitest without importing the full Vite config.
 */

export const pwaManifest = {
  name: 'CollaborList',
  short_name: 'CollaborList',
  description: 'Plan together — lists, tasks, and your wedding, in real time.',
  theme_color: '#4f46e5',
  background_color: '#ffffff',
  display: 'standalone',
  start_url: '/',
  scope: '/',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}
