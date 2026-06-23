import { describe, it, expect } from 'vitest'
import { resolveBoardMove } from '../resolveBoardMove.js'

const ITEMS = [
  { id: 1,  text: 'Alpha', status: 'To do',   assignee_id: 10  },
  { id: 2,  text: 'Beta',  status: 'Doing',   assignee_id: null },
  { id: '3', text: 'Gamma', status: 'Done',   assignee_id: 20  },
  { id: 4,  text: 'Delta', status: null,       assignee_id: null },
]

describe('resolveBoardMove — status mode', () => {
  it('returns { item, changes: { status } } when moving to a different status column', () => {
    const result = resolveBoardMove({
      activeId: 1,
      overId: 'Doing',
      items: ITEMS,
      groupMode: 'status',
    })
    expect(result).not.toBeNull()
    expect(result.item.id).toBe(1)
    expect(result.changes).toEqual({ status: 'Doing' })
  })

  it('returns null when item is already in the target status column', () => {
    const result = resolveBoardMove({
      activeId: 1,
      overId: 'To do',
      items: ITEMS,
      groupMode: 'status',
    })
    expect(result).toBeNull()
  })

  it('returns null when overId is "No status" (cannot unset via drag)', () => {
    const result = resolveBoardMove({
      activeId: 1,
      overId: 'No status',
      items: ITEMS,
      groupMode: 'status',
    })
    expect(result).toBeNull()
  })

  it('returns null for unknown overId in status mode', () => {
    const result = resolveBoardMove({
      activeId: 1,
      overId: 'unknown-col',
      items: ITEMS,
      groupMode: 'status',
    })
    expect(result).toBeNull()
  })

  it('handles String() id coercion — string activeId matching numeric item.id', () => {
    const result = resolveBoardMove({
      activeId: '1',
      overId: 'Done',
      items: ITEMS,
      groupMode: 'status',
    })
    expect(result).not.toBeNull()
    expect(result.changes).toEqual({ status: 'Done' })
  })

  it('handles String() id coercion — numeric activeId matching string item.id', () => {
    const result = resolveBoardMove({
      activeId: 3,
      overId: 'Blocked',
      items: ITEMS,
      groupMode: 'status',
    })
    expect(result).not.toBeNull()
    expect(result.changes).toEqual({ status: 'Blocked' })
  })

  it('can move all 4 valid status targets', () => {
    const statuses = ['To do', 'Doing', 'Done', 'Blocked']
    for (const status of statuses) {
      const result = resolveBoardMove({
        activeId: 2,
        overId: status,
        items: ITEMS,
        groupMode: 'status',
      })
      if (status === 'Doing') {
        // Same status as item 2
        expect(result).toBeNull()
      } else {
        expect(result).not.toBeNull()
        expect(result.changes).toEqual({ status })
      }
    }
  })
})

describe('resolveBoardMove — assignee mode', () => {
  it('returns { assignee_id: Number(overId) } when moving to a member column', () => {
    const result = resolveBoardMove({
      activeId: 1,
      overId: '20',
      items: ITEMS,
      groupMode: 'assignee',
    })
    expect(result).not.toBeNull()
    expect(result.item.id).toBe(1)
    expect(result.changes).toEqual({ assignee_id: 20 })
  })

  it('returns { assignee_id: null } when moving to the unassigned column', () => {
    const result = resolveBoardMove({
      activeId: 1,
      overId: 'unassigned',
      items: ITEMS,
      groupMode: 'assignee',
    })
    expect(result).not.toBeNull()
    expect(result.changes).toEqual({ assignee_id: null })
  })

  it('returns null when item is already unassigned and target is unassigned', () => {
    const result = resolveBoardMove({
      activeId: 2,
      overId: 'unassigned',
      items: ITEMS,
      groupMode: 'assignee',
    })
    expect(result).toBeNull()
  })

  it('returns null when item is already assigned to the target member', () => {
    const result = resolveBoardMove({
      activeId: 1,
      overId: '10',
      items: ITEMS,
      groupMode: 'assignee',
    })
    expect(result).toBeNull()
  })

  it('String() coercion — numeric overId matches assignee_id', () => {
    const result = resolveBoardMove({
      activeId: 2,
      overId: '10',
      items: ITEMS,
      groupMode: 'assignee',
    })
    expect(result).not.toBeNull()
    expect(result.changes).toEqual({ assignee_id: 10 })
  })
})

describe('resolveBoardMove — unknown activeId', () => {
  it('returns null when activeId does not match any item', () => {
    const result = resolveBoardMove({
      activeId: 9999,
      overId: 'Doing',
      items: ITEMS,
      groupMode: 'status',
    })
    expect(result).toBeNull()
  })

  it('returns null when items array is empty', () => {
    const result = resolveBoardMove({
      activeId: 1,
      overId: 'Done',
      items: [],
      groupMode: 'status',
    })
    expect(result).toBeNull()
  })
})
