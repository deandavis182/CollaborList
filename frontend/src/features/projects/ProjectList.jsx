/**
 * ProjectList — renders projects for the current workspace in the sidebar.
 *
 * Each project links to /w/:workspaceId/p/:projectId and marks the active
 * currentProjectId via aria-current. Includes a "+ New project" action that
 * opens CreateProjectDialog.
 *
 * Props: none (reads currentWorkspaceId and currentProjectId from store).
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useProjects } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { Button } from '../../ui/Button.jsx'
import { CreateProjectDialog } from './CreateProjectDialog.jsx'

export function ProjectList() {
  const currentWorkspaceId = useStore((s) => s.currentWorkspaceId)
  const currentProjectId = useStore((s) => s.currentProjectId)
  const setCurrentProject = useStore((s) => s.setCurrentProject)

  const { data: projects = [], isLoading } = useProjects(currentWorkspaceId)

  const [dialogOpen, setDialogOpen] = useState(false)

  if (!currentWorkspaceId) {
    return (
      <p className="text-sm text-text-muted px-2 py-1">Select a workspace</p>
    )
  }

  return (
    <div className="flex flex-col gap-1" data-testid="project-list">
      {isLoading ? (
        <p className="text-sm text-text-muted px-2 py-1">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-text-muted px-2 py-1">No projects</p>
      ) : (
        <ul role="list" className="space-y-1">
          {projects.map((proj) => {
            const isActive = proj.id === currentProjectId
            return (
              <li key={proj.id}>
                <Link
                  to={`/w/${currentWorkspaceId}/p/${proj.id}`}
                  data-testid={`project-item-${proj.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setCurrentProject(proj.id)}
                  className={[
                    'block w-full px-3 py-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-surface-2 text-text font-medium'
                      : 'text-text-muted hover:bg-surface-2 hover:text-text',
                  ].join(' ')}
                >
                  {proj.name}
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDialogOpen(true)}
        className="mt-1 w-full justify-start gap-1 text-text-muted"
        aria-label="New project"
        data-testid="new-project-btn"
      >
        <span aria-hidden="true">+</span>
        New project
      </Button>

      <CreateProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        workspaceId={currentWorkspaceId}
      />
    </div>
  )
}
