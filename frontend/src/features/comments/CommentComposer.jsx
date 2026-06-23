/**
 * CommentComposer — textarea + send button with @mention autocomplete.
 *
 * Props:
 *   itemId      : string | number  — item to post the comment on
 *   workspaceId : string | number  — workspace for member resolution
 *   disabled    : boolean          — disable the entire composer (default: false)
 */

import { useState, useRef } from 'react'
import { useCreateComment, useWorkspaceMembers } from '../../lib/api.js'
import { Button } from '../../ui/Button.jsx'
import { Toast } from '../../ui/Toast.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect an active @mention token immediately before the caret position.
 * Returns the fragment text (after @) or null when there's no active mention.
 *
 * @param {string} text  — full textarea value
 * @param {number} caret — selectionStart index
 * @returns {string | null}
 */
function detectMentionFragment(text, caret) {
  const textBeforeCaret = text.slice(0, caret)
  const match = textBeforeCaret.match(/@([A-Za-z0-9._%+-]*)$/)
  return match ? match[1] : null
}

/**
 * Replace the active @fragment (at/before caretPos) with the given replacement.
 *
 * @param {string} text         — full textarea value
 * @param {number} caret        — selectionStart
 * @param {string} replacement  — text to substitute in place of @fragment
 * @returns {string}
 */
function replaceMentionFragment(text, caret, replacement) {
  const textBeforeCaret = text.slice(0, caret)
  const replaced = textBeforeCaret.replace(/@([A-Za-z0-9._%+-]*)$/, replacement)
  return replaced + text.slice(caret)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommentComposer({ itemId, workspaceId, disabled = false }) {
  const [body, setBody] = useState('')
  // caretPos tracks the caret position used to detect the @mention fragment
  const [caretPos, setCaretPos] = useState(0)
  // mentionDismissed: user explicitly closed the menu; re-opens only on new @
  const [mentionDismissed, setMentionDismissed] = useState(false)
  const [errorToast, setErrorToast] = useState(null)

  const textareaRef = useRef(null)

  const createComment = useCreateComment(itemId)
  const { data: members = [] } = useWorkspaceMembers(workspaceId)

  // ---------------------------------------------------------------------------
  // @mention detection — derived from body + caretPos
  // ---------------------------------------------------------------------------
  const activeMentionFragment = mentionDismissed
    ? null
    : detectMentionFragment(body, caretPos)

  const filteredMembers =
    activeMentionFragment !== null
      ? members.filter((m) =>
          m.email.toLowerCase().includes(activeMentionFragment.toLowerCase())
        )
      : []

  const showMenu = activeMentionFragment !== null && filteredMembers.length > 0

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function handleChange(e) {
    const value = e.target.value
    // selectionStart may be 0 in jsdom; fall back to end of string for autocomplete
    const pos = e.target.selectionStart != null && e.target.selectionStart > 0
      ? e.target.selectionStart
      : value.length

    setBody(value)
    setCaretPos(pos)

    // If we detect a new @, un-dismiss the menu
    const frag = detectMentionFragment(value, pos)
    if (frag !== null) {
      setMentionDismissed(false)
    }
  }

  function handleSelect(e) {
    // Keep caretPos in sync when user moves cursor
    setCaretPos(e.target.selectionStart)
  }

  function submit() {
    const trimmed = body.trim()
    if (!trimmed) return
    createComment.mutate(
      { body: trimmed },
      {
        onSuccess: () => {
          setBody('')
          setCaretPos(0)
        },
        onError: () => {
          setErrorToast("Couldn't post comment — you may not have permission.")
        },
      }
    )
    // Clear optimistically so UI feels responsive
    setBody('')
    setCaretPos(0)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (showMenu) {
        e.preventDefault()
        setMentionDismissed(true)
      }
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      if (showMenu) {
        // Let Enter fall through for now (no keyboard nav in this version)
        return
      }
      e.preventDefault()
      submit()
    }
  }

  function selectMember(member) {
    const pos = caretPos || body.length
    const localPart = member.email.split('@')[0]
    const replacement = `@${localPart} `
    const newBody = replaceMentionFragment(body, pos, replacement)
    setBody(newBody)
    setCaretPos(newBody.length)
    setMentionDismissed(true)
    // Return focus to textarea
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  return (
    <div data-testid="comment-composer" className="flex flex-col gap-2">
      {errorToast && (
        <Toast
          message={errorToast}
          variant="error"
          onDismiss={() => setErrorToast(null)}
        />
      )}

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          disabled={disabled}
          rows={3}
          placeholder="Write a comment… (@mention to notify)"
          className="w-full text-sm rounded-md border border-border bg-surface px-3 py-2 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-y disabled:opacity-40 disabled:pointer-events-none"
        />

        {/* @mention dropdown */}
        {showMenu && (
          <ul
            data-testid="mention-menu"
            role="listbox"
            className="absolute z-50 w-full left-0 bottom-full mb-1 bg-surface border border-border rounded-md shadow-md max-h-40 overflow-y-auto"
          >
            {filteredMembers.map((m) => (
              <li
                key={m.user_id}
                data-testid={`mention-option-${m.user_id}`}
                role="option"
                aria-selected="false"
                onMouseDown={(e) => {
                  // Prevent textarea blur before click fires
                  e.preventDefault()
                }}
                onClick={() => selectMember(m)}
                className="px-3 py-2 text-sm text-text hover:bg-surface-2 cursor-pointer"
              >
                {m.email}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="primary"
          onClick={submit}
          disabled={disabled}
        >
          Comment
        </Button>
      </div>
    </div>
  )
}
