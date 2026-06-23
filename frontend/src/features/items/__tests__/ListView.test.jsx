import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useWorkspaceMembers: vi.fn(() => ({ data: [], isLoading: false })),
  useListItems: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateAnyItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useWorkspaceActivity: vi.fn(() => ({ data: { items: [], unread: 0 } })),
  useItemComments: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateComment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteComment: vi.fn(() => ({ mutate: vi.fn() })),
  useTags: vi.fn(() => ({ data: [], isLoading: false })),
  useAddItemTag: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useRemoveItemTag: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  // Field hooks — needed because ViewContainer now mounts FieldsManager
  useFieldDefs: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateFieldDef: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteFieldDef: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useApplyFieldPreset: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useSetItemField: vi.fn(() => ({ mutate: vi.fn() })),
  // Attachment hooks — needed because ItemDetailDrawer now mounts AttachmentList
  useAttachments: vi.fn(() => ({ data: [], isLoading: false })),
  useUploadAttachment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteAttachment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

import { useWorkspaceMembers, useListItems } from '../../../lib/api.js'
import { useStore } from '../../../lib/store.js'
import { ListView } from '../ListView.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

/**
 * Render ListView at a URL with :workspaceId/:projectId/:listId params.
 */
function renderAt({ workspaceId = 'ws-1', projectId = 'p-1', listId = 'l-1' } = {}) {
  const path = `/w/${workspaceId}/p/${projectId}/l/${listId}`
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/w/:workspaceId/p/:projectId/l/:listId"
            element={<ListView />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function resetStore() {
  useStore.setState({
    currentWorkspaceId: null,
    currentProjectId: null,
    detailItemId: null,
    presence: {},
    theme: 'light',
    socket: null,
  })
}

// Clear localStorage view prefs between tests
function clearViewPrefs() {
  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith('collaborlist:viewpref:')) localStorage.removeItem(k)
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ListView', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    clearViewPrefs()
    useWorkspaceMembers.mockReturnValue({ data: [], isLoading: false })
    useListItems.mockReturnValue({ data: [], isLoading: false })
  })

  it('renders the list-view container', () => {
    renderAt()
    expect(screen.getByTestId('list-view')).toBeInTheDocument()
  })

  it('renders a heading', () => {
    renderAt()
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })

  it('renders ViewContainer (view-container testid is present)', () => {
    renderAt()
    expect(screen.getByTestId('view-container')).toBeInTheDocument()
  })

  it('renders the add-item input (showAddItem is passed to ViewContainer)', () => {
    renderAt()
    expect(screen.getByTestId('add-item-input')).toBeInTheDocument()
  })

  it('renders item rows when items exist', () => {
    useListItems.mockReturnValue({
      data: [
        { id: 'i1', text: 'First item', completed: false },
        { id: 'i2', text: 'Second item', completed: false },
      ],
      isLoading: false,
    })

    renderAt()

    expect(screen.getByText('First item')).toBeInTheDocument()
    expect(screen.getByText('Second item')).toBeInTheDocument()
  })

  it('passes members to ViewContainer (shows assignee avatar when member is assigned)', () => {
    useWorkspaceMembers.mockReturnValue({
      data: [{ user_id: 7, email: 'alice@example.com' }],
      isLoading: false,
    })
    useListItems.mockReturnValue({
      data: [{ id: 'i1', text: 'Assigned task', completed: false, assignee_id: 7 }],
      isLoading: false,
    })

    renderAt()

    expect(screen.getByLabelText('alice@example.com')).toBeInTheDocument()
  })

  it('ItemDetailDrawer is mounted but closed when detailItemId is null', () => {
    renderAt()
    // Drawer is mounted but not open — sheet-panel should not be in the DOM
    expect(screen.queryByTestId('item-detail-drawer')).not.toBeInTheDocument()
  })

  it('ItemDetailDrawer opens when detailItemId matches a cached item', () => {
    useListItems.mockReturnValue({
      data: [{ id: 'i1', text: 'Do work', completed: false, status: 'To do' }],
      isLoading: false,
    })
    useStore.setState({ detailItemId: 'i1' })

    renderAt({ listId: 'l-1' })

    expect(screen.getByTestId('item-detail-drawer')).toBeInTheDocument()
  })

  it('calls useWorkspaceMembers with the workspaceId from the URL', () => {
    renderAt({ workspaceId: 'ws-42' })
    expect(useWorkspaceMembers).toHaveBeenCalledWith('ws-42')
  })

  it('calls useListItems with the listId from the URL', () => {
    renderAt({ listId: 'list-99' })
    expect(useListItems).toHaveBeenCalledWith('list-99')
  })
})
