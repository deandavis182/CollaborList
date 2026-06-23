/**
 * Sidebar — desktop left navigation.
 *
 * Renders WorkspaceSwitcher at the top, then the projects for the
 * current workspace below (via ProjectList).
 *
 * Also shows an Activity nav link with an unread dot when there are
 * unread activity items in the current workspace.
 *
 * NOTE: The mobile BottomTabBar Activity tab + its dot are wired in Task 3B.10.
 */

import { Link } from 'react-router-dom'
import { WorkspaceSwitcher } from '../features/workspaces/WorkspaceSwitcher.jsx'
import { ProjectList } from '../features/projects/ProjectList.jsx'
import { useStore } from '../lib/store.js'
import { useWorkspaceActivity } from '../lib/api.js'

export function Sidebar() {
  const currentWorkspaceId = useStore((s) => s.currentWorkspaceId)

  // Only query when a workspace is selected
  const { data: activityData } = useWorkspaceActivity(currentWorkspaceId)
  const hasUnread = (activityData?.unread ?? 0) > 0

  return (
    <nav
      data-testid="sidebar"
      className="flex flex-col h-full w-64 bg-surface border-r border-border overflow-y-auto shrink-0"
    >
      {/* Quick nav — My Tasks + Activity */}
      <div className="px-4 py-3 border-b border-border flex flex-col gap-1">
        <Link
          to="/my-tasks"
          data-testid="nav-my-tasks"
          className="block w-full px-3 py-2 text-sm text-text rounded-md hover:bg-surface-2 transition-colors"
        >
          My Tasks
        </Link>

        {/* Activity link with optional unread dot */}
        <Link
          to={currentWorkspaceId ? `/w/${currentWorkspaceId}/activity` : '#'}
          data-testid="nav-activity"
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text rounded-md hover:bg-surface-2 transition-colors"
        >
          Activity
          {hasUnread && (
            <span
              data-testid="activity-unread-dot"
              className="w-2 h-2 rounded-full bg-accent shrink-0"
              aria-label="Unread activity"
            />
          )}
        </Link>
      </div>

      {/* Workspace + Projects — rendered as a single nested tree so the
          hierarchy is legible: Workspace (root) ▸ Projects ▸ Lists */}
      <div className="flex-1 overflow-y-auto">
        {/* Level 1 — Workspace (root label + switcher) */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Workspace
          </p>
          {/* WorkspaceSwitcher items are visually at level 1 (no extra indent) */}
          <WorkspaceSwitcher />
        </div>

        {/* Level 2 + 3 — Projects (and their nested Lists) indented under the
            active workspace.  ProjectList renders level-2 items; each active
            project expands to show level-3 list items via ProjectListTree. */}
        <div className="pb-3">
          <p className="pl-6 pr-4 pt-2 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
            Projects
          </p>
          <div className="px-4">
            <ProjectList />
          </div>
        </div>
      </div>
    </nav>
  )
}
