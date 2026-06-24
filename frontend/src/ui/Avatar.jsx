/**
 * Avatar — circular initials-based avatar with an optional image src.
 *
 * Background tint is deterministically derived from the name so the same
 * person always gets the same colour.
 *
 * Props:
 *   name  : string  — used to derive initials and background tint
 *   size  : 'xs' | 'sm' | 'md' | 'lg' | 'xl'  (default: 'md')
 *   src   : string | undefined  — image URL (falls back to initials)
 *   className : string
 */

/** Derive up to 2 initials from a name. */
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Deterministic hue from a string (djb2 hash → 0-359).
 * Returns a CSS hsl() string usable as a background color.
 */
function nameToHslBackground(name = '') {
  let hash = 5381
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 33) ^ name.charCodeAt(i)
    hash = hash >>> 0 // keep unsigned 32-bit
  }
  const hue = hash % 360
  // Use a muted saturation/lightness so it's readable against white text
  return `hsl(${hue}, 45%, 48%)`
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-xl',
  xl: 'w-[78px] h-[78px] text-2xl',
}

export function Avatar({ name = '', size = 'md', src, className = '', ...rest }) {
  const initials = getInitials(name)
  const bg = nameToHslBackground(name)
  const sizeClass = sizeClasses[size] ?? sizeClasses.md

  const base = `inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 overflow-hidden select-none ${sizeClass}`

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'avatar'}
        className={[base, className].filter(Boolean).join(' ')}
        {...rest}
      />
    )
  }

  return (
    <span
      aria-label={name || 'avatar'}
      className={[base, className].filter(Boolean).join(' ')}
      style={{ backgroundColor: bg }}
      {...rest}
    >
      {initials}
    </span>
  )
}
