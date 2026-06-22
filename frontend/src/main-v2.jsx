/**
 * main-v2.jsx — alternate entry point for the CollaborList V2 shell.
 *
 * This file is NOT referenced by index.html; the live app continues to
 * load via main.jsx → RealtimeApp.  This entry exists so the V2 shell
 * can be developed and tested in isolation.  The Phase 2C "parity flip"
 * will swap index.html to point here instead of main.jsx.
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
