import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock lib/api.js — we test wiring, not HTTP
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useFieldDefs:         vi.fn(),
  useCreateFieldDef:    vi.fn(),
  useDeleteFieldDef:    vi.fn(),
  useApplyFieldPreset:  vi.fn(),
  // ViewContainer deps
  useUpdateAnyItem:     vi.fn(),
  useCreateItem:        vi.fn(),
}))

import {
  useFieldDefs,
  useCreateFieldDef,
  useDeleteFieldDef,
  useApplyFieldPreset,
  useUpdateAnyItem,
  useCreateItem,
} from '../../../lib/api.js'

import { FieldsManager } from '../FieldsManager.jsx'
import { ViewContainer } from '../../views/ViewContainer.jsx'

// ---------------------------------------------------------------------------
// Mocks for ViewContainer dependencies
// ---------------------------------------------------------------------------
vi.mock('../../views/ListViewLens.jsx', () => ({
  ListViewLens: () => <div data-testid="list-view-lens" />,
}))
vi.mock('../../views/BoardView.jsx', () => ({
  BoardView: () => <div data-testid="board-view" />,
}))
vi.mock('@dnd-kit/core', () => ({
  DndContext:   ({ children }) => <div>{children}</div>,
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  useDraggable: () => ({ setNodeRef: () => {}, attributes: {}, listeners: {}, isDragging: false }),
  useSensor:    (s) => s,
  useSensors:   (...sensors) => sensors,
  PointerSensor: function PointerSensor() {},
  TouchSensor:   function TouchSensor() {},
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function Wrapper({ children }) {
  return <QueryClientProvider client={makeQC()}>{children}</QueryClientProvider>
}

const deleteMutateSpy   = vi.fn()
const createMutateSpy   = vi.fn()
const presetMutateSpy   = vi.fn()
const updateMutateSpy   = vi.fn()
const vcCreateMutateSpy = vi.fn()

const DEFS = [
  { id: 1, key: 'budget', label: 'Budget', type: 'number', config: {} },
  { id: 2, key: 'status_field', label: 'Status', type: 'status', config: { options: ['Open', 'Done'] } },
]

function setupMocks(defs = DEFS) {
  useFieldDefs.mockReturnValue({ data: defs, isLoading: false })
  useDeleteFieldDef.mockReturnValue({ mutate: deleteMutateSpy, isPending: false })
  useCreateFieldDef.mockReturnValue({ mutate: createMutateSpy, isPending: false })
  useApplyFieldPreset.mockReturnValue({ mutate: presetMutateSpy, isPending: false })
  useUpdateAnyItem.mockReturnValue({ mutate: updateMutateSpy, isPending: false })
  useCreateItem.mockReturnValue({ mutate: vcCreateMutateSpy, isPending: false })
}

beforeEach(() => {
  vi.clearAllMocks()
  deleteMutateSpy.mockReset()
  createMutateSpy.mockReset()
  presetMutateSpy.mockReset()
  setupMocks()
})

// ---------------------------------------------------------------------------
// FieldsManager tests
// ---------------------------------------------------------------------------

describe('FieldsManager', () => {
  it('renders data-testid="fields-manager" when open', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('fields-manager')).toBeInTheDocument()
  })

  it('renders nothing when open=false', () => {
    render(
      <FieldsManager listId={10} open={false} onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.queryByTestId('fields-manager')).toBeNull()
  })

  // ── Current defs list ─────────────────────────────────────────────────────

  it('renders each def with data-testid="field-def-{id}"', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('field-def-1')).toBeInTheDocument()
    expect(screen.getByTestId('field-def-2')).toBeInTheDocument()
  })

  it('shows label for each def', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByText('Budget')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('shows type chip for each def', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    // Each def row has a Chip with the type text; there may also be a <select>
    // option with the same text — use getAllByText and confirm at least one match.
    expect(screen.getAllByText('number').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('status').length).toBeGreaterThanOrEqual(1)
  })

  it('shows a delete button for each def with data-testid="delete-field-def-{id}"', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('delete-field-def-1')).toBeInTheDocument()
    expect(screen.getByTestId('delete-field-def-2')).toBeInTheDocument()
  })

  it('clicking delete calls useDeleteFieldDef.mutate(id)', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    fireEvent.click(screen.getByTestId('delete-field-def-1'))
    expect(deleteMutateSpy).toHaveBeenCalledWith(1)
  })

  it('shows "No fields yet" when defs is empty', () => {
    setupMocks([])
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByText(/no fields yet/i)).toBeInTheDocument()
  })

  // ── Add-field form ────────────────────────────────────────────────────────

  it('renders the add-field form inputs', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('field-label')).toBeInTheDocument()
    expect(screen.getByTestId('field-key')).toBeInTheDocument()
    expect(screen.getByTestId('field-type')).toBeInTheDocument()
  })

  it('auto-suggests key from label (lowercase, spaces→_)', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    const labelInput = screen.getByTestId('field-label')
    fireEvent.change(labelInput, { target: { value: 'My Budget' } })
    expect(screen.getByTestId('field-key')).toHaveValue('my_budget')
  })

  it('submitting with type=number calls useCreateFieldDef.mutate with correct args', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    fireEvent.change(screen.getByTestId('field-label'), { target: { value: 'Cost' } })
    fireEvent.change(screen.getByTestId('field-key'), { target: { value: 'cost' } })
    // type select defaults to 'number'; set it explicitly
    fireEvent.change(screen.getByTestId('field-type'), { target: { value: 'number' } })
    fireEvent.click(screen.getByTestId('add-field-def-button'))
    expect(createMutateSpy).toHaveBeenCalledWith(
      {
        key:      'cost',
        type:     'number',
        label:    'Cost',
        config:   {},
        position: DEFS.length,
      },
      expect.any(Object)
    )
  })

  it('submitting with type=status and options calls mutate with config.options array', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    fireEvent.change(screen.getByTestId('field-label'), { target: { value: 'Phase' } })
    fireEvent.change(screen.getByTestId('field-key'), { target: { value: 'phase' } })
    fireEvent.change(screen.getByTestId('field-type'), { target: { value: 'status' } })
    // options input should now appear
    const optInput = screen.getByTestId('field-options')
    fireEvent.change(optInput, { target: { value: 'A, B, C' } })
    fireEvent.click(screen.getByTestId('add-field-def-button'))
    expect(createMutateSpy).toHaveBeenCalledWith(
      {
        key:      'phase',
        type:     'status',
        label:    'Phase',
        config:   { options: ['A', 'B', 'C'] },
        position: DEFS.length,
      },
      expect.any(Object)
    )
  })

  it('does NOT call mutate when label is empty', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    fireEvent.change(screen.getByTestId('field-key'), { target: { value: 'mykey' } })
    fireEvent.click(screen.getByTestId('add-field-def-button'))
    expect(createMutateSpy).not.toHaveBeenCalled()
  })

  it('does NOT call mutate when key is empty', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    fireEvent.change(screen.getByTestId('field-label'), { target: { value: 'Something' } })
    // clear the auto-suggested key
    fireEvent.change(screen.getByTestId('field-key'), { target: { value: '' } })
    fireEvent.click(screen.getByTestId('add-field-def-button'))
    expect(createMutateSpy).not.toHaveBeenCalled()
  })

  // ── Preset buttons ────────────────────────────────────────────────────────

  it('renders preset-budget and preset-guests buttons', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('preset-budget')).toBeInTheDocument()
    expect(screen.getByTestId('preset-guests')).toBeInTheDocument()
  })

  it('clicking preset-budget calls useApplyFieldPreset.mutate("budget")', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    fireEvent.click(screen.getByTestId('preset-budget'))
    expect(presetMutateSpy).toHaveBeenCalledWith('budget')
  })

  it('clicking preset-guests calls useApplyFieldPreset.mutate("guests")', () => {
    render(
      <FieldsManager listId={10} open onClose={() => {}} />,
      { wrapper: Wrapper }
    )
    fireEvent.click(screen.getByTestId('preset-guests'))
    expect(presetMutateSpy).toHaveBeenCalledWith('guests')
  })
})

// ---------------------------------------------------------------------------
// ViewContainer — Fields button integration
// ---------------------------------------------------------------------------

describe('ViewContainer — Fields button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
    // Clear stored view prefs
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('collaborlist:viewpref:')) localStorage.removeItem(k)
    })
  })

  it('shows "Fields" button when listId is provided', () => {
    render(
      <ViewContainer items={[]} listId={10} scopeKey="test-fields" />,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId('open-fields-btn')).toBeInTheDocument()
  })

  it('hides "Fields" button when listId is absent (project roll-up)', () => {
    render(
      <ViewContainer items={[]} scopeKey="test-fields-no-list" />,
      { wrapper: Wrapper }
    )
    expect(screen.queryByTestId('open-fields-btn')).toBeNull()
  })

  it('clicking "Fields" button opens the FieldsManager sheet', () => {
    render(
      <ViewContainer items={[]} listId={10} scopeKey="test-fields-open" />,
      { wrapper: Wrapper }
    )
    expect(screen.queryByTestId('fields-manager')).toBeNull()
    fireEvent.click(screen.getByTestId('open-fields-btn'))
    expect(screen.getByTestId('fields-manager')).toBeInTheDocument()
  })
})
