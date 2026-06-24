/**
 * MobileWorkspaceScreen — mobile-styled workspace "home" screen.
 *
 * Rendered at /w/:workspaceId when useIsMobile() is true.
 * Shows: workspace name header + back button, workspace-switcher chip row,
 * Members section (list + remove + add-member), Projects section, Tags section.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  useWorkspaces,
  useWorkspaceMembers,
  useAddMember,
  useRemoveMember,
  useProjects,
  useTags,
  useCreateTag,
  useDeleteTag,
} from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { getApiError } from '../../lib/apiError.js'
import { hexToChipColor, PRESET_COLORS } from '../../lib/tagColor.js'
import { Avatar } from '../../ui/Avatar.jsx'
import { Chip } from '../../ui/Chip.jsx'
import { Sheet } from '../../ui/Sheet.jsx'

// ─── Role → Chip color ────────────────────────────────────────────────────────
const ROLE_CHIP_COLOR = { owner: 'accent', admin: 'primary', member: 'neutral' }

// ─── AddMemberSheet ───────────────────────────────────────────────────────────

/**
 * Bottom sheet sub-component for adding a workspace member.
 * Keeps hooks unconditional (called at top; returns null when !open).
 */
function AddMemberSheet({ workspaceId, open, onClose }) {
  const { mutateAsync: addMemberAsync } = useAddMember(workspaceId)
  const showToast = useStore((s) => s.showToast)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [error, setError] = useState('')

  // Reset form when sheet closes
  useEffect(() => {
    if (!open) {
      setEmail('')
      setRole('member')
      setError('')
    }
  }, [open])

  async function handleSubmit() {
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    setError('')
    try {
      await addMemberAsync({ email: email.trim(), role })
      setEmail('')
      setRole('member')
      showToast(`${email.trim()} added`)
      onClose()
    } catch (e) {
      setError(getApiError(e, 'Failed to add member'))
    }
  }

  return (
    <Sheet variant="bottom" open={open} onClose={onClose} title="Add member">
      <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
        {/* Email input */}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-bold uppercase tracking-[0.6px] text-text-muted" htmlFor="add-member-email">
            Email
          </label>
          <input
            id="add-member-email"
            data-testid="member-email-input"
            type="email"
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[15px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Role selector */}
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-bold uppercase tracking-[0.6px] text-text-muted">Role</span>
          <div className="flex gap-2">
            {(['member', 'admin']).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={[
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                  role === r
                    ? 'bg-primary text-white'
                    : 'bg-surface-2 text-text-muted',
                ].join(' ')}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Inline error */}
        {error && (
          <p className="text-[13px] text-danger" role="alert">{error}</p>
        )}

        {/* Submit button */}
        <button
          type="button"
          data-testid="member-add-submit"
          onClick={handleSubmit}
          className="w-full py-3.5 rounded-2xl bg-brand-gradient text-white font-semibold text-[15px] transition-opacity active:opacity-80"
        >
          Add member
        </button>
      </div>
    </Sheet>
  )
}

// ─── MobileWorkspaceScreen ───────────────────────────────────────────────────

export function MobileWorkspaceScreen() {
  const { workspaceId } = useParams()
  const navigate = useNavigate()

  const setCurrentWorkspace = useStore((s) => s.setCurrentWorkspace)
  const setCurrentProject = useStore((s) => s.setCurrentProject)
  const showToast = useStore((s) => s.showToast)

  // Sync URL param → store
  useEffect(() => {
    setCurrentWorkspace(workspaceId)
    setCurrentProject(null)
  }, [workspaceId, setCurrentWorkspace, setCurrentProject])

  // Data hooks
  const { data: workspaces = [] } = useWorkspaces()
  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const { mutate: removeMember } = useRemoveMember(workspaceId)
  const { data: projects = [], isLoading: projectsLoading } = useProjects(workspaceId)
  const { data: tags = [] } = useTags(workspaceId)
  const { mutate: createTag } = useCreateTag(workspaceId)
  const { mutate: deleteTag } = useDeleteTag(workspaceId)

  // Local state
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState('')

  // Derived
  const wsName = workspaces.find((w) => String(w.id) === String(workspaceId))?.name || 'Workspace'
  const ownerCount = members.filter((m) => m.role === 'owner').length

  // Tag form submit
  function handleCreateTag(e) {
    e.preventDefault()
    const trimmed = tagName.trim()
    if (!trimmed) return
    createTag(
      { name: trimmed, ...(tagColor ? { color: tagColor } : {}) },
      {
        onSuccess: () => {
          setTagName('')
          setTagColor('')
        },
        onError: (err) => {
          showToast(getApiError(err, 'Failed to create tag'), 'error')
        },
      }
    )
  }

  return (
    <div
      data-testid="mobile-workspace-screen"
      className="px-[18px] pt-[62px] pb-[116px] space-y-6 min-h-full bg-bg"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="w-[34px] h-[34px] rounded-full bg-surface-2 text-text-muted text-xl grid place-items-center shrink-0"
        >
          ‹
        </button>
        <h1 className="text-[24px] font-bold font-display text-text truncate">{wsName}</h1>
      </div>

      {/* ── Workspace switcher ── (only when > 1 workspace) */}
      {workspaces.length > 1 && (
        <div
          data-testid="ws-switcher"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {workspaces.map((w) => {
            const isActive = String(w.id) === String(workspaceId)
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => navigate(`/w/${w.id}`)}
                className={[
                  'px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0',
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-surface-2 text-text-muted',
                ].join(' ')}
              >
                {w.name}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Members section ── */}
      <section className="space-y-2">
        <div className="text-[12px] font-bold uppercase tracking-[0.6px] text-text-muted">
          Members · {members.length}
        </div>

        <div className="rounded-2xl border border-border bg-surface shadow-card divide-y divide-border overflow-hidden">
          {members.map((m) => {
            const isSoleOwner = m.role === 'owner' && ownerCount <= 1
            return (
              <div key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.email} size="sm" />
                <span className="flex-1 text-[14px] text-text truncate">{m.email}</span>
                <Chip color={ROLE_CHIP_COLOR[m.role] ?? 'neutral'}>{m.role}</Chip>
                {!isSoleOwner && (
                  <button
                    type="button"
                    aria-label={`Remove ${m.email}`}
                    onClick={() =>
                      removeMember(m.user_id, {
                        onError: (e) =>
                          showToast(
                            e?.response?.data?.error || 'Failed to remove member',
                            'error'
                          ),
                      })
                    }
                    className="ml-1 text-text-muted hover:text-danger transition-colors text-lg leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <button
          type="button"
          data-testid="add-member-btn"
          onClick={() => setAddMemberOpen(true)}
          className="w-full py-3 rounded-2xl border border-dashed border-border text-text-muted text-[14px] font-medium hover:border-primary hover:text-primary transition-colors"
        >
          + Add member
        </button>
      </section>

      {/* ── Projects section ── */}
      <section className="space-y-2">
        <div className="text-[12px] font-bold uppercase tracking-[0.6px] text-text-muted">
          Projects
        </div>

        {projectsLoading ? (
          <p className="text-[14px] text-text-muted">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-[14px] text-text-muted">No projects yet.</p>
        ) : (
          <div className="rounded-2xl border border-border bg-surface shadow-card divide-y divide-border overflow-hidden">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                data-testid={`workspace-project-row-${p.id}`}
                onClick={() => navigate(`/w/${workspaceId}/p/${p.id}`)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left text-[15px] text-text hover:bg-surface-2 transition-colors"
              >
                <span className="font-medium truncate">{p.name}</span>
                <span aria-hidden="true" className="text-text-muted ml-2">›</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Tags section ── */}
      <section className="space-y-2">
        <div className="text-[12px] font-bold uppercase tracking-[0.6px] text-text-muted">
          Tags
        </div>

        <div className="rounded-2xl border border-border bg-surface shadow-card p-4 space-y-4">
          {/* Existing tags */}
          {tags.length === 0 ? (
            <p className="text-[14px] text-text-muted">No tags yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <Chip
                  key={t.id}
                  color={hexToChipColor(t.color)}
                  onRemove={() => deleteTag(t.id)}
                >
                  {t.name}
                </Chip>
              ))}
            </div>
          )}

          {/* Add tag form */}
          <form onSubmit={handleCreateTag} className="flex flex-col gap-3">
            <input
              data-testid="tag-name-input"
              type="text"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="New tag name"
              className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-[14px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />

            {/* Color swatches */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Color swatches">
              {PRESET_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Select color ${hex}`}
                  aria-pressed={tagColor === hex}
                  onClick={() => setTagColor(tagColor === hex ? '' : hex)}
                  className="w-6 h-6 rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-transform hover:scale-110"
                  style={{
                    backgroundColor: hex,
                    borderColor: tagColor === hex ? 'currentColor' : 'transparent',
                  }}
                />
              ))}
            </div>

            <button
              type="submit"
              className="self-end px-4 py-2 rounded-xl bg-primary text-white text-[14px] font-semibold transition-opacity active:opacity-80 disabled:opacity-50"
            >
              Add tag
            </button>
          </form>
        </div>
      </section>

      {/* ── Add member sheet ── */}
      <AddMemberSheet
        workspaceId={workspaceId}
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
      />
    </div>
  )
}
