/* global self */
import { precacheAndRoute } from 'workbox-precaching'

// Injected at build by vite-plugin-pwa (injectManifest).
precacheAndRoute(self.__WB_MANIFEST || [])

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
// push + notificationclick handlers added in Task 8.
