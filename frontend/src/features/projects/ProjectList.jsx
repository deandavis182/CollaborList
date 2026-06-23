/**
 * ProjectList — renders projects for the current workspace in the sidebar.
 *
 * Each project links to /w/:workspaceId/p/:projectId and marks the active
 * currentProjectId via aria-current. Includes a "+ New project" action that
 * opens CreateProjectDialog.
 *
 * When a project is active its lists are rendered nested beneath it via
 * ProjectListTree, forming the third level of the Workspace ▸ Project ▸ List
 * hierarchy.
 *
 * Props: none (reads currentWorkspaceId and currentProjectId from store).
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useProjects } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { Button } from '../../ui/Button.jsx'
import { CreateProjectDialog } from './CreateProjectDialog.jsx'
import { ProjectListTree } from './ProjectListTree.jsx'

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
            const isActive = String(proj.id) === String(currentProjectId)
            return (
              <li key={proj.id}>
                <Link
                  to={`/w/${currentWorkspaceId}/p/${proj.id}`}
                  data-testid={`project-item-${proj.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setCurrentProject(proj.id)}
                  className={[
                    // Level-2 indent: pl-6 (workspace=0, project=pl-6, list=pl-10)
                    'flex items-center gap-1.5 w-full pl-6 pr-3 py-1.5 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-surface-2 text-text font-medium'
                      : 'text-text-muted hover:bg-surface-2 hover:text-text',
                  ].join(' ')}
                >
                  {/* Project-level glyph — right-pointing triangle */}
                  <span aria-hidden="true" className="shrink-0 text-xs opacity-60">▸</span>
                  <span className="truncate">{proj.name}</span>
                </Link>
                {/* Nested list tree — only shown for the active project */}
                {isActive && <ProjectListTree />}
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
