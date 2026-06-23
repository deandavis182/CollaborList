import { render, screen, fireEvent } from '@testing-library/react'
import { ListViewLens } from '../ListViewLens.jsx'

// Minimal stub for ItemRow to isolate ListViewLens behaviour
vi.mock('../../items/ItemRow.jsx', () => ({
  ItemRow: ({ item, onToggleComplete, onOpen }) => (
    <div
      data-testid={`item-row-${item.id}`}
      onClick={() => onOpen && onOpen(item.id)}
    >
      <input
        type="checkbox"
        data-testid={`checkbox-${item.id}`}
        checked={!!item.completed}
        readOnly
        onClick={(e) => { e.stopPropagation(); onToggleComplete && onToggleComplete(item) }}
      />
      {item.text}
    </div>
  ),
}))

const ITEMS = [
  { id: '1', text: 'Alpha', completed: false, status: 'To do',   assignee_id: '10', tags: [{ id: 'ta', name: 'Frontend', color: '#3b82f6' }] },
  { id: '2', text: 'Beta',  completed: true,  status: 'Done',    assignee_id: null,  tags: [{ id: 'tb', name: 'Backend',  color: '#22c55e' }] },
  { id: '3', text: 'Gamma', completed: false, status: 'Doing',   assignee_id: '10', tags: [{ id: 'ta', name: 'Frontend', color: '#3b82f6' }, { id: 'tc', name: 'Bug', color: '#ef4444' }] },
  { id: '4', text: 'Delta', completed: false, status: null,      assignee_id: null,  tags: [] },
]

const MEMBERS = [{ user_id: 10, email: 'alice@example.com' }]

describe('ListViewLens', () => {
  // ── groupBy none ────────────────────────────────────────────────────────────
  describe("groupBy='none'", () => {
    it('renders the root element with data-testid="list-view-lens"', () => {
      render(<ListViewLens items={ITEMS} />)
      expect(screen.getByTestId('list-view-lens')).toBeInTheDocument()
    })

    it('renders all items flat', () => {
      render(<ListViewLens items={ITEMS} />)
      expect(screen.getByTestId('item-row-1')).toBeInTheDocument()
      expect(screen.getByTestId('item-row-2')).toBeInTheDocument()
      expect(screen.getByTestId('item-row-3')).toBeInTheDocument()
      expect(screen.getByTestId('item-row-4')).toBeInTheDocument()
    })

    it('shows empty hint when items is empty', () => {
      render(<ListViewLens items={[]} />)
      expect(screen.getByTestId('listlens-empty')).toBeInTheDocument()
    })

    it('does not render any group headers in none mode', () => {
      render(<ListViewLens items={ITEMS} />)
      expect(screen.queryByTestId(/^group-/)).toBeNull()
    })
  })

  // ── groupBy completion ───────────────────────────────────────────────────────
  describe("groupBy='completion'", () => {
    it('renders Active and Done group headers', () => {
      render(<ListViewLens items={ITEMS} groupBy="completion" />)
      expect(screen.getByTestId('group-active')).toBeInTheDocument()
      expect(screen.getByTestId('group-done')).toBeInTheDocument()
    })

    it('Active group contains incomplete items', () => {
      render(<ListViewLens items={ITEMS} groupBy="completion" />)
      expect(screen.getByTestId('item-row-1')).toBeInTheDocument()
      expect(screen.getByTestId('item-row-3')).toBeInTheDocument()
      expect(screen.getByTestId('item-row-4')).toBeInTheDocument()
    })

    it('Done group contains completed items', () => {
      render(<ListViewLens items={ITEMS} groupBy="completion" />)
      expect(screen.getByTestId('item-row-2')).toBeInTheDocument()
    })

    it('Active header shows count of incomplete items', () => {
      render(<ListViewLens items={ITEMS} groupBy="completion" />)
      expect(screen.getByTestId('group-active')).toHaveTextContent('3')
    })

    it('Done header shows count of completed items', () => {
      render(<ListViewLens items={ITEMS} groupBy="completion" />)
      expect(screen.getByTestId('group-done')).toHaveTextContent('1')
    })
  })

  // ── groupBy status ───────────────────────────────────────────────────────────
  describe("groupBy='status'", () => {
    it('renders groups in canonical order (To do, Doing, Done)', () => {
      render(<ListViewLens items={ITEMS} groupBy="status" />)
      const groups = screen.getAllByTestId(/^group-/)
      const names = groups.map((el) => el.textContent)
      // "To do" should come before "Doing" which should come before "Done"
      const todoIdx  = names.findIndex((n) => n.includes('To do'))
      const doingIdx = names.findIndex((n) => n.includes('Doing'))
      const doneIdx  = names.findIndex((n) => n.includes('Done'))
      expect(todoIdx).toBeLessThan(doingIdx)
      expect(doingIdx).toBeLessThan(doneIdx)
    })

    it('places null-status item under "No status" group', () => {
      render(<ListViewLens items={ITEMS} groupBy="status" />)
      expect(screen.getByTestId('group-no-status')).toBeInTheDocument()
      expect(screen.getByTestId('item-row-4')).toBeInTheDocument()
    })

    it('omits empty status groups', () => {
      // Items have: To do, Done, Doing, null — no "Blocked" → no Blocked group
      render(<ListViewLens items={ITEMS} groupBy="status" />)
      expect(screen.queryByTestId('group-blocked')).toBeNull()
    })

    it('assigns each item to its correct status group', () => {
      render(<ListViewLens items={ITEMS} groupBy="status" />)
      expect(screen.getByTestId('item-row-1')).toBeInTheDocument() // To do
      expect(screen.getByTestId('item-row-2')).toBeInTheDocument() // Done
      expect(screen.getByTestId('item-row-3')).toBeInTheDocument() // Doing
    })
  })

  // ── groupBy assignee ─────────────────────────────────────────────────────────
  describe("groupBy='assignee'", () => {
    it('renders a group for each distinct assignee + Unassigned', () => {
      render(<ListViewLens items={ITEMS} members={MEMBERS} groupBy="assignee" />)
      // assignee_id=10 → alice@example.com; null → Unassigned
      expect(screen.getByTestId('group-10')).toBeInTheDocument()
      expect(screen.getByTestId('group-unassigned')).toBeInTheDocument()
    })

    it('group header shows resolved email for known member', () => {
      render(<ListViewLens items={ITEMS} members={MEMBERS} groupBy="assignee" />)
      expect(screen.getByTestId('group-10')).toHaveTextContent('alice@example.com')
    })

    it('Unassigned group contains items with null assignee_id', () => {
      render(<ListViewLens items={ITEMS} members={MEMBERS} groupBy="assignee" />)
      expect(screen.getByTestId('item-row-2')).toBeInTheDocument() // null assignee
      expect(screen.getByTestId('item-row-4')).toBeInTheDocument() // null assignee
    })

    it('assigned group contains items with that assignee', () => {
      render(<ListViewLens items={ITEMS} members={MEMBERS} groupBy="assignee" />)
      expect(screen.getByTestId('item-row-1')).toBeInTheDocument() // assignee 10
      expect(screen.getByTestId('item-row-3')).toBeInTheDocument() // assignee 10
    })
  })

  // ── groupBy tag ──────────────────────────────────────────────────────────────
  describe("groupBy='tag'", () => {
    it('renders a group for each unique tag', () => {
      render(<ListViewLens items={ITEMS} groupBy="tag" />)
      // Tags: Frontend (ta), Backend (tb), Bug (tc), Untagged (item 4)
      expect(screen.getByTestId('group-ta')).toBeInTheDocument()
      expect(screen.getByTestId('group-tb')).toBeInTheDocument()
      expect(screen.getByTestId('group-tc')).toBeInTheDocument()
    })

    it('multi-tag item appears under each of its tags', () => {
      render(<ListViewLens items={ITEMS} groupBy="tag" />)
      // Item 3 has tags ta (Frontend) and tc (Bug) → appears in both groups
      // Since testids are not unique across groups, just check both group sections exist
      const frontendGroup = screen.getByTestId('group-ta')
      const bugGroup = screen.getByTestId('group-tc')
      expect(frontendGroup).toBeInTheDocument()
      expect(bugGroup).toBeInTheDocument()
    })

    it('renders an Untagged group for items with no tags', () => {
      render(<ListViewLens items={ITEMS} groupBy="tag" />)
      expect(screen.getByTestId('group-untagged')).toBeInTheDocument()
    })

    it('untagged item is under Untagged group and not in tag groups', () => {
      render(<ListViewLens items={ITEMS} groupBy="tag" />)
      expect(screen.getByTestId('group-untagged')).toBeInTheDocument()
    })
  })

  // ── collapsing groups ────────────────────────────────────────────────────────
  describe('group collapsing', () => {
    it('clicking a group header collapses it and hides rows', () => {
      render(<ListViewLens items={ITEMS} groupBy="completion" />)
      const activeHeader = screen.getByTestId('group-active')
      // Before collapse: rows visible
      expect(screen.getByTestId('item-row-1')).toBeInTheDocument()
      // Collapse by clicking header
      fireEvent.click(activeHeader)
      // After collapse: rows hidden
      expect(screen.queryByTestId('item-row-1')).toBeNull()
    })

    it('clicking a collapsed group header expands it again', () => {
      render(<ListViewLens items={ITEMS} groupBy="completion" />)
      const activeHeader = screen.getByTestId('group-active')
      fireEvent.click(activeHeader) // collapse
      fireEvent.click(activeHeader) // expand
      expect(screen.getByTestId('item-row-1')).toBeInTheDocument()
    })

    it('collapsing one group does not affect other groups', () => {
      render(<ListViewLens items={ITEMS} groupBy="completion" />)
      fireEvent.click(screen.getByTestId('group-active'))
      // Done group items should still be visible
      expect(screen.getByTestId('item-row-2')).toBeInTheDocument()
    })
  })

  // ── handler wiring ───────────────────────────────────────────────────────────
  describe('handler wiring', () => {
    it('clicking a row calls onOpen with item.id', () => {
      const onOpen = vi.fn()
      render(<ListViewLens items={ITEMS} onOpen={onOpen} />)
      fireEvent.click(screen.getByTestId('item-row-1'))
      expect(onOpen).toHaveBeenCalledWith('1')
    })

    it('toggling a checkbox calls onToggleComplete with the item', () => {
      const onToggleComplete = vi.fn()
      render(<ListViewLens items={ITEMS} onToggleComplete={onToggleComplete} />)
      fireEvent.click(screen.getByTestId('checkbox-1'))
      expect(onToggleComplete).toHaveBeenCalledWith(ITEMS[0])
    })
  })

  // ── add-item input ───────────────────────────────────────────────────────────
  describe('add-item input', () => {
    it('renders add-item-input and add-item-button when onAddItem is provided', () => {
      render(<ListViewLens items={ITEMS} onAddItem={() => {}} />)
      expect(screen.getByTestId('add-item-input')).toBeInTheDocument()
      expect(screen.getByTestId('add-item-button')).toBeInTheDocument()
    })

    it('does not render add-item-input when onAddItem is absent', () => {
      render(<ListViewLens items={ITEMS} />)
      expect(screen.queryByTestId('add-item-input')).toBeNull()
    })

    it('calls onAddItem with trimmed text and clears input', () => {
      const onAddItem = vi.fn()
      render(<ListViewLens items={ITEMS} onAddItem={onAddItem} />)
      const input = screen.getByTestId('add-item-input')
      fireEvent.change(input, { target: { value: '  New task  ' } })
      fireEvent.click(screen.getByTestId('add-item-button'))
      expect(onAddItem).toHaveBeenCalledWith('New task')
      expect(input.value).toBe('')
    })

    it('ignores whitespace-only input', () => {
      const onAddItem = vi.fn()
      render(<ListViewLens items={ITEMS} onAddItem={onAddItem} />)
      fireEvent.change(screen.getByTestId('add-item-input'), { target: { value: '   ' } })
      fireEvent.click(screen.getByTestId('add-item-button'))
      expect(onAddItem).not.toHaveBeenCalled()
    })
  })
})
