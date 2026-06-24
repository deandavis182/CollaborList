/**
 * WorkspaceSwitcher — shows all workspaces, marks the active one, and
 * provides a "+ New workspace" action that opens CreateWorkspaceDialog.
 *
 * Reads from useWorkspaces() and the store's currentWorkspaceId.
 * On selection it both updates the store AND navigates to the workspace
 * overview (/w/:id) — that page hosts Workspace Settings (Tags + Members),
 * so without the navigation the members UI was unreachable by clicking.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspaces } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { Avatar } from '../../ui/Avatar.jsx'
import { Button } from '../../ui/Button.jsx'
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog.jsx'

export function WorkspaceSwitcher() {
  const { data: workspaces = [], isLoading } = useWorkspaces()
  const currentWorkspaceId = useStore((s) => s.currentWorkspaceId)
  const setCurrentWorkspace = useStore((s) => s.setCurrentWorkspace)
  const navigate = useNavigate()

  const [dialogOpen, setDialogOpen] = useState(false)

  function selectWorkspace(id) {
    setCurrentWorkspace(id)
    navigate(`/w/${id}`)
  }

  return (
    <div className="flex flex-col gap-1" data-testid="workspace-switcher">
      {isLoading ? (
        <p className="text-sm text-text-muted px-2 py-1">Loading…</p>
      ) : workspaces.length === 0 ? (
        <p className="text-sm text-text-muted px-2 py-1">No workspaces</p>
      ) : (
        <ul role="list" className="space-y-1">
          {workspaces.map((ws) => {
            const isActive = String(ws.id) === String(currentWorkspaceId)
            return (
              <li key={ws.id}>
                <button
                  type="button"
                  data-testid={`workspace-item-${ws.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => selectWorkspace(ws.id)}
                  className={[
                    'w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm font-medium transition-colors text-left',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-text hover:bg-surface-2',
                  ].join(' ')}
                >
                  <Avatar name={ws.name} size="xs" />
                  <span className="truncate">{ws.name}</span>
                </button>
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
        aria-label="New workspace"
      >
        <span aria-hidden="true">+</span>
        New workspace
      </Button>

      <CreateWorkspaceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  )
}
