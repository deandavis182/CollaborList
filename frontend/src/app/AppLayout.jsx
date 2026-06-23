/**
 * AppLayout — responsive shell.
 *
 * Desktop (>= md):
 *   - Left: <Sidebar />
 *   - Center: <main> renders children / <Outlet />
 *   - Right: detail surface is now mounted by ListView (ItemDetailDrawer)
 *
 * Mobile (< md):
 *   - Sidebar hidden
 *   - <BottomTabBar /> fixed at bottom with real navigation
 *   - Content full-width
 *   - Detail surface handled by ItemDetailDrawer inside ListView
 */

import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../lib/store.js'
import { Sidebar } from './Sidebar.jsx'
import { BottomTabBar } from './BottomTabBar.jsx'
import { PresenceBar } from '../features/collab/PresenceBar.jsx'
import { useWorkspaceActivity } from '../lib/api.js'

export function AppLayout({ children }) {
  const currentWorkspaceId = useStore((s) => s.currentWorkspaceId)
  const navigate = useNavigate()
  const location = useLocation()

  // Derive activeTab from the current path
  const path = location.pathname
  let activeTab = 'home'
  if (path === '/' || path === '/my-tasks') {
    activeTab = 'home'
  } else if (path.endsWith('/activity')) {
    activeTab = 'activity'
  }

  // Activity unread dot — guard when no workspace is selected
  const activityQuery = useWorkspaceActivity(currentWorkspaceId ?? null)
  const activityUnread = currentWorkspaceId
    ? (activityQuery?.data?.unread ?? 0) > 0
    : false

  function handleTabSelect(tab) {
    if (tab === 'home') {
      navigate('/my-tasks')
    } else if (tab === 'activity') {
      if (currentWorkspaceId) {
        navigate(`/w/${currentWorkspaceId}/activity`)
      }
      // no-op if no workspace selected
    }
    // search, add, me — no-op for now (Phase later)
  }

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
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom tab bar — visible only on mobile (< md)                      */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-testid="bottom-bar-container"
        className="md:hidden"
      >
        <BottomTabBar
          activeTab={activeTab}
          onSelect={handleTabSelect}
          activityUnread={activityUnread}
        />
      </div>
    </div>
  )
}
