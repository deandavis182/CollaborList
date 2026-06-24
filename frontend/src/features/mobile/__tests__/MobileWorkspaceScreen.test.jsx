/**
 * MobileWorkspaceScreen.test.jsx
 *
 * TDD tests for the mobile Workspace screen.
 * All server hooks mocked; store used directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Hoist shared navigate fn so it's available during vi.mock factory execution
// ---------------------------------------------------------------------------
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))

// ---------------------------------------------------------------------------
// Mock react-router-dom
// ---------------------------------------------------------------------------
vi.mock('react-router-dom', () => ({
  useParams: () => ({ workspaceId: '9' }),
  useNavigate: () => navigate,
}))

// ---------------------------------------------------------------------------
// Mock api hooks
// ---------------------------------------------------------------------------
const addMemberAsync = vi.fn()
const removeMember = vi.fn()
const createTag = vi.fn()
const deleteTag = vi.fn()

vi.mock('../../../lib/api.js', () => ({
  useWorkspaces: vi.fn(() => ({
    data: [
      { id: 9, name: 'Design Co', role: 'owner' },
      { id: 42, name: 'Dev Team', role: 'member' },
    ],
  })),
  useWorkspaceMembers: vi.fn(() => ({
    data: [
      { user_id: 1, email: 'owner@example.com', role: 'owner' },
      { user_id: 2, email: 'member@example.com', role: 'member' },
    ],
    isLoading: false,
  })),
  useAddMember: vi.fn(() => ({ mutateAsync: addMemberAsync, isPending: false })),
  useRemoveMember: vi.fn(() => ({ mutate: removeMember })),
  useProjects: vi.fn(() => ({
    data: [
      { id: 101, name: 'Alpha Project' },
      { id: 202, name: 'Beta Project' },
    ],
    isLoading: false,
  })),
  useTags: vi.fn(() => ({
    data: [{ id: 55, name: 'Urgent', color: '#ef4444' }],
    isLoading: false,
  })),
  useCreateTag: vi.fn(() => ({ mutate: createTag, isPending: false })),
  useDeleteTag: vi.fn(() => ({ mutate: deleteTag })),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { useStore } from '../../../lib/store.js'
import { MobileWorkspaceScreen } from '../MobileWorkspaceScreen.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderScreen() {
  return render(<MobileWorkspaceScreen />)
}

describe('MobileWorkspaceScreen', () => {
  beforeEach(() => {
    navigate.mockClear()
    addMemberAsync.mockReset()
    removeMember.mockReset()
    createTag.mockReset()
    deleteTag.mockReset()
    useStore.setState({
      currentWorkspaceId: null,
      currentProjectId: null,
      toast: null,
    })
  })

  // ─── Root render ─────────────────────────────────────────────────────────

  it('renders the root container with data-testid="mobile-workspace-screen"', () => {
    renderScreen()
    expect(screen.getByTestId('mobile-workspace-screen')).toBeInTheDocument()
  })

  it('shows the workspace name in the header h1', () => {
    renderScreen()
    expect(screen.getByRole('heading', { name: 'Design Co' })).toBeInTheDocument()
  })

  it('has a back button that calls navigate(-1)', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(navigate).toHaveBeenCalledWith(-1)
  })

  // ─── Workspace switcher ───────────────────────────────────────────────────

  it('renders the workspace switcher when user has > 1 workspace', () => {
    renderScreen()
    expect(screen.getByTestId('ws-switcher')).toBeInTheDocument()
  })

  it('shows both workspace names in the switcher', () => {
    renderScreen()
    const switcher = screen.getByTestId('ws-switcher')
    expect(switcher).toHaveTextContent('Design Co')
    expect(switcher).toHaveTextContent('Dev Team')
  })

  it('clicking the other workspace chip navigates to /w/42', () => {
    renderScreen()
    // Click the Dev Team chip (not current)
    fireEvent.click(screen.getByRole('button', { name: 'Dev Team' }))
    expect(navigate).toHaveBeenCalledWith('/w/42')
  })

  // ─── Members section ──────────────────────────────────────────────────────

  it('renders both members', () => {
    renderScreen()
    expect(screen.getByText('owner@example.com')).toBeInTheDocument()
    expect(screen.getByText('member@example.com')).toBeInTheDocument()
  })

  it('does NOT show remove button for the sole owner', () => {
    renderScreen()
    // The owner is the sole owner — their remove button should be absent
    expect(
      screen.queryByRole('button', { name: 'Remove owner@example.com' })
    ).not.toBeInTheDocument()
  })

  it('shows remove button for non-sole members', () => {
    renderScreen()
    expect(
      screen.getByRole('button', { name: 'Remove member@example.com' })
    ).toBeInTheDocument()
  })

  it('clicking a member remove button calls removeMember with user_id', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Remove member@example.com' }))
    expect(removeMember).toHaveBeenCalledWith(2, expect.any(Object))
  })

  // ─── Add member sheet ─────────────────────────────────────────────────────

  it('opens the add-member sheet when add-member-btn is clicked', () => {
    renderScreen()
    fireEvent.click(screen.getByTestId('add-member-btn'))
    // Email input should now be visible
    expect(screen.getByTestId('member-email-input')).toBeInTheDocument()
  })

  it('submitting the add-member form calls addMemberAsync and on success closes the sheet + toasts', async () => {
    addMemberAsync.mockResolvedValue({})
    const showToast = vi.fn()
    useStore.setState({ showToast })
    renderScreen()
    // Open sheet
    fireEvent.click(screen.getByTestId('add-member-btn'))
    // Fill in email
    fireEvent.change(screen.getByTestId('member-email-input'), {
      target: { value: 'new@example.com' },
    })
    // Submit
    fireEvent.click(screen.getByTestId('member-add-submit'))
    await waitFor(() => {
      expect(addMemberAsync).toHaveBeenCalledWith({
        email: 'new@example.com',
        role: 'member',
      })
    })
    // Success side effects: toast fired and sheet closed
    expect(showToast).toHaveBeenCalledWith('new@example.com added')
    await waitFor(() => {
      expect(screen.queryByTestId('member-email-input')).not.toBeInTheDocument()
      expect(screen.queryByTestId('member-add-submit')).not.toBeInTheDocument()
    })
  })

  it('shows inline error when submitting empty email in add-member form', () => {
    renderScreen()
    fireEvent.click(screen.getByTestId('add-member-btn'))
    // Try to submit with empty email
    fireEvent.click(screen.getByTestId('member-add-submit'))
    expect(screen.getByText('Email is required')).toBeInTheDocument()
  })

  // ─── Projects section ─────────────────────────────────────────────────────

  it('renders project rows for each project', () => {
    renderScreen()
    expect(screen.getByTestId('workspace-project-row-101')).toBeInTheDocument()
    expect(screen.getByTestId('workspace-project-row-202')).toBeInTheDocument()
  })

  it('clicking a project row navigates to the project route', () => {
    renderScreen()
    fireEvent.click(screen.getByTestId('workspace-project-row-101'))
    expect(navigate).toHaveBeenCalledWith('/w/9/p/101')
  })

  // ─── Tags section ────────────────────────────────────────────────────────

  it('renders existing tags as chips', () => {
    renderScreen()
    expect(screen.getByText('Urgent')).toBeInTheDocument()
  })

  it('submitting the add-tag form calls createTag with the tag name', () => {
    renderScreen()
    fireEvent.change(screen.getByTestId('tag-name-input'), {
      target: { value: 'Blocker' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    expect(createTag).toHaveBeenCalledWith(
      { name: 'Blocker' },
      expect.any(Object)
    )
  })

  it('does not call createTag when tag name is empty', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    expect(createTag).not.toHaveBeenCalled()
  })

  it("clicking a tag chip's remove button calls deleteTag with the tag id", () => {
    renderScreen()
    // The Chip renders its onRemove control as a button labelled "Remove".
    // Only one tag (id 55) is in the fixture, so this is unambiguous.
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(deleteTag).toHaveBeenCalledWith(55)
  })
})
