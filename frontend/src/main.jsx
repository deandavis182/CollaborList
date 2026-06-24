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
import { registerServiceWorker } from './lib/push'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers>
      <RouterApp />
    </Providers>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  // Capture whether the page is already controlled BEFORE any new worker claims.
  const hadController = !!navigator.serviceWorker.controller
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only auto-reload when an existing controller is replaced (a deploy update),
    // never on the first install, and guard against reload loops.
    if (reloading || !hadController) return
    reloading = true
    window.location.reload()
  })
  window.addEventListener('load', () => { registerServiceWorker() })
}
