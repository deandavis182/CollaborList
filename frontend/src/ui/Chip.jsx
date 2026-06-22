/**
 * Chip — small pill label for tags, assignees, statuses.
 *
 * Props:
 *   color    : 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger'
 *              (default: 'neutral')
 *   children : ReactNode
 *   onRemove : function | undefined  — renders a small × button when provided
 *   className: string
 */

const colorClasses = {
  neutral: 'bg-surface-2 text-text-muted',
  primary: 'bg-primary/10 text-primary',
  accent:  'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger:  'bg-danger/10 text-danger',
}

export function Chip({ color = 'neutral', children, onRemove, className = '', ...rest }) {
  const colorClass = colorClasses[color] ?? colorClasses.neutral

  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5',
        'text-xs font-medium rounded-sm select-none',
        colorClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label="Remove"
          onClick={onRemove}
          className="ml-0.5 leading-none opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current rounded-sm"
        >
          ×
        </button>
      )}
    </span>
  )
}
