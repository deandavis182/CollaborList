/**
 * main.jsx — primary entry point for the CollaborList V2 shell.
 *
 * Mounting order:
 *   1. tokens.css  — CSS custom-property design tokens
 *   2. index.css   — Tailwind base / component / utility layers
 *   3. <Providers> — QueryClient + theme wrapper
 *   4. <RouterApp> — BrowserRouter + AppLayout + route tree
 */

import React from 'react'
import ReactDOM from 'react-dom/client'

import './ui/tokens.css'
import './index.css'

import { Providers } from './app/providers.jsx'
import { RouterApp } from './app/routes.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers>
      <RouterApp />
    </Providers>
  </React.StrictMode>,
)

// Service worker registration — Task 9 will replace this inline call with
// registerServiceWorker() from lib/push.js once the push helper is built.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW registration failed:', e))
  })
}
