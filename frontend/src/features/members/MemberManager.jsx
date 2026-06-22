/**
 * MemberManager — manage workspace members.
 *
 * Lists current members (Avatar + email + role badge) with a remove button.
 * Does not show a remove button for the sole owner.
 * Provides a form to add a new member by email + role.
 * Shows an inline error when the email has no matching user.
 *
 * Props:
 *   workspaceId : string | number — id of the workspace to manage.
 */

import { useState } from 'react'
import { useWorkspaceMembers, useAddMember, useRemoveMember } from '../../lib/api.js'
import { Avatar } from '../../ui/Avatar.jsx'
import { Button } from '../../ui/Button.jsx'
import { Chip } from '../../ui/Chip.jsx'
import { Field } from '../../ui/Field.jsx'
import { Toast } from '../../ui/Toast.jsx'

const ROLE_CHIP_COLOR = {
  owner: 'accent',
  admin: 'primary',
  member: 'neutral',
}

export function MemberManager({ workspaceId }) {
  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: members = [], isLoading } = useWorkspaceMembers(workspaceId)
  const { mutateAsync: addMemberAsync, isPending: isAdding } = useAddMember(workspaceId)
  const { mutate: removeMember } = useRemoveMember(workspaceId)

  // ── Add-form state ────────────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [addError, setAddError] = useState('')
  const [toast, setToast] = useState(null) // { message, variant }

  // ── Derived: is there exactly one owner? ──────────────────────────────────
  const ownerCount = members.filter((m) => m.role === 'owner').length

  async function handleAdd(e) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setAddError('Email is required')
      return
    }
    setAddError('')
    try {
      await addMemberAsync({ email: trimmedEmail, role })
      setEmail('')
      setRole('member')
      setToast({ message: `${trimmedEmail} added as ${role}`, variant: 'success' })
    } catch (err) {
      const msg =
        err?.response?.data?.error ??
        err?.message ??
        'Failed to add member'
      // "No user with that email" or similar — show inline
      setAddError(msg)
    }
  }

  function handleRemove(member) {
    removeMember(member.user_id, {
      onError: (err) => {
        const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to remove member'
        setToast({ message: msg, variant: 'error' })
      },
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section aria-label="Member manager" className="flex flex-col gap-6">
      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Member list */}
      <div>
        <h3 className="text-sm font-semibold text-text mb-3">Members</h3>

        {isLoading ? (
          <p className="text-sm text-text-muted" role="status">
            Loading members…
          </p>
        ) : members.length === 0 ? (
          <p className="text-sm text-text-muted">No members yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {members.map((member) => {
              const isSoleOwner = member.role === 'owner' && ownerCount <= 1
              return (
                <li
                  key={member.user_id}
                  className="flex items-center gap-3"
                >
                  <Avatar name={member.email} size="sm" />

                  <span className="flex-1 min-w-0 text-sm text-text truncate">
                    {member.email}
                  </span>

                  <Chip color={ROLE_CHIP_COLOR[member.role] ?? 'neutral'}>
                    {member.role}
                  </Chip>

                  {!isSoleOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${member.email}`}
                      onClick={() => handleRemove(member)}
                    >
                      Remove
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Add member form */}
      <form onSubmit={handleAdd} className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text">Add member</h3>

        <Field label="Email" htmlFor="member-email" error={addError}>
          <input
            id="member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Role" htmlFor="member-role">
          <select
            id="member-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </Field>

        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isAdding}>
            {isAdding ? 'Adding…' : 'Add member'}
          </Button>
        </div>
      </form>
    </section>
  )
}
