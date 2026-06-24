/**
 * AppLayout — responsive shell.
 *
 * Desktop (>= md):
 *   - Left: <Sidebar />
 *   - Center: <main> renders children / <Outlet />
 *   - Right: detail surface is now mounted by ListView (ItemDetailDrawer)
 *
 * Mobile (< md):
 *   - Desktop header + sidebar hidden
 *   - <MobileTabBar /> floating at the bottom with real navigation
 *   - Global <MobileItemSheet /> + <QuickAddSheet /> mounted once
 *   - Content full-width
 *   - Detail surface handled by ItemDetailDrawer inside ListView
 */

import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../lib/store.js'
import { Sidebar } from './Sidebar.jsx'
import { PresenceBar } from '../features/collab/PresenceBar.jsx'
import { NotificationPrefs } from '../features/notifications/NotificationPrefs.jsx'
import { useWorkspaceActivity } from '../lib/api.js'
import { getUser, logout } from '../lib/auth.js'
import { Button } from '../ui/Button.jsx'
import { Toast } from '../ui/Toast.jsx'
import { useIsMobile } from '../lib/useMediaQuery.js'
import { MobileTabBar } from '../features/mobile/MobileTabBar.jsx'
import { MobileItemSheet } from '../features/mobile/MobileItemSheet.jsx'
import { QuickAddSheet } from '../features/mobile/QuickAddSheet.jsx'

export function AppLayout({ children }) {
  const currentWorkspaceId = useStore((s) => s.currentWorkspaceId)
  const setQuickAddOpen = useStore((s) => s.setQuickAddOpen)
  const toast = useStore((s) => s.toast)
  const dismissToast = useStore((s) => s.dismissToast)
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = getUser()
  const [notifOpen, setNotifOpen] = useState(false)
  const isMobile = useIsMobile()

  // Auto-dismiss the global toast after a short delay
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => dismissToast(), 2500)
    return () => clearTimeout(t)
  }, [toast, dismissToast])

  // Derive mobile tab from the current path
  const path = location.pathname
  let mobileTab = 'lists'
  if (path === '/my-tasks') mobileTab = 'today'
  else if (path === '/') mobileTab = 'lists'
  else if (path.endsWith('/activity')) mobileTab = 'activity'
  else if (path === '/me') mobileTab = 'me'

  // Activity unread dot — guard when no workspace is selected
  const activityQuery = useWorkspaceActivity(currentWorkspaceId ?? null)
  const activityUnread = currentWorkspaceId
    ? (activityQuery?.data?.unread ?? 0) > 0
    : false

  function handleMobileSelect(tab) {
    if (tab === 'today') navigate('/my-tasks')
    else if (tab === 'lists') navigate('/')
    else if (tab === 'activity') { if (currentWorkspaceId) navigate(`/w/${currentWorkspaceId}/activity`) }
    else if (tab === 'me') navigate('/me')
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg">
      {/* ------------------------------------------------------------------ */}
      {/* App header — slim bar across the top with presence avatars           */}
      {/* Desktop only; hidden on mobile                                       */}
      {/* ------------------------------------------------------------------ */}
      {!isMobile && (
        <header
          data-testid="app-header"
          className="h-12 border-b border-border bg-surface flex items-center justify-between px-4 shrink-0"
        >
          {/* Left side — presence avatars */}
          <PresenceBar />

          {/* Right side — current user email + notifications + logout */}
          <div className="flex items-center gap-3">
            {currentUser?.email && (
              <span
                data-testid="header-user-email"
                className="text-sm text-text-muted truncate max-w-[200px]"
              >
                {currentUser.email}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              data-testid="open-notifications-btn"
              onClick={() => setNotifOpen(true)}
            >
              Notifications
            </Button>
            <Button
              variant="ghost"
              size="sm"
              data-testid="logout-btn"
              onClick={() => {
                logout()
                window.location.assign('/login')
              }}
            >
              Log out
            </Button>
          </div>

        </header>
      )}

      {/* Notification prefs sheet — rendered outside header to avoid landmark nesting */}
      <NotificationPrefs open={notifOpen} onClose={() => setNotifOpen(false)} />

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
      {/* Bottom navigation — mobile only: MobileTabBar + global sheets        */}
      {/* (Desktop navigation lives in the Sidebar; the old BottomTabBar is    */}
      {/*  superseded by MobileTabBar and no longer mounted by the shell.)     */}
      {/* ------------------------------------------------------------------ */}
      {isMobile && (
        <>
          <MobileTabBar
            activeTab={mobileTab}
            onSelect={handleMobileSelect}
            onAdd={() => setQuickAddOpen(true)}
            activityUnread={activityUnread}
          />
          <MobileItemSheet />
          <QuickAddSheet />
          {toast && (
            <div className="fixed inset-x-4 bottom-24 z-40 flex justify-center">
              <Toast message={toast.message} variant={toast.variant} onDismiss={dismissToast} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
