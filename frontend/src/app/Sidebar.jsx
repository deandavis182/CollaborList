/**
 * Sidebar — desktop left navigation.
 *
 * Renders WorkspaceSwitcher at the top, then the projects for the
 * current workspace below (via ProjectList).
 */

import { WorkspaceSwitcher } from '../features/workspaces/WorkspaceSwitcher.jsx'
import { ProjectList } from '../features/projects/ProjectList.jsx'

export function Sidebar() {
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
        <WorkspaceSwitcher />
      </div>

      {/* Projects for Current Workspace */}
      <div className="flex-1 px-4 py-3">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Projects
        </p>
        <ProjectList />
      </div>
    </nav>
  )
}
