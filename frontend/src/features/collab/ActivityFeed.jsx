/**
 * ActivityFeed — workspace-level activity stream.
 *
 * Props:
 *   workspaceId : string | number — workspace whose activity to show
 *
 * On mount (and whenever workspaceId changes) marks all activity as read.
 * The markRead effect fires exactly once per workspaceId (guarded by a ref
 * that stores the last workspace for which it ran).
 */

import { useEffect, useRef } from 'react'
import { useWorkspaceActivity, useMarkActivityRead } from '../../lib/api.js'
import { Avatar } from '../../ui/Avatar.jsx'
import { relativeTime } from '../../lib/relativeTime.js'

// ---------------------------------------------------------------------------
// verbPhrase — maps raw verb strings to readable sentence fragments
// ---------------------------------------------------------------------------

function verbPhrase(verb) {
  switch (verb) {
    case 'assigned':   return 'assigned an item'
    case 'completed':  return 'completed an item'
    case 'commented':  return 'commented on an item'
    case 'mentioned':  return 'mentioned someone'
    default:           return verb
  }
}

// ---------------------------------------------------------------------------
// ActivityFeed component
// ---------------------------------------------------------------------------

export function ActivityFeed({ workspaceId }) {
  const { data, isLoading } = useWorkspaceActivity(workspaceId)
  const items = data?.items ?? []

  const markRead = useMarkActivityRead(workspaceId)

  // Guard: track which workspaceId we last marked read to avoid duplicate calls
  const markedForRef = useRef(null)

  useEffect(() => {
    if (!workspaceId) return
    if (markedForRef.current === workspaceId) return
    markedForRef.current = workspaceId
    markRead.mutate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  return (
    <div data-testid="activity-feed" className="p-8 max-w-2xl flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text">Activity</h1>

      {/* Loading state */}
      {isLoading && (
        <p data-testid="activity-loading" className="text-sm text-text-muted">
          Loading…
        </p>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <p data-testid="activity-empty" className="text-sm text-text-muted">
          No activity yet
        </p>
      )}

      {/* Activity list (newest-first, as returned by the API) */}
      {!isLoading && items.length > 0 && (
        <ul className="flex flex-col gap-3" role="list">
          {items.map((item) => (
            <li
              key={item.id}
              data-testid={`activity-${item.id}`}
              className="flex gap-3 items-start"
            >
              <Avatar size="xs" name={item.actor_email} />

              <div className="flex-1 min-w-0">
                <p className="text-sm text-text">
                  <span className="font-medium">{item.actor_email}</span>
                  {' '}
                  {verbPhrase(item.verb)}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {relativeTime(item.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
