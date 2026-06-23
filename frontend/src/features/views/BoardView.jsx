/**
 * BoardView — Kanban lens with @dnd-kit drag-and-drop.
 *
 * PURE lens — no data fetching. Handlers via props only.
 *
 * Props:
 *   items            : array    — item objects to display
 *   members          : array    — [{ user_id, email }] workspace members
 *   groupMode        : 'status' | 'assignee'  (default: 'status')
 *   onGroupModeChange: function — called with new mode string
 *   onMove           : function — called with (item, changes) when a card is dropped
 *   onOpen           : function — called with item.id when a card is clicked
 */

import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { Card } from '../../ui/Card.jsx'
import { Chip } from '../../ui/Chip.jsx'
import { Avatar } from '../../ui/Avatar.jsx'
import { SegmentedControl } from '../../ui/SegmentedControl.jsx'
import { resolveBoardMove } from './resolveBoardMove.js'
import { formatDay, parseLocalDay } from '../../lib/dates.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLUMNS = [
  { key: 'To do',   label: 'To do' },
  { key: 'Doing',   label: 'Doing' },
  { key: 'Done',    label: 'Done' },
  { key: 'Blocked', label: 'Blocked' },
]

/** Map item.status to a Chip color variant. */
const STATUS_COLOR = {
  'To do':   'neutral',
  'Doing':   'primary',
  'Done':    'success',
  'Blocked': 'danger',
}

/** Map tag hex color to a Chip color token. */
const TAG_COLOR_MAP = {
  '#ef4444': 'danger',
  '#22c55e': 'success',
  '#eab308': 'warning',
  '#3b82f6': 'primary',
  '#8b5cf6': 'accent',
}

const GROUP_MODE_OPTIONS = [
  { value: 'status',   label: 'Status' },
  { value: 'assignee', label: 'Assignee' },
]

// ─── Bucketing helpers ────────────────────────────────────────────────────────

/**
 * Returns [{key, label, items}] for status groupMode.
 * Fixed order: To do, Doing, Done, Blocked, then "No status" only if non-empty.
 */
function bucketByStatus(items) {
  const noStatus = []
  const byStatus = {}

  for (const col of STATUS_COLUMNS) {
    byStatus[col.key] = []
  }

  for (const item of items) {
    if (item.status && byStatus[item.status] !== undefined) {
      byStatus[item.status].push(item)
    } else {
      noStatus.push(item)
    }
  }

  const columns = STATUS_COLUMNS.map((col) => ({
    key: col.key,
    label: col.label,
    items: byStatus[col.key],
  }))

  // Add "No status" column only when non-empty
  if (noStatus.length > 0) {
    columns.unshift({ key: 'No status', label: 'No status', items: noStatus })
  }

  return columns
}

/**
 * Returns [{key, label, items}] for assignee groupMode.
 * One column per member (header = email), plus "Unassigned".
 */
function bucketByAssignee(items, members) {
  const unassigned = []
  const byMember = {}

  for (const member of members) {
    byMember[String(member.user_id)] = { member, items: [] }
  }

  for (const item of items) {
    if (item.assignee_id == null) {
      unassigned.push(item)
    } else {
      const key = String(item.assignee_id)
      if (byMember[key]) {
        byMember[key].items.push(item)
      } else {
        // Unknown member — put in unassigned
        unassigned.push(item)
      }
    }
  }

  const columns = members.map((member) => ({
    key: String(member.user_id),
    label: member.email,
    items: byMember[String(member.user_id)].items,
  }))

  // Unassigned column always present
  columns.push({ key: 'unassigned', label: 'Unassigned', items: unassigned })

  return columns
}

// ─── DraggableCard ────────────────────────────────────────────────────────────

function DraggableCard({ item, members, onOpen, groupMode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: String(item.id),
  })

  // Resolve due-date overdue state
  const isOverdue =
    item.due_date &&
    !item.completed &&
    parseLocalDay(item.due_date) < new Date()

  // Resolve assignee display name
  const assigneeName = (() => {
    if (item.assignee_id == null) return null
    const member = members.find((m) => String(m.user_id) === String(item.assignee_id))
    return member ? member.email : String(item.assignee_id)
  })()

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-testid={`board-card-${item.id}`}
      style={{
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onClick={() => { if (onOpen) onOpen(item.id) }}
    >
      <Card
        className="p-3 mb-2 select-none"
        style={{ cursor: 'pointer' }}
      >
        {/* Item text */}
        <p
          className={[
            'text-sm mb-2 leading-snug',
            item.completed ? 'line-through text-text-muted' : 'text-text',
          ].join(' ')}
        >
          {item.text}
        </p>

        {/* Chips row */}
        <div className="flex flex-wrap items-center gap-1">
          {/* Status chip — always shown in assignee mode, optional in status mode */}
          {item.status && groupMode === 'assignee' && (
            <Chip color={STATUS_COLOR[item.status] ?? 'neutral'}>
              {item.status}
            </Chip>
          )}

          {/* Due date chip */}
          {item.due_date && (
            <Chip color={isOverdue ? 'danger' : 'neutral'}>
              {formatDay(item.due_date)}
            </Chip>
          )}

          {/* Tag chips */}
          {Array.isArray(item.tags) &&
            item.tags.map((tag) => (
              <Chip
                key={String(tag.id)}
                data-testid={`board-tag-${item.id}-${tag.id}`}
                color={TAG_COLOR_MAP[tag.color?.toLowerCase?.()] ?? 'neutral'}
              >
                {tag.name}
              </Chip>
            ))}
        </div>

        {/* Assignee avatar */}
        {assigneeName !== null && (
          <div className="mt-2 flex justify-end">
            <Avatar name={assigneeName} size="xs" />
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── DroppableColumn ──────────────────────────────────────────────────────────

function DroppableColumn({ col, members, onOpen, groupMode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })

  return (
    <div
      data-testid={`board-col-${col.key}`}
      className="flex flex-col min-w-[220px] w-60 shrink-0"
    >
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-sm font-semibold text-text">{col.label}</span>
        <span
          className="text-xs px-1.5 py-0.5 rounded-sm"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
        >
          {col.items.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex-1 min-h-[120px] rounded-lg p-2 transition-colors duration-[150ms]"
        style={{
          background: isOver ? 'var(--color-primary-40)' : 'var(--color-surface-2)',
        }}
      >
        {col.items.map((item) => (
          <DraggableCard
            key={item.id}
            item={item}
            members={members}
            onOpen={onOpen}
            groupMode={groupMode}
          />
        ))}
      </div>
    </div>
  )
}

// ─── BoardView ────────────────────────────────────────────────────────────────

export function BoardView({
  items = [],
  members = [],
  groupMode = 'status',
  onGroupModeChange,
  onMove,
  onOpen,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  // Build columns based on groupMode
  const columns =
    groupMode === 'assignee'
      ? bucketByAssignee(items, members)
      : bucketByStatus(items)

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over) return

    const result = resolveBoardMove({
      activeId: active.id,
      overId: over.id,
      items,
      groupMode,
    })

    if (result && onMove) {
      onMove(result.item, result.changes)
    }
  }

  return (
    <div data-testid="board-view" className="flex flex-col gap-4 h-full">
      {/* Group mode toggle */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-muted font-medium">Group by</span>
        <SegmentedControl
          data-testid="board-groupmode"
          options={GROUP_MODE_OPTIONS}
          value={groupMode}
          onChange={onGroupModeChange}
        />
      </div>

      {/* Kanban columns */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <DroppableColumn
              key={col.key}
              col={col}
              members={members}
              onOpen={onOpen}
              groupMode={groupMode}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
