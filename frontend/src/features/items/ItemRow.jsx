/**
 * ItemRow — a single item row in a list.
 *
 * Props:
 *   item             : object   — the item data
 *   depth            : number   — nesting depth (default 0); used for left padding
 *   members          : array    — [{ user_id, email }] for resolving assignee names
 *   onToggleComplete : function — called with item when checkbox is toggled
 *   onOpen           : function — called with item.id when row body is clicked
 */

import { Chip } from '../../ui/Chip.jsx'
import { Avatar } from '../../ui/Avatar.jsx'
import { formatDay, parseLocalDay } from '../../lib/dates.js'

/** Map a tag hex color to a Chip color token. */
const TAG_COLOR_MAP = {
  '#ef4444': 'danger',
  '#22c55e': 'success',
  '#eab308': 'warning',
  '#3b82f6': 'primary',
  '#8b5cf6': 'accent',
}

/** Map item.status to a Chip color variant. */
const STATUS_COLOR = {
  'To do': 'neutral',
  'Doing': 'primary',
  'Done': 'success',
  'Blocked': 'danger',
}

export function ItemRow({ item, depth = 0, members = [], onToggleComplete, onOpen }) {
  const paddingLeft = depth * 24

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

  function handleRowClick() {
    if (onOpen) onOpen(item.id)
  }

  function handleCheckboxClick(e) {
    e.stopPropagation()
    if (onToggleComplete) onToggleComplete(item)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleRowClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`item-row-${item.id}`}
      style={{ paddingLeft }}
      className="flex items-center gap-2 py-2 pr-2 rounded-md hover:bg-surface-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
    >
      {/* Checkbox — click must NOT bubble to the row handler */}
      <label
        className="flex items-center shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={!!item.completed}
          onChange={handleCheckboxClick}
          aria-label={`Mark "${item.text}" as ${item.completed ? 'incomplete' : 'complete'}`}
          className="w-4 h-4 accent-primary"
        />
      </label>

      {/* Text */}
      <span
        className={[
          'flex-1 text-sm',
          item.completed ? 'line-through text-text-muted' : 'text-text',
        ].join(' ')}
      >
        {item.text}
      </span>

      {/* Status chip */}
      {item.status && (
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

      {/* Tag chips — read-only */}
      {Array.isArray(item.tags) && item.tags.length > 0 && (
        item.tags.map((tag) => (
          <Chip
            key={String(tag.id)}
            data-testid={`item-tag-${tag.id}`}
            color={TAG_COLOR_MAP[tag.color?.toLowerCase?.()] ?? 'neutral'}
          >
            {tag.name}
          </Chip>
        ))
      )}

      {/* Assignee avatar */}
      {assigneeName !== null && (
        <Avatar name={assigneeName} size="xs" />
      )}
    </div>
  )
}
