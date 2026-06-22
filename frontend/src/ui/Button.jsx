/**
 * Button — token-styled, accessible action element.
 *
 * Props:
 *   variant  : 'primary' | 'secondary' | 'ghost' | 'danger'  (default: 'primary')
 *   size     : 'sm' | 'md'                                    (default: 'md')
 *   disabled : boolean
 *   onClick  : function
 *   children : ReactNode
 *   type     : 'button' | 'submit' | 'reset'                  (default: 'button')
 */

const variantClasses = {
  primary:
    'bg-primary text-white hover:opacity-90 active:opacity-80',
  secondary:
    'bg-surface-2 text-text border border-border hover:bg-surface-2/80',
  ghost:
    'bg-transparent text-text hover:bg-surface-2 active:bg-surface-2/60',
  danger:
    'bg-danger text-white hover:opacity-90 active:opacity-80',
}

const sizeClasses = {
  sm: 'px-3 py-1 text-sm rounded-sm',
  md: 'px-4 py-2 text-base rounded-md',
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  children,
  type = 'button',
  className = '',
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center font-medium ' +
    'transition-opacity duration-[150ms] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ' +
    'disabled:opacity-40 disabled:pointer-events-none select-none'

  const classes = [
    base,
    variantClasses[variant] ?? variantClasses.primary,
    sizeClasses[size] ?? sizeClasses.md,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      {...rest}
    >
      {children}
    </button>
  )
}
