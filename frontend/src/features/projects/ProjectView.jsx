/**
 * ProjectView — the main-area view rendered at /w/:workspaceId/p/:projectId.
 *
 * Reads :projectId from URL params, fetches lists via useProjectLists, and
 * renders them as read-only Cards. Item editing remains in the current app
 * (collaborlist.com) until Phase 3/4 ports list management to this shell.
 */

import { useParams } from 'react-router-dom'
import { useProjectLists } from '../../lib/api.js'
import { Card } from '../../ui/Card.jsx'

export function ProjectView() {
  const { workspaceId, projectId } = useParams()

  const { data: lists = [], isLoading } = useProjectLists(projectId)

  return (
    <div data-testid="project-view" className="p-8 max-w-3xl">
      <p data-testid="workspace-id-display" className="sr-only">Workspace: {workspaceId}</p>
      <p data-testid="project-id-display" className="sr-only">Project: {projectId}</p>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Project Lists</h1>
        <p className="mt-1 text-sm text-text-muted">
          Viewing lists is available here. To add or edit items, use{' '}
          <a
            href="/"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            the current app
          </a>
          {' '}— full item management is coming in Phase 3.
        </p>
      </div>

      {isLoading ? (
        <p data-testid="project-view-loading" className="text-sm text-text-muted">
          Loading lists…
        </p>
      ) : lists.length === 0 ? (
        <p data-testid="project-view-empty" className="text-sm text-text-muted">
          No lists in this project yet.
        </p>
      ) : (
        <ul
          role="list"
          data-testid="project-lists"
          className="grid gap-4 sm:grid-cols-2"
        >
          {lists.map((list) => (
            <li key={list.id}>
              <Card className="p-4" data-testid={`list-card-${list.id}`}>
                <h2 className="text-base font-medium text-text truncate">{list.name}</h2>
                {list.item_count !== undefined && (
                  <p className="mt-1 text-sm text-text-muted">
                    {list.item_count} {list.item_count === 1 ? 'item' : 'items'}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
