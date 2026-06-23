/**
 * ListViewLens — pure presentational lens that renders a list of items
 * with optional group-by (none / completion / status / assignee / tag).
 *
 * Props:
 *   items            : array    — item objects to display
 *   members          : array    — [{ user_id, email }] for resolving assignee display names
 *   groupBy          : 'none' | 'completion' | 'status' | 'assignee' | 'tag'
 *   onToggleComplete : function — called with item when its checkbox is toggled
 *   onOpen           : function — called with item.id when a row is clicked
 *   onAddItem        : function — called with trimmed text when the add-item form submits;
 *                                 if absent the add-item bar is hidden
 *
 * PURE — no data fetching. No calls to useListItems / useUpdateItem.
 */

import { useState } from 'react'
import { ItemRow } from '../items/ItemRow.jsx'
import { Button } from '../../ui/Button.jsx'

// ─── Depth map ───────────────────────────────────────────────────────────────

/**
 * Build an id→depth map by walking parent_id chains.
 * Caps walk at 50 steps to prevent infinite cycles.
 * Used only in 'none' mode (flat, nested render).
 */
function buildDepthMap(items) {
  const idToItem = {}
  for (const item of items) {
    idToItem[String(item.id)] = item
  }

  const depthCache = {}

  function getDepth(id, visited = new Set()) {
    const key = String(id)
    if (key in depthCache) return depthCache[key]
    if (visited.has(key) || visited.size >= 50) return 0
    const item = idToItem[key]
    if (!item || item.parent_id == null) {
      depthCache[key] = 0
      return 0
    }
    visited.add(key)
    const d = 1 + getDepth(String(item.parent_id), visited)
    depthCache[key] = d
    return d
  }

  for (const item of items) {
    getDepth(String(item.id))
  }

  return depthCache
}

// ─── Group builders ──────────────────────────────────────────────────────────

/** Returns [{key, label, items}] for groupBy='completion' */
function groupByCompletion(items) {
  const active = items.filter((i) => !i.completed)
  const done   = items.filter((i) => i.completed)
  return [
    { key: 'active', label: 'Active', items: active },
    { key: 'done',   label: 'Done',   items: done   },
  ]
}

const STATUS_ORDER = ['To do', 'Doing', 'Done', 'Blocked']

/** Returns [{key, label, items}] for groupBy='status' — empty groups omitted */
function groupByStatus(items) {
  const buckets = {}

  for (const item of items) {
    const status = item.status && STATUS_ORDER.includes(item.status)
      ? item.status
      : null

    const key   = status ? status.toLowerCase().replace(/ /g, '-') : 'no-status'
    const label = status ?? 'No status'

    if (!buckets[key]) buckets[key] = { key, label, items: [] }
    buckets[key].items.push(item)
  }

  // Return in canonical order, then 'no-status' last
  const ordered = []
  for (const status of STATUS_ORDER) {
    const key = status.toLowerCase().replace(/ /g, '-')
    if (buckets[key]) ordered.push(buckets[key])
  }
  if (buckets['no-status']) ordered.push(buckets['no-status'])

  return ordered
}

/** Returns [{key, label, items}] for groupBy='assignee' */
function groupByAssignee(items, members) {
  const buckets = {}

  for (const item of items) {
    const assigneeId = item.assignee_id
    if (assigneeId == null) {
      if (!buckets['unassigned']) {
        buckets['unassigned'] = { key: 'unassigned', label: 'Unassigned', items: [] }
      }
      buckets['unassigned'].items.push(item)
    } else {
      const key = String(assigneeId)
      if (!buckets[key]) {
        const member = members.find((m) => String(m.user_id) === key)
        const label  = member ? member.email : key
        buckets[key] = { key, label, items: [] }
      }
      buckets[key].items.push(item)
    }
  }

  // Assigned groups first (sorted by key for stability), then Unassigned
  const groups = Object.values(buckets).filter((g) => g.key !== 'unassigned')
  groups.sort((a, b) => a.key.localeCompare(b.key))
  if (buckets['unassigned']) groups.push(buckets['unassigned'])

  return groups
}

/** Returns [{key, label, items}] for groupBy='tag'
 *  Multi-tag items appear under EACH of their tags.
 *  Items with no tags go under 'untagged'.
 */
function groupByTag(items) {
  const buckets = {}

  for (const item of items) {
    const tags = Array.isArray(item.tags) ? item.tags : []

    if (tags.length === 0) {
      if (!buckets['untagged']) {
        buckets['untagged'] = { key: 'untagged', label: 'Untagged', items: [] }
      }
      buckets['untagged'].items.push(item)
    } else {
      for (const tag of tags) {
        const key = String(tag.id)
        if (!buckets[key]) {
          buckets[key] = { key, label: tag.name, items: [] }
        }
        buckets[key].items.push(item)
      }
    }
  }

  // Tag groups sorted by key for stability, Untagged last
  const groups = Object.values(buckets).filter((g) => g.key !== 'untagged')
  groups.sort((a, b) => a.key.localeCompare(b.key))
  if (buckets['untagged']) groups.push(buckets['untagged'])

  return groups
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * GroupSection — renders a collapsible group header + its item rows.
 * collapsed state is lifted to the parent via the collapsedKeys Set.
 */
function GroupSection({ group, members, onToggleComplete, onOpen, isCollapsed, onToggleCollapse }) {
  return (
    <div className="mb-2">
      <button
        type="button"
        data-testid={`group-${group.key}`}
        onClick={onToggleCollapse}
        className="flex items-center gap-2 w-full text-left py-1 px-1 text-sm font-medium text-text-muted hover:text-text transition-colors duration-[150ms]"
        aria-expanded={!isCollapsed}
      >
        <span className="text-xs">{isCollapsed ? '▶' : '▼'}</span>
        <span>{group.label}</span>
        <span
          className="ml-1 text-xs px-1.5 py-0.5 rounded-sm"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
        >
          {group.items.length}
        </span>
      </button>

      {!isCollapsed && (
        <ul role="list" className="flex flex-col">
          {group.items.map((item) => (
            <li key={`${group.key}-${item.id}`}>
              <ItemRow
                item={item}
                depth={0}
                members={members}
                onToggleComplete={onToggleComplete}
                onOpen={onOpen}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── ListViewLens ─────────────────────────────────────────────────────────────

export function ListViewLens({
  items = [],
  members = [],
  groupBy = 'none',
  onToggleComplete,
  onOpen,
  onAddItem,
}) {
  // Track which group keys are collapsed
  const [collapsedKeys, setCollapsedKeys] = useState(new Set())
  const [addText, setAddText] = useState('')

  function toggleCollapse(key) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function handleAdd() {
    const text = addText.trim()
    if (!text) return
    onAddItem(text)
    setAddText('')
  }

  function handleAddKeyDown(e) {
    if (e.key === 'Enter') handleAdd()
  }

  // ── Grouped render ──────────────────────────────────────────────────────────
  if (groupBy !== 'none') {
    let groups = []
    if (groupBy === 'completion') groups = groupByCompletion(items)
    else if (groupBy === 'status')  groups = groupByStatus(items)
    else if (groupBy === 'assignee') groups = groupByAssignee(items, members)
    else if (groupBy === 'tag')     groups = groupByTag(items)

    return (
      <div data-testid="list-view-lens" className="flex flex-col gap-0">
        {items.length === 0 ? (
          <p data-testid="listlens-empty" className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
            No items
          </p>
        ) : (
          groups.map((group) => (
            <GroupSection
              key={group.key}
              group={group}
              members={members}
              onToggleComplete={onToggleComplete}
              onOpen={onOpen}
              isCollapsed={collapsedKeys.has(group.key)}
              onToggleCollapse={() => toggleCollapse(group.key)}
            />
          ))
        )}

        {onAddItem && (
          <div className="flex items-center gap-2 pt-3 mt-1" style={{ borderTop: '1px solid var(--color-border)' }}>
            <input
              type="text"
              data-testid="add-item-input"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder="New item…"
              className="flex-1 text-sm bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text)' }}
            />
            <Button
              variant="secondary"
              size="sm"
              data-testid="add-item-button"
              onClick={handleAdd}
            >
              Add
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ── Flat (none) render ──────────────────────────────────────────────────────
  const depthMap = buildDepthMap(items)

  return (
    <div data-testid="list-view-lens" className="flex flex-col gap-0">
      {items.length === 0 ? (
        <p data-testid="listlens-empty" className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
          No items
        </p>
      ) : (
        <ul role="list" className="flex flex-col">
          {items.map((item) => (
            <li key={item.id}>
              <ItemRow
                item={item}
                depth={depthMap[String(item.id)] ?? 0}
                members={members}
                onToggleComplete={onToggleComplete}
                onOpen={onOpen}
              />
            </li>
          ))}
        </ul>
      )}

      {onAddItem && (
        <div className="flex items-center gap-2 pt-3 mt-1" style={{ borderTop: '1px solid var(--color-border)' }}>
          <input
            type="text"
            data-testid="add-item-input"
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            onKeyDown={handleAddKeyDown}
            placeholder="New item…"
            className="flex-1 text-sm bg-transparent border-none outline-none"
            style={{ color: 'var(--color-text)' }}
          />
          <Button
            variant="secondary"
            size="sm"
            data-testid="add-item-button"
            onClick={handleAdd}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  )
}
