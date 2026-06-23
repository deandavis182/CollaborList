/**
 * AppLayout — responsive shell.
 *
 * Desktop (>= md):
 *   - Left: <Sidebar />
 *   - Center: <main> renders children / <Outlet />
 *   - Right: <Sheet variant="drawer"> when detailItemId is set
 *
 * Mobile (< md):
 *   - Sidebar hidden
 *   - <BottomTabBar /> fixed at bottom
 *   - Content full-width
 *   - Detail uses <Sheet variant="fullscreen">
 */

import { Outlet } from 'react-router-dom'
import { useStore } from '../lib/store.js'
import { Sheet } from '../ui/index.js'
import { Sidebar } from './Sidebar.jsx'
import { BottomTabBar } from './BottomTabBar.jsx'
import { PresenceBar } from '../features/collab/PresenceBar.jsx'
import { useState } from 'react'

export function AppLayout({ children }) {
  const detailItemId = useStore((s) => s.detailItemId)
  const closeDetail = useStore((s) => s.closeDetail)

  const [activeTab, setActiveTab] = useState('home')

  const detailOpen = Boolean(detailItemId)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg">
      {/* ------------------------------------------------------------------ */}
      {/* App header — slim bar across the top with presence avatars           */}
      {/* ------------------------------------------------------------------ */}
      <header
        data-testid="app-header"
        className="h-12 border-b border-border bg-surface flex items-center justify-end px-4 shrink-0"
      >
        <PresenceBar />
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Main row: sidebar + content                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — visible only on md+ */}
        <div
          data-testid="sidebar-container"
          className="hidden md:flex"
        >
          <Sidebar />
        </div>

        {/* Content area */}
        <main
          data-testid="main-content"
          className="flex-1 overflow-y-auto"
        >
          {/* Support both direct children (tests/stories) and <Outlet /> (router) */}
          {children ?? <Outlet />}
        </main>

        {/* Right detail — desktop drawer, hidden on mobile (mobile uses Sheet fullscreen below) */}
        <div className="hidden md:block">
          <Sheet
            variant="drawer"
            open={detailOpen}
            onClose={closeDetail}
            title="Detail"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom tab bar — visible only on mobile (< md)                      */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-testid="bottom-bar-container"
        className="md:hidden"
      >
        <BottomTabBar activeTab={activeTab} onSelect={setActiveTab} />
      </div>

      {/* Mobile detail sheet — fullscreen, rendered outside the row so it covers everything */}
      <div className="md:hidden">
        <Sheet
          variant="fullscreen"
          open={detailOpen}
          onClose={closeDetail}
          title="Detail"
        />
      </div>
    </div>
  )
}
