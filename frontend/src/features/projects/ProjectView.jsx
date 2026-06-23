/**
 * ProjectView — the main-area view rendered at /w/:workspaceId/p/:projectId.
 *
 * Reads :projectId from URL params, fetches lists via useProjectLists, and
 * renders them as clickable Cards that navigate to the list route.
 */

import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
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
              <Link to={`/w/${workspaceId}/p/${projectId}/l/${list.id}`}>
                <Card className="p-4" data-testid={`list-card-${list.id}`}>
                  <h2 className="text-base font-medium text-text truncate">{list.name}</h2>
                  {list.item_count !== undefined && (
                    <p className="mt-1 text-sm text-text-muted">
                      {list.item_count} {list.item_count === 1 ? 'item' : 'items'}
                    </p>
                  )}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
