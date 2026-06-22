/**
 * Card — token-styled surface container.
 *
 * Design signature: a 2px left border in the primary color at ~40% opacity
 * gives cards a distinctive brand accent without overwhelming the content.
 *
 * Props:
 *   children  : ReactNode
 *   className : string  (additional Tailwind classes)
 *   as        : string  (HTML element, default: 'div')
 */

export function Card({ children, className = '', as: Tag = 'div', ...rest }) {
  const classes = [
    'bg-surface rounded-lg border border-border',
    'border-l-2',
    'shadow-sm',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag
      className={classes}
      style={{ borderLeftColor: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
