/**
 * resolveBoardMove — pure helper for BoardView drag-and-drop.
 *
 * Given the drag-end context, returns the change set that should be applied
 * to the dragged item, or null if the drag is a no-op.
 *
 * @param {object} opts
 * @param {string|number} opts.activeId   — id of the dragged item
 * @param {string}        opts.overId     — id of the target column (column key)
 * @param {Array}         opts.items      — full item list
 * @param {string}        opts.groupMode  — 'status' | 'assignee'
 * @returns {{ item: object, changes: object } | null}
 */

const STATUS_COLUMNS = ['To do', 'Doing', 'Done', 'Blocked']

export function resolveBoardMove({ activeId, overId, items, groupMode }) {
  // Find the dragged item (String coercion for id comparison)
  const item = items.find((i) => String(i.id) === String(activeId))
  if (!item) return null

  if (groupMode === 'status') {
    // overId is one of the 4 status labels or 'No status'
    if (!STATUS_COLUMNS.includes(overId)) {
      // 'No status' column or unknown target — cannot unset status via drag
      return null
    }

    // Same status → no-op
    if (String(item.status) === String(overId)) return null

    return { item, changes: { status: overId } }
  }

  if (groupMode === 'assignee') {
    if (overId === 'unassigned') {
      // Same assignee (already unassigned) → no-op
      if (item.assignee_id == null) return null
      return { item, changes: { assignee_id: null } }
    }

    // overId is a member user_id (string); coerce item.assignee_id to string for comparison
    if (String(item.assignee_id) === String(overId)) return null

    return { item, changes: { assignee_id: Number(overId) } }
  }

  return null
}
