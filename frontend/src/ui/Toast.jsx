/**
 * Toast — transient notification (presentational only).
 *
 * Props:
 *   message   : string
 *   variant   : 'info' | 'success' | 'error'   (default: 'info')
 *   onDismiss : function — called when dismiss button is clicked
 */

const variantStyles = {
  info: {
    wrapper: 'bg-surface border-border',
    icon: 'text-primary',
    label: 'Info',
    iconPath: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  success: {
    wrapper: 'bg-surface border-border',
    icon: 'text-success',
    label: 'Success',
    iconPath: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  error: {
    wrapper: 'bg-surface border-danger/40',
    icon: 'text-danger',
    label: 'Error',
    iconPath: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
}

export function Toast({ message, variant = 'info', onDismiss }) {
  const styles = variantStyles[variant] ?? variantStyles.info

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-variant={variant}
      className={[
        'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md text-text',
        styles.wrapper,
      ].join(' ')}
    >
      {/* Variant icon */}
      <span className={['shrink-0 mt-0.5', styles.icon].join(' ')}>
        {styles.iconPath}
      </span>

      {/* Message */}
      <p className="flex-1 text-sm leading-snug">{message}</p>

      {/* Dismiss button */}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 text-text-muted hover:text-text rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
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
  )
}
