/**
 * Sheet — slide-in panel for item-detail surfaces.
 *
 * Props:
 *   variant   : 'drawer' | 'fullscreen' | 'bottom'   (default: 'drawer')
 *   open      : boolean
 *   onClose   : function
 *   title       : string
 *   titleHidden : boolean  — when true, names the dialog via aria-label but
 *                            renders no visible header bar (title + close button)
 *   children    : ReactNode
 *
 * 'drawer'     = right-side panel (desktop)
 * 'fullscreen' = full-screen sheet (mobile)
 * 'bottom'     = slide-up bottom sheet (mobile)
 */

import { useEffect, useRef } from 'react'

export function Sheet({
  variant = 'drawer',
  open = false,
  onClose,
  title,
  titleHidden = false,
  children,
}) {
  const closeButtonRef = useRef(null)

  // Move focus to the close button when the sheet opens
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [open])

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
      : variant === 'bottom'
        ? 'fixed inset-x-0 bottom-0 z-50 flex flex-col bg-surface rounded-t-4xl max-h-[86%] overflow-y-auto shadow-xl animate-[sheet-up_320ms_cubic-bezier(.32,.72,0,1)]'
        : 'fixed top-0 right-0 h-full z-50 flex flex-col bg-surface border-l border-border shadow-xl w-full max-w-md overflow-y-auto'

  return (
    <>
      {/* Backdrop */}
      <div
        className={variant === 'bottom' ? 'fixed inset-0 z-40 bg-scrim' : 'fixed inset-0 z-40 bg-black/40'}
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
        data-testid="sheet-panel"
      >
        {/* Grab handle (bottom variant only) */}
        {variant === 'bottom' && (
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <span data-testid="sheet-grab" className="w-10 h-[5px] rounded-full bg-surface-2" />
          </div>
        )}

        {/* Header — hidden when titleHidden (dialog is still named via aria-label) */}
        {!titleHidden && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            {title && (
              <h2 className="text-lg font-semibold text-text">{title}</h2>
            )}
            <button
              ref={closeButtonRef}
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
        )}

        {/* Body */}
        <div className="flex-1 px-6 py-4">{children}</div>
      </div>
    </>
  )
}
