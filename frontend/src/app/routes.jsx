/**
 * routes.jsx — react-router v6 route configuration for the V2 shell.
 *
 * Layout route: AppLayout (renders <Outlet /> for nested pages).
 *   /                          → HomeView (workspace overview / prompt)
 *   /w/:workspaceId            → WorkspaceView (syncs store, shows projects + settings)
 *   /w/:workspaceId/p/:projectId → ProjectView (syncs store, shows lists + settings)
 *
 * NOTE: This module exports both `createAppRouter` (for the real app entry)
 * and `AppRoutes` (a plain <Routes> component for testing with <MemoryRouter>).
 */

import { createHashRouter, RouterProvider, Routes, Route, useParams, Outlet, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AppLayout } from './AppLayout.jsx'
import { ProjectView as ProjectViewFeature } from '../features/projects/ProjectView.jsx'
import { ProjectSettings } from '../features/projects/ProjectSettings.jsx'
import { TagManager } from '../features/tags/TagManager.jsx'
import { MemberManager } from '../features/members/MemberManager.jsx'
import { MyTasksView } from '../features/tasks/MyTasksView.jsx'
import { ActivityFeed } from '../features/collab/ActivityFeed.jsx'
import { ListView } from '../features/items/ListView.jsx'
import { LoginView } from '../features/auth/LoginView.jsx'
import { RequireAuth } from '../features/auth/RequireAuth.jsx'
import { Sheet } from '../ui/Sheet.jsx'
import { Button } from '../ui/Button.jsx'
import { useStore } from '../lib/store.js'
import { useWorkspaces, useProjects } from '../lib/api.js'

// ---------------------------------------------------------------------------
// HomeView — shown at "/"
// ---------------------------------------------------------------------------

/**
 * Home: if the user has workspaces, prompt them to select one from the sidebar.
 * If no workspaces exist yet, show a welcome prompt to create one.
 */
export function HomeView() {
  const { data: workspaces = [], isLoading } = useWorkspaces()
  const currentWorkspaceId = useStore((s) => s.currentWorkspaceId)

  if (isLoading) {
    return (
      <div data-testid="home-view" className="p-8 text-text-muted">
        Loading…
      </div>
    )
  }

  // Workspace selected via sidebar — prompt to pick a project
  if (currentWorkspaceId) {
    return (
      <div data-testid="home-view" className="p-8 max-w-2xl">
        <h1 className="text-2xl font-semibold text-text mb-2">Welcome back</h1>
        <p className="text-text-muted">
          Select a project from the sidebar to get started.
        </p>
      </div>
    )
  }

  // No workspaces at all — prompt to create
  if (workspaces.length === 0) {
    return (
      <div data-testid="home-view" className="p-8 max-w-2xl">
        <h1 className="text-2xl font-semibold text-text mb-2">
          Welcome to CollaborList
        </h1>
        <p className="text-text-muted mb-4">
          Create a workspace to get started organising your projects.
        </p>
        <p className="text-sm text-text-muted">
          Use the <strong>+ New workspace</strong> button in the sidebar.
        </p>
      </div>
    )
  }

  // Workspaces exist but none selected — prompt to pick one
  return (
    <div data-testid="home-view" className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-text mb-2">
        Select a workspace
      </h1>
      <p className="text-text-muted mb-4">
        Pick a workspace from the sidebar to view its projects.
      </p>
      <ul className="flex flex-col gap-2" role="list">
        {workspaces.map((ws) => (
          <li key={ws.id}>
            <Link
              to={`/w/${ws.id}`}
              data-testid={`home-workspace-link-${ws.id}`}
              className="inline-block px-4 py-2 rounded-md bg-surface border border-border text-sm text-text hover:bg-surface-2 transition-colors"
            >
              {ws.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WorkspaceView — shown at "/w/:workspaceId"
// ---------------------------------------------------------------------------

/**
 * Workspace overview: syncs :workspaceId param → store, lists projects with
 * links, and provides a "Workspace settings" sheet (TagManager + MemberManager).
 */
export function WorkspaceView() {
  const { workspaceId } = useParams()
  const setCurrentWorkspace = useStore((s) => s.setCurrentWorkspace)
  const setCurrentProject = useStore((s) => s.setCurrentProject)

  // Sync URL param → store so sidebar active states match the URL
  useEffect(() => {
    setCurrentWorkspace(workspaceId)
    // Clear project selection when navigating to workspace root
    setCurrentProject(null)
  }, [workspaceId, setCurrentWorkspace, setCurrentProject])

  const { data: projects = [], isLoading } = useProjects(workspaceId)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState('tags') // 'tags' | 'members'

  return (
    <div data-testid="workspace-view" className="p-8 max-w-3xl">
      {/* Hidden display elements for tests */}
      <p data-testid="workspace-id-display" className="sr-only">
        Workspace: {workspaceId}
      </p>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text">Projects</h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSettingsOpen(true)}
          data-testid="workspace-settings-btn"
          aria-label="Workspace settings"
        >
          Settings
        </Button>
      </div>

      {/* Projects list */}
      {isLoading ? (
        <p className="text-sm text-text-muted" data-testid="workspace-view-loading">
          Loading projects…
        </p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-text-muted" data-testid="workspace-view-empty">
          No projects yet. Use the sidebar to create one.
        </p>
      ) : (
        <ul
          role="list"
          data-testid="workspace-projects"
          className="grid gap-4 sm:grid-cols-2"
        >
          {projects.map((proj) => (
            <li key={proj.id}>
              <Link
                to={`/w/${workspaceId}/p/${proj.id}`}
                data-testid={`workspace-project-link-${proj.id}`}
                className="block rounded-lg border border-border bg-surface p-4 hover:bg-surface-2 transition-colors"
              >
                <h2 className="text-base font-medium text-text truncate">
                  {proj.name}
                </h2>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Workspace settings Sheet — tabs for Tags and Members */}
      <Sheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Workspace Settings"
        variant="drawer"
      >
        <div className="flex flex-col gap-6">
          {/* Tab switcher */}
          <div className="flex gap-2 border-b border-border pb-3" role="tablist">
            <button
              role="tab"
              aria-selected={settingsTab === 'tags'}
              onClick={() => setSettingsTab('tags')}
              data-testid="settings-tab-tags"
              className={[
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                settingsTab === 'tags'
                  ? 'bg-surface-2 text-text'
                  : 'text-text-muted hover:text-text',
              ].join(' ')}
            >
              Tags
            </button>
            <button
              role="tab"
              aria-selected={settingsTab === 'members'}
              onClick={() => setSettingsTab('members')}
              data-testid="settings-tab-members"
              className={[
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                settingsTab === 'members'
                  ? 'bg-surface-2 text-text'
                  : 'text-text-muted hover:text-text',
              ].join(' ')}
            >
              Members
            </button>
          </div>

          {/* Tab panels */}
          {settingsTab === 'tags' ? (
            <TagManager workspaceId={workspaceId} />
          ) : (
            <MemberManager workspaceId={workspaceId} />
          )}
        </div>
      </Sheet>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProjectView — shown at "/w/:workspaceId/p/:projectId"
// ---------------------------------------------------------------------------

/**
 * Wraps the feature ProjectView with:
 * - Sync of URL params → store
 * - A "Project settings" button that opens ProjectSettings Sheet
 */
export function ProjectView() {
  const { workspaceId, projectId } = useParams()
  const setCurrentWorkspace = useStore((s) => s.setCurrentWorkspace)
  const setCurrentProject = useStore((s) => s.setCurrentProject)
  const { data: projects = [] } = useProjects(workspaceId)

  // Sync URL params → store
  useEffect(() => {
    setCurrentWorkspace(workspaceId)
    setCurrentProject(projectId)
  }, [workspaceId, projectId, setCurrentWorkspace, setCurrentProject])

  const currentProject = projects.find((p) => String(p.id) === String(projectId)) ?? null
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div data-testid="project-route-wrapper">
      {/* Settings button — shown in the project header area */}
      <div className="flex justify-end px-8 pt-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSettingsOpen(true)}
          data-testid="project-settings-btn"
          aria-label="Project settings"
        >
          Settings
        </Button>
      </div>

      {/* The real feature ProjectView */}
      <ProjectViewFeature />

      {/* Project settings sheet */}
      {currentProject && (
        <ProjectSettings
          project={currentProject}
          workspaceId={workspaceId}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

// Re-export the feature ProjectView so existing imports still work
export { ProjectViewFeature as ProjectViewFeature }

// ---------------------------------------------------------------------------
// ActivityFeedRoute — reads workspaceId from URL params and passes to ActivityFeed
// ---------------------------------------------------------------------------

/**
 * Thin wrapper that reads :workspaceId from the URL and passes it to
 * ActivityFeed — mirrors the pattern used by WorkspaceView and ProjectView.
 */
export function ActivityFeedRoute() {
  const { workspaceId } = useParams()
  return <ActivityFeed workspaceId={workspaceId} />
}

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
      {/* /login — outside AppLayout (no sidebar/header on the login screen) */}
      <Route path="login" element={<LoginView />} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<MyTasksView />} />
        <Route path="my-tasks" element={<MyTasksView />} />
        <Route path="w/:workspaceId" element={<WorkspaceView />} />
        <Route path="w/:workspaceId/activity" element={<ActivityFeedRoute />} />
        <Route path="w/:workspaceId/p/:projectId" element={<ProjectView />} />
        <Route path="w/:workspaceId/p/:projectId/l/:listId" element={<ListView />} />
      </Route>
    </Routes>
  )
}

// ---------------------------------------------------------------------------
// createBrowserRouter — used in the real entry (main-v2.jsx)
// ---------------------------------------------------------------------------

/**
 * createAppRouter — returns a HashRouter for the secondary entry.
 *
 * A HASH router is used (not a browser router) because the V2 shell is served
 * as a separate file at /v2.html alongside the live app at /. With a browser
 * router the initial location (/v2.html) matches no route → 404. With a hash
 * router the path lives after the '#', so /v2.html loads "/" and refresh /
 * deep-links work without nginx changes and without colliding with the old
 * app's path space. When the parity flip happens (V2 becomes the default at
 * "/"), switch this back to createBrowserRouter.
 */
export function createAppRouter() {
  return createHashRouter([
    // /login — outside AppLayout (no sidebar/header on the login screen)
    {
      path: '/login',
      element: <LoginView />,
    },
    {
      path: '/',
      element: <RequireAuth><AppLayout /></RequireAuth>,
      children: [
        { index: true, element: <MyTasksView /> },
        { path: 'my-tasks', element: <MyTasksView /> },
        { path: 'w/:workspaceId', element: <WorkspaceView /> },
        { path: 'w/:workspaceId/activity', element: <ActivityFeedRoute /> },
        { path: 'w/:workspaceId/p/:projectId', element: <ProjectView /> },
        { path: 'w/:workspaceId/p/:projectId/l/:listId', element: <ListView /> },
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
