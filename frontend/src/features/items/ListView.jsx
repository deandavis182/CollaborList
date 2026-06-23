/**
 * ListView — rendered at /w/:workspaceId/p/:projectId/l/:listId.
 *
 * Mounts:
 *   - <ListItems>      : the item list for this list
 *   - <ItemDetailDrawer> : the single detail surface (was a placeholder in AppLayout)
 */

import { useParams } from 'react-router-dom'
import { useWorkspaceMembers } from '../../lib/api.js'
import { ListItems } from './ListItems.jsx'
import { ItemDetailDrawer } from './ItemDetailDrawer.jsx'

export function ListView() {
  const { workspaceId, projectId, listId } = useParams()

  const { data: members = [] } = useWorkspaceMembers(workspaceId)

  return (
    <div data-testid="list-view" className="p-8 max-w-3xl">
      {/* Heading — could be enriched with list name once a useList hook is available */}
      <h1 className="text-2xl font-semibold text-text mb-6">List</h1>

      {/* Items */}
      <ListItems listId={String(listId)} members={members} />

      {/* Detail drawer — the single detail surface for this route */}
      <ItemDetailDrawer listId={String(listId)} workspaceId={String(workspaceId)} />
    </div>
  )
}
