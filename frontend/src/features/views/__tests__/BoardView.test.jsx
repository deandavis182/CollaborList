import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BoardView } from '../BoardView.jsx'

// ─── Mock @dnd-kit/core ──────────────────────────────────────────────────────
// jsdom cannot simulate real pointer drag sequences. We mock dnd-kit so that:
//  - DndContext renders its children and exposes onDragEnd via data attribute
//  - useDroppable/useDraggable are no-ops that still render children
//  - The move logic is exercised by resolveBoardMove unit tests

let capturedOnDragEnd = null

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }) => {
    capturedOnDragEnd = onDragEnd
    return <div data-testid="dnd-context">{children}</div>
  },
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  useDraggable: () => ({
    setNodeRef: () => {},
    attributes: {},
    listeners: {},
    isDragging: false,
  }),
  useSensor:  (s) => s,
  useSensors: (...sensors) => sensors,
  PointerSensor: function PointerSensor() {},
  TouchSensor:   function TouchSensor() {},
}))

// ─── Test data ────────────────────────────────────────────────────────────────

const MEMBERS = [
  { user_id: 10, email: 'alice@example.com' },
  { user_id: 20, email: 'bob@example.com' },
]

const ITEMS = [
  {
    id: 1,
    text: 'Alpha',
    status: 'To do',
    assignee_id: 10,
    due_date: null,
    completed: false,
    tags: [{ id: 'ta', name: 'Frontend', color: '#3b82f6' }],
  },
  {
    id: 2,
    text: 'Beta',
    status: 'Doing',
    assignee_id: null,
    due_date: '2020-01-01', // in the past → overdue
    completed: false,
    tags: [],
  },
  {
    id: 3,
    text: 'Gamma',
    status: 'Done',
    assignee_id: 20,
    due_date: '2099-12-31',
    completed: true,
    tags: [{ id: 'tb', name: 'Backend', color: '#22c55e' }],
  },
  {
    id: 4,
    text: 'Delta',
    status: 'Blocked',
    assignee_id: 10,
    due_date: null,
    completed: false,
    tags: [],
  },
  {
    id: 5,
    text: 'Epsilon',
    status: null,  // no status → "No status" column
    assignee_id: null,
    due_date: null,
    completed: false,
    tags: [],
  },
]

beforeEach(() => {
  capturedOnDragEnd = null
})

// ─── Root element ─────────────────────────────────────────────────────────────

describe('BoardView root', () => {
  it('renders data-testid="board-view"', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    expect(screen.getByTestId('board-view')).toBeInTheDocument()
  })

  it('renders the group-mode SegmentedControl with data-testid="board-groupmode"', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    expect(screen.getByTestId('board-groupmode')).toBeInTheDocument()
  })
})

// ─── Status mode columns ──────────────────────────────────────────────────────

describe('BoardView — status mode (default)', () => {
  it('renders all 4 fixed status columns', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    expect(screen.getByTestId('board-col-To do')).toBeInTheDocument()
    expect(screen.getByTestId('board-col-Doing')).toBeInTheDocument()
    expect(screen.getByTestId('board-col-Done')).toBeInTheDocument()
    expect(screen.getByTestId('board-col-Blocked')).toBeInTheDocument()
  })

  it('renders "No status" column when items have null status', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    expect(screen.getByTestId('board-col-No status')).toBeInTheDocument()
  })

  it('does NOT render "No status" column when all items have a valid status', () => {
    const itemsWithStatus = ITEMS.filter((i) => i.status !== null)
    render(<BoardView items={itemsWithStatus} members={MEMBERS} />)
    expect(screen.queryByTestId('board-col-No status')).toBeNull()
  })

  it('buckets item 1 into "To do" column', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    const col = screen.getByTestId('board-col-To do')
    expect(within(col).getByTestId('board-card-1')).toBeInTheDocument()
  })

  it('buckets item 2 into "Doing" column', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    const col = screen.getByTestId('board-col-Doing')
    expect(within(col).getByTestId('board-card-2')).toBeInTheDocument()
  })

  it('buckets item 3 into "Done" column', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    const col = screen.getByTestId('board-col-Done')
    expect(within(col).getByTestId('board-card-3')).toBeInTheDocument()
  })

  it('buckets item 4 into "Blocked" column', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    const col = screen.getByTestId('board-col-Blocked')
    expect(within(col).getByTestId('board-card-4')).toBeInTheDocument()
  })

  it('buckets item 5 (null status) into "No status" column', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    const col = screen.getByTestId('board-col-No status')
    expect(within(col).getByTestId('board-card-5')).toBeInTheDocument()
  })

  it('item 1 does NOT appear in "Doing" column', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    const col = screen.getByTestId('board-col-Doing')
    expect(within(col).queryByTestId('board-card-1')).toBeNull()
  })

  it('empty columns still render (no items in a column)', () => {
    // Only provide items for To do; Doing/Done/Blocked should still render
    render(<BoardView items={[ITEMS[0]]} members={MEMBERS} />)
    expect(screen.getByTestId('board-col-Doing')).toBeInTheDocument()
    expect(screen.getByTestId('board-col-Done')).toBeInTheDocument()
    expect(screen.getByTestId('board-col-Blocked')).toBeInTheDocument()
  })

  it('column header shows name and count', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    const col = screen.getByTestId('board-col-To do')
    expect(within(col).getByText('To do')).toBeInTheDocument()
    // Count = 1 item in "To do"
    expect(within(col).getByText('1')).toBeInTheDocument()
  })
})

// ─── Assignee mode columns ────────────────────────────────────────────────────

describe('BoardView — assignee mode', () => {
  it('renders one column per member', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} groupMode="assignee" />)
    expect(screen.getByTestId('board-col-10')).toBeInTheDocument()
    expect(screen.getByTestId('board-col-20')).toBeInTheDocument()
  })

  it('renders an "Unassigned" column', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} groupMode="assignee" />)
    expect(screen.getByTestId('board-col-unassigned')).toBeInTheDocument()
  })

  it('buckets item 1 (assignee_id=10) into alice column', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} groupMode="assignee" />)
    const col = screen.getByTestId('board-col-10')
    expect(within(col).getByTestId('board-card-1')).toBeInTheDocument()
  })

  it('buckets item 3 (assignee_id=20) into bob column', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} groupMode="assignee" />)
    const col = screen.getByTestId('board-col-20')
    expect(within(col).getByTestId('board-card-3')).toBeInTheDocument()
  })

  it('buckets item 2 (assignee_id=null) into unassigned column', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} groupMode="assignee" />)
    const col = screen.getByTestId('board-col-unassigned')
    expect(within(col).getByTestId('board-card-2')).toBeInTheDocument()
  })

  it('renders member email as column header', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} groupMode="assignee" />)
    const col = screen.getByTestId('board-col-10')
    expect(within(col).getByText('alice@example.com')).toBeInTheDocument()
  })

  it('renders Unassigned header in unassigned column', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} groupMode="assignee" />)
    const col = screen.getByTestId('board-col-unassigned')
    expect(within(col).getByText('Unassigned')).toBeInTheDocument()
  })

  it('item 1 (assignee=10) does NOT appear in unassigned column', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} groupMode="assignee" />)
    const col = screen.getByTestId('board-col-unassigned')
    expect(within(col).queryByTestId('board-card-1')).toBeNull()
  })
})

// ─── Card click → onOpen ──────────────────────────────────────────────────────

describe('BoardView — card click', () => {
  it('clicking a card calls onOpen with item.id', () => {
    const onOpen = vi.fn()
    render(<BoardView items={ITEMS} members={MEMBERS} onOpen={onOpen} />)
    fireEvent.click(screen.getByTestId('board-card-1'))
    expect(onOpen).toHaveBeenCalledWith(1)
  })

  it('clicking card 3 calls onOpen(3)', () => {
    const onOpen = vi.fn()
    render(<BoardView items={ITEMS} members={MEMBERS} onOpen={onOpen} />)
    fireEvent.click(screen.getByTestId('board-card-3'))
    expect(onOpen).toHaveBeenCalledWith(3)
  })
})

// ─── Group-mode toggle ────────────────────────────────────────────────────────

describe('BoardView — group mode toggle', () => {
  it('calls onGroupModeChange when Status segment is clicked', () => {
    const onGroupModeChange = vi.fn()
    render(
      <BoardView
        items={ITEMS}
        members={MEMBERS}
        groupMode="assignee"
        onGroupModeChange={onGroupModeChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Status' }))
    expect(onGroupModeChange).toHaveBeenCalledWith('status')
  })

  it('calls onGroupModeChange when Assignee segment is clicked', () => {
    const onGroupModeChange = vi.fn()
    render(
      <BoardView
        items={ITEMS}
        members={MEMBERS}
        groupMode="status"
        onGroupModeChange={onGroupModeChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Assignee' }))
    expect(onGroupModeChange).toHaveBeenCalledWith('assignee')
  })
})

// ─── Card content ─────────────────────────────────────────────────────────────

describe('BoardView — card content', () => {
  it('card shows the item text', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    const card = screen.getByTestId('board-card-1')
    expect(within(card).getByText('Alpha')).toBeInTheDocument()
  })

  it('card shows due date chip when item has due_date', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    const card = screen.getByTestId('board-card-2')
    // Item 2 has due_date=2020-01-01; rendered via toLocaleDateString() which
    // may show 2019 or 2020 depending on the timezone in jsdom — match flexibly
    const dateChip = within(card).getByText(/201[0-9]|202[0-9]/)
    expect(dateChip).toBeInTheDocument()
  })

  it('card shows tag chip when item has tags', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    const card = screen.getByTestId('board-card-1')
    expect(within(card).getByText('Frontend')).toBeInTheDocument()
  })

  it('card shows assignee avatar when item has assignee_id', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} />)
    const card = screen.getByTestId('board-card-1')
    // Avatar renders initials or aria-label from the member email
    expect(within(card).getByLabelText('alice@example.com')).toBeInTheDocument()
  })

  it('card in assignee mode shows status chip', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} groupMode="assignee" />)
    const card = screen.getByTestId('board-card-1')
    expect(within(card).getByText('To do')).toBeInTheDocument()
  })

  it('card in status mode does NOT show status chip', () => {
    render(<BoardView items={ITEMS} members={MEMBERS} groupMode="status" />)
    const card = screen.getByTestId('board-card-1')
    // The "To do" label appears in the column header, NOT inside the card
    expect(within(card).queryByText('To do')).toBeNull()
  })
})

// ─── Drag-end handler → onMove ────────────────────────────────────────────────
// We test the drag-end path by invoking the captured DndContext onDragEnd
// directly (the mock captures it; no pointer drag needed in jsdom).

describe('BoardView — onDragEnd → onMove', () => {
  it('calls onMove with item and changes when drop is valid', () => {
    const onMove = vi.fn()
    render(<BoardView items={ITEMS} members={MEMBERS} onMove={onMove} groupMode="status" />)

    // Simulate drop: item 1 (status "To do") dropped onto "Done" column
    capturedOnDragEnd({ active: { id: '1' }, over: { id: 'Done' } })

    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      { status: 'Done' }
    )
  })

  it('does NOT call onMove for same-column drop (no-op)', () => {
    const onMove = vi.fn()
    render(<BoardView items={ITEMS} members={MEMBERS} onMove={onMove} groupMode="status" />)

    capturedOnDragEnd({ active: { id: '1' }, over: { id: 'To do' } })

    expect(onMove).not.toHaveBeenCalled()
  })

  it('does NOT call onMove when dropped outside any column (over=null)', () => {
    const onMove = vi.fn()
    render(<BoardView items={ITEMS} members={MEMBERS} onMove={onMove} groupMode="status" />)

    capturedOnDragEnd({ active: { id: '1' }, over: null })

    expect(onMove).not.toHaveBeenCalled()
  })

  it('calls onMove with assignee_id change in assignee mode', () => {
    const onMove = vi.fn()
    render(<BoardView items={ITEMS} members={MEMBERS} onMove={onMove} groupMode="assignee" />)

    // Item 2 is unassigned; drop onto member col '10'
    capturedOnDragEnd({ active: { id: '2' }, over: { id: '10' } })

    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
      { assignee_id: 10 }
    )
  })

  it('calls onMove with assignee_id:null when dropped on unassigned column', () => {
    const onMove = vi.fn()
    render(<BoardView items={ITEMS} members={MEMBERS} onMove={onMove} groupMode="assignee" />)

    // Item 1 has assignee_id=10; drop onto unassigned
    capturedOnDragEnd({ active: { id: '1' }, over: { id: 'unassigned' } })

    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      { assignee_id: null }
    )
  })
})
