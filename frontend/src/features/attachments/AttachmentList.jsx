/**
 * AttachmentList — displays and manages file attachments for an item.
 *
 * Props:
 *   itemId : string | number — the item whose attachments to show
 */

import { useRef } from 'react'
import { useAttachments, useUploadAttachment, useDeleteAttachment } from '../../lib/api.js'

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

function buildDownloadUrl(attachmentId) {
  const token = localStorage.getItem('token')
  return `/api/attachments/${attachmentId}/download?token=${token}`
}

export function AttachmentList({ itemId }) {
  const inputRef = useRef(null)

  const { data: attachments = [] } = useAttachments(itemId)
  const upload = useUploadAttachment(itemId)
  const remove = useDeleteAttachment(itemId)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    upload.mutate(file)
    // Reset input so the same file can be re-uploaded after a delete
    e.target.value = ''
  }

  return (
    <div data-testid="attachment-list" className="flex flex-col gap-2">
      {attachments.length === 0 && (
        <p className="text-sm text-text-muted">No attachments</p>
      )}

      {attachments.map((a) => {
        const url = buildDownloadUrl(a.id)
        const isImage = IMAGE_MIME_TYPES.has(a.mime_type)

        return (
          <div
            key={a.id}
            data-testid={`attachment-${a.id}`}
            className="flex items-center gap-2"
          >
            {isImage ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={a.filename}
                  className="h-12 w-12 rounded object-cover border border-border"
                />
              </a>
            ) : (
              <a
                href={url}
                download={a.filename}
                className="text-sm text-primary underline truncate max-w-xs"
              >
                {a.filename}
              </a>
            )}

            <button
              data-testid={`delete-attachment-${a.id}`}
              onClick={() => remove.mutate(a.id)}
              aria-label={`Delete ${a.filename}`}
              className="ml-auto text-text-muted hover:text-danger text-sm leading-none"
            >
              ×
            </button>
          </div>
        )
      })}

      <input
        ref={inputRef}
        data-testid="attachment-upload-input"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
        onChange={handleFileChange}
        className="text-sm text-text"
      />
    </div>
  )
}
