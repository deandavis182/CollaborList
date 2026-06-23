/**
 * CommentThread — displays comments for an item with delete-own capability.
 *
 * Props:
 *   itemId      : string | number  — item whose comments to show
 *   workspaceId : string | number  — workspace for member resolution
 *
 * Reads current user from localStorage key 'user' (JSON with id and email).
 */

import { useItemComments, useDeleteComment } from '../../lib/api.js'
import { Avatar } from '../../ui/Avatar.jsx'
import { CommentComposer } from './CommentComposer.jsx'
import { TypingIndicator } from '../collab/TypingIndicator.jsx'
import { relativeTime } from '../../lib/relativeTime.js'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommentThread({ itemId, workspaceId, listId }) {
  const { data: comments = [], isLoading } = useItemComments(itemId)
  const deleteComment = useDeleteComment(itemId)

  const currentUser = JSON.parse(localStorage.getItem('user') || 'null')

  return (
    <div data-testid="comment-thread" className="flex flex-col gap-3">
      {/* Heading */}
      <h3 className="text-sm font-semibold text-text">Comments</h3>

      {/* Loading state */}
      {isLoading && (
        <p data-testid="comments-loading" className="text-sm text-text-muted">
          Loading comments…
        </p>
      )}

      {/* Empty state */}
      {!isLoading && comments.length === 0 && (
        <p className="text-sm text-text-muted">No comments yet</p>
      )}

      {/* Comment list (oldest-first, as returned by API) */}
      {!isLoading && comments.length > 0 && (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => {
            const isOwn =
              currentUser &&
              String(comment.user_id) === String(currentUser.id)

            return (
              <li key={comment.id} className="flex gap-2">
                <Avatar size="xs" name={comment.email} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-text">
                      {comment.email}
                    </span>
                    <span className="text-xs text-text-muted">
                      {relativeTime(comment.created_at)}
                    </span>

                    {isOwn && (
                      <button
                        type="button"
                        aria-label="Delete comment"
                        onClick={() => deleteComment.mutate(comment.id)}
                        className="ml-auto text-xs text-text-muted hover:text-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <p className="text-sm text-text mt-0.5 whitespace-pre-wrap break-words">
                    {comment.body}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Typing indicator — shows who is typing in this list's threads */}
      <TypingIndicator listId={listId} />

      {/* Composer */}
      <CommentComposer itemId={itemId} workspaceId={workspaceId} listId={listId} />
    </div>
  )
}
