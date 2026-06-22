/**
 * Sheet — slide-in panel for item-detail surfaces.
 *
 * Props:
 *   variant   : 'drawer' | 'fullscreen'   (default: 'drawer')
 *   open      : boolean
 *   onClose   : function
 *   title     : string
 *   children  : ReactNode
 *
 * 'drawer'     = right-side panel (desktop)
 * 'fullscreen' = full-screen sheet (mobile)
 */

import { useEffect } from 'react'

export function Sheet({
  variant = 'drawer',
  open = false,
  onClose,
  title,
  children,
}) {
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const panelClasses =
    variant === 'fullscreen'
      ? 'fixed inset-0 z-50 flex flex-col bg-surface overflow-y-auto'
      : 'fixed top-0 right-0 h-full z-50 flex flex-col bg-surface border-l border-border shadow-xl w-full max-w-md overflow-y-auto'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        aria-hidden="true"
        onClick={onClose}
        data-testid="sheet-backdrop"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={panelClasses}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          {title && (
            <h2 className="text-lg font-semibold text-text">{title}</h2>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-text-muted hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {/* × icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-4">{children}</div>
      </div>
    </>
  )
}
