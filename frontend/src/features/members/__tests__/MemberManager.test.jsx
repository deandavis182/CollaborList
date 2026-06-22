import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useWorkspaceMembers: vi.fn(),
  useAddMember: vi.fn(),
  useRemoveMember: vi.fn(),
}))

import { useWorkspaceMembers, useAddMember, useRemoveMember } from '../../../lib/api.js'
import { MemberManager } from '../MemberManager.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ children }) {
  return (
    <QueryClientProvider client={makeQC()}>
      {children}
    </QueryClientProvider>
  )
}

const WORKSPACE_ID = 'ws-1'

const SAMPLE_MEMBERS = [
  { user_id: 'u1', email: 'alice@example.com', role: 'owner' },
  { user_id: 'u2', email: 'bob@example.com', role: 'admin' },
  { user_id: 'u3', email: 'carol@example.com', role: 'member' },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('MemberManager', () => {
  let mockMutateAsync
  let mockRemoveMutate

  beforeEach(() => {
    mockMutateAsync = vi.fn().mockResolvedValue({})
    mockRemoveMutate = vi.fn()

    useWorkspaceMembers.mockReturnValue({ data: SAMPLE_MEMBERS, isLoading: false })
    useAddMember.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false })
    useRemoveMember.mockReturnValue({ mutate: mockRemoveMutate })
  })

  // ── Rendering ─────────────────────────────────────────────────────────────

  it('renders all member emails', () => {
    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(screen.getByText('carol@example.com')).toBeInTheDocument()
  })

  it('renders role badges for each member', () => {
    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    expect(screen.getByText('owner')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByText('member')).toBeInTheDocument()
  })

  it('shows a loading state while members are fetching', () => {
    useWorkspaceMembers.mockReturnValue({ data: undefined, isLoading: true })

    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    expect(screen.getByText(/loading members/i)).toBeInTheDocument()
  })

  it('shows an empty state when there are no members', () => {
    useWorkspaceMembers.mockReturnValue({ data: [], isLoading: false })

    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    expect(screen.getByText(/no members yet/i)).toBeInTheDocument()
  })

  it('renders the add member form', () => {
    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add member/i })).toBeInTheDocument()
  })

  // ── Remove ────────────────────────────────────────────────────────────────

  it('does NOT show a remove button for the sole owner', () => {
    // Only one owner in SAMPLE_MEMBERS (alice)
    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    // There should be remove buttons for bob and carol, but NOT alice
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    expect(removeButtons).toHaveLength(2) // bob + carol
    removeButtons.forEach((btn) => {
      expect(btn).not.toHaveAccessibleName(/alice/i)
    })
  })

  it('shows remove buttons for all members when there are multiple owners', () => {
    useWorkspaceMembers.mockReturnValue({
      data: [
        { user_id: 'u1', email: 'alice@example.com', role: 'owner' },
        { user_id: 'u2', email: 'bob@example.com', role: 'owner' },
      ],
      isLoading: false,
    })

    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    expect(removeButtons).toHaveLength(2)
  })

  it('calls useRemoveMember mutate with user_id when remove is clicked', () => {
    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    // Bob's remove button (first non-owner)
    fireEvent.click(screen.getByRole('button', { name: /remove bob/i }))

    expect(mockRemoveMutate).toHaveBeenCalledWith('u2', expect.any(Object))
  })

  it('calls useRemoveMember with the correct user_id for a member-role user', () => {
    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole('button', { name: /remove carol/i }))

    expect(mockRemoveMutate).toHaveBeenCalledWith('u3', expect.any(Object))
  })

  // ── Add ───────────────────────────────────────────────────────────────────

  it('calls useAddMember mutateAsync with { email, role } on submit', async () => {
    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'dave@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/role/i), {
      target: { value: 'admin' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add member/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        email: 'dave@example.com',
        role: 'admin',
      })
    })
  })

  it('defaults the role to "member" when none is selected', async () => {
    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'eve@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add member/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        email: 'eve@example.com',
        role: 'member',
      })
    })
  })

  it('shows a validation error when email is empty', () => {
    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole('button', { name: /add member/i }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  // ── Error handling ────────────────────────────────────────────────────────

  it('shows an inline error when useAddMember rejects with "no user" message', async () => {
    const noUserError = Object.assign(new Error('No user with that email'), {
      response: { data: { error: 'No user with that email' } },
    })
    mockMutateAsync.mockRejectedValue(noUserError)
    useAddMember.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false })

    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'nobody@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add member/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no user with that email/i)
    })
  })

  it('shows the error message from the API response when add fails', async () => {
    const apiError = Object.assign(new Error('Server error'), {
      response: { data: { error: 'No user with that email' } },
    })
    mockMutateAsync.mockRejectedValue(apiError)
    useAddMember.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false })

    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'ghost@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add member/i }))

    await waitFor(() => {
      // The error should appear in the Field error (role="alert")
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert.textContent).toMatch(/no user with that email/i)
    })
  })

  it('clears the email input after a successful add', async () => {
    render(<MemberManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    const emailInput = screen.getByLabelText(/email/i)
    fireEvent.change(emailInput, { target: { value: 'frank@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /add member/i }))

    await waitFor(() => {
      expect(emailInput.value).toBe('')
    })
  })
})
