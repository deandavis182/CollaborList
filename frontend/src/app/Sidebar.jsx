/**
 * Sidebar — desktop left navigation.
 *
 * Renders WorkspaceSwitcher at the top, then the projects for the
 * current workspace below (via ProjectList).
 */

import { Link } from 'react-router-dom'
import { WorkspaceSwitcher } from '../features/workspaces/WorkspaceSwitcher.jsx'
import { ProjectList } from '../features/projects/ProjectList.jsx'

export function Sidebar() {
  return (
    <nav
      data-testid="sidebar"
      className="flex flex-col h-full w-64 bg-surface border-r border-border overflow-y-auto shrink-0"
    >
      {/* Quick nav — My Tasks */}
      <div className="px-4 py-3 border-b border-border">
        <Link
          to="/my-tasks"
          data-testid="nav-my-tasks"
          className="block w-full px-3 py-2 text-sm text-text rounded-md hover:bg-surface-2 transition-colors"
        >
          My Tasks
        </Link>
      </div>

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
