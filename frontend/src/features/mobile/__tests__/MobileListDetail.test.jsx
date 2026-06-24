import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
vi.mock('react-router-dom', () => ({ useParams: () => ({ workspaceId: '9', projectId: '4', listId: '2' }), useNavigate: () => vi.fn() }))
vi.mock('../../../lib/api.js', () => ({
  useListItems: () => ({ data: [{ id: 1, list_id: 2, text: 'Item', status: 'To do', completed: false, position: 1000 }], isLoading: false }),
  useWorkspaceMembers: () => ({ data: [] }),
  useUpdateItem: () => ({ mutate: vi.fn() }),
}))
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }) => <div data-testid="dnd-context">{children}</div>,
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
import { MobileListDetail } from '../MobileListDetail.jsx'

describe('MobileListDetail', () => {
  it('renders the lens toggle and switches to Board', () => {
    render(<MobileListDetail />)
    expect(screen.getByTestId('mobile-list-detail')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Board' }))
    expect(screen.getByTestId('board-view')).toBeInTheDocument()
  })
})
