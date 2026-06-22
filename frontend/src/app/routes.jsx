/**
 * routes.jsx — react-router v6 route configuration for the V2 shell.
 *
 * Layout route: AppLayout (renders <Outlet /> for nested pages).
 *   /                          → HomeView ("Select a workspace")
 *   /w/:workspaceId            → WorkspaceView (shows workspace id)
 *   /w/:workspaceId/p/:projectId → ProjectView (shows workspace + project ids)
 *
 * NOTE: This module exports both `createAppRouter` (for the real app entry)
 * and `AppRoutes` (a plain <Routes> component for testing with <MemoryRouter>).
 */

import { createBrowserRouter, RouterProvider, Routes, Route, useParams, Outlet } from 'react-router-dom'
import { AppLayout } from './AppLayout.jsx'
import { ProjectView } from '../features/projects/ProjectView.jsx'

// ---------------------------------------------------------------------------
// Placeholder views
// ---------------------------------------------------------------------------

/** Home: shown at "/" — prompts the user to pick a workspace. */
export function HomeView() {
  return (
    <div data-testid="home-view" className="p-8 text-text-muted">
      Select a workspace
    </div>
  )
}

/** Workspace: shown at "/w/:workspaceId". */
export function WorkspaceView() {
  const { workspaceId } = useParams()
  return (
    <div data-testid="workspace-view" className="p-8">
      <p data-testid="workspace-id-display">Workspace: {workspaceId}</p>
    </div>
  )
}

// ProjectView is now the real feature component from features/projects/ProjectView.jsx
export { ProjectView }

// ---------------------------------------------------------------------------
// Plain <Routes> tree — used in tests with <MemoryRouter>
// ---------------------------------------------------------------------------

/**
 * AppRoutes — renders the route tree without any router wrapping.
 * Wrap with <MemoryRouter initialEntries={[...]}>  in tests.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomeView />} />
        <Route path="w/:workspaceId" element={<WorkspaceView />} />
        <Route path="w/:workspaceId/p/:projectId" element={<ProjectView />} />
      </Route>
    </Routes>
  )
}

// ---------------------------------------------------------------------------
// createBrowserRouter — used in the real entry (main-v2.jsx)
// ---------------------------------------------------------------------------

/**
 * createAppRouter — returns a BrowserRouter suitable for the production entry.
 * Separated from the module top-level so tests don't instantiate it.
 */
export function createAppRouter() {
  return createBrowserRouter([
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: <HomeView /> },
        { path: 'w/:workspaceId', element: <WorkspaceView /> },
        { path: 'w/:workspaceId/p/:projectId', element: <ProjectView /> },
      ],
    },
  ])
}

/**
 * RouterApp — the top-level component to mount in main-v2.jsx.
 * Instantiates a BrowserRouter once and keeps it stable for the app lifetime.
 */
let _router = null
function getRouter() {
  if (!_router) _router = createAppRouter()
  return _router
}

export function RouterApp() {
  return <RouterProvider router={getRouter()} />
}
