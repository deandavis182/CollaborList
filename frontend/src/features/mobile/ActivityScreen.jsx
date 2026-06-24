/**
 * ActivityScreen — mobile activity feed.
 *
 * Shows a presence stack (overlapping avatars of online teammates) followed by
 * a timeline list of workspace activity events. Marks all activity as read on
 * mount (ref-guarded to fire exactly once per mount, mirroring ActivityFeed).
 */

import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useWorkspaceActivity, useMarkActivityRead } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { Avatar } from '../../ui/Avatar.jsx'

// ---------------------------------------------------------------------------
// Verb → readable phrase map (copy from ActivityFeed — presentational copy)
// ---------------------------------------------------------------------------

const VERB = {
  assigned:  'assigned an item',
  completed: 'completed an item',
  commented: 'commented on an item',
  mentioned: 'mentioned someone',
}

// ---------------------------------------------------------------------------
// Inline relative-time helper
// ---------------------------------------------------------------------------

function ago(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ---------------------------------------------------------------------------
// ActivityScreen component
// ---------------------------------------------------------------------------

export function ActivityScreen() {
  const { workspaceId } = useParams()
  const { data } = useWorkspaceActivity(workspaceId)
  const { mutate: markRead } = useMarkActivityRead(workspaceId)
  const presence = useStore((s) => s.presence)

  // Guard: track which workspaceId we last marked read so the effect fires once
  // per workspace (mirrors ActivityFeed — re-marks when workspaceId changes
  // without a remount).
  const markedFor = useRef(null)
  useEffect(() => {
    if (markedFor.current === workspaceId) return
    markedFor.current = workspaceId
    markRead()
  }, [workspaceId, markRead])

  const items = data?.items ?? []
  const online = Object.values(presence)

  return (
    <div
      data-testid="activity-screen"
      className="px-[18px] pt-[62px] pb-[116px] space-y-5 min-h-full bg-bg"
    >
      {/* Title */}
      <h1 className="text-[30px] font-bold font-display tracking-[-0.8px] text-text">
        Activity
      </h1>

      {/* Presence stack */}
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {online.slice(0, 6).map((p) => (
            <span key={p.userId} className="ring-2 ring-bg rounded-full">
              <Avatar name={p.email} size="sm" />
            </span>
          ))}
        </div>
        <span className="text-[13px] text-text-muted">
          {online.length} teammate{online.length === 1 ? '' : 's'} online now
        </span>
      </div>

      {/* Timeline */}
      <ul className="space-y-4">
        {items.map((a) => (
          <li key={a.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Avatar name={a.actor_email} size="md" />
              <span className="flex-1 w-px bg-border mt-1" aria-hidden="true" />
            </div>
            <div className="pb-2">
              <p className="text-[14px] text-text">
                <b>{a.actor_email}</b> {VERB[a.verb] ?? a.verb}
              </p>
              <p className="text-[12px] text-text-muted mt-0.5">{ago(a.created_at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
