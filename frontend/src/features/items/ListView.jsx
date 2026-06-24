/**
 * ListView — rendered at /w/:workspaceId/p/:projectId/l/:listId.
 *
 * Mounts:
 *   - <ViewContainer>    : all 4 view lenses (list / board / calendar / timeline)
 *   - <ItemDetailDrawer> : the single detail surface (always mounted)
 *
 * On mobile (≤767px), renders MobileListDetail instead of the desktop layout.
 */

import { useParams } from 'react-router-dom'
import { useWorkspaceMembers, useListItems } from '../../lib/api.js'
import { ViewContainer } from '../views/ViewContainer.jsx'
import { ItemDetailDrawer } from './ItemDetailDrawer.jsx'
import { useIsMobile } from '../../lib/useMediaQuery.js'
import { MobileListDetail } from '../mobile/MobileListDetail.jsx'

function ListViewDesktop() {
  const { workspaceId, projectId, listId } = useParams()

  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const { data: items = [] } = useListItems(listId)

  return (
    <div data-testid="list-view" className="p-8 max-w-3xl">
      {/* Heading — could be enriched with list name once a useList hook is available */}
      <h1 className="text-2xl font-semibold text-text mb-6">List</h1>

      {/* All 4 view lenses via ViewContainer */}
      <ViewContainer
        items={items}
        listId={String(listId)}
        workspaceId={String(workspaceId)}
        projectId={String(projectId)}
        scopeKey={`list:${listId}`}
        members={members}
        showAddItem
      />

      {/* Detail drawer — the single detail surface for this route */}
      <ItemDetailDrawer listId={String(listId)} workspaceId={String(workspaceId)} />
    </div>
  )
}

export function ListView() {
  return useIsMobile() ? <MobileListDetail /> : <ListViewDesktop />
}
