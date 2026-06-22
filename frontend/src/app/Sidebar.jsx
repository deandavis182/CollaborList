/**
 * Sidebar — desktop left navigation.
 *
 * Shows a workspace switcher at top (from useWorkspaces), highlights the
 * current workspace, and clicking a workspace sets it via the store.
 * Below shows the projects for the current workspace (from useProjects).
 */

import { useWorkspaces, useProjects } from '../lib/api.js'
import { useStore } from '../lib/store.js'

export function Sidebar() {
  const { data: workspaces = [], isLoading: wsLoading } = useWorkspaces()

  const currentWorkspaceId = useStore((s) => s.currentWorkspaceId)
  const setCurrentWorkspace = useStore((s) => s.setCurrentWorkspace)
  const currentProjectId = useStore((s) => s.currentProjectId)
  const setCurrentProject = useStore((s) => s.setCurrentProject)

  const { data: projects = [], isLoading: projLoading } = useProjects(currentWorkspaceId)

  return (
    <nav
      data-testid="sidebar"
      className="flex flex-col h-full w-64 bg-surface border-r border-border overflow-y-auto shrink-0"
    >
      {/* Workspace Switcher */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Workspaces
        </p>

        {wsLoading ? (
          <p className="text-sm text-text-muted px-2 py-1">Loading…</p>
        ) : workspaces.length === 0 ? (
          <p className="text-sm text-text-muted px-2 py-1">No workspaces</p>
        ) : (
          <ul role="list" className="space-y-1">
            {workspaces.map((ws) => {
              const isActive = ws.id === currentWorkspaceId
              return (
                <li key={ws.id}>
                  <button
                    type="button"
                    data-testid={`workspace-${ws.id}`}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => setCurrentWorkspace(ws.id)}
                    className={[
                      'w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-text hover:bg-surface-2',
                    ].join(' ')}
                  >
                    {ws.name}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Projects for Current Workspace */}
      <div className="flex-1 px-4 py-3">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Projects
        </p>

        {!currentWorkspaceId ? (
          <p className="text-sm text-text-muted px-2 py-1">Select a workspace</p>
        ) : projLoading ? (
          <p className="text-sm text-text-muted px-2 py-1">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-text-muted px-2 py-1">No projects</p>
        ) : (
          <ul role="list" className="space-y-1">
            {projects.map((proj) => {
              const isActive = proj.id === currentProjectId
              return (
                <li key={proj.id}>
                  <button
                    type="button"
                    data-testid={`project-${proj.id}`}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => setCurrentProject(proj.id)}
                    className={[
                      'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-surface-2 text-text font-medium'
                        : 'text-text-muted hover:bg-surface-2 hover:text-text',
                    ].join(' ')}
                  >
                    {proj.name}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </nav>
  )
}
