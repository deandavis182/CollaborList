// Deterministic list color + status helpers for the mobile redesign.
function djb2(str) {
  let h = 5381
  for (let i = 0; i < String(str).length; i++) h = (h * 33) ^ String(str).charCodeAt(i)
  return h >>> 0
}

export function listColor(id) {
  const hue = djb2(`list-${id}`) % 360
  return `hsl(${hue}, 52%, 52%)`
}

export function listTint(id) {
  const hue = djb2(`list-${id}`) % 360
  return `hsla(${hue}, 52%, 52%, 0.13)`
}

export const STATUS_COLOR = {
  'To do': 'neutral',
  Doing: 'primary',
  Done: 'success',
  Blocked: 'danger',
}

export function statusChipColor(status) {
  return STATUS_COLOR[status] ?? 'neutral'
}
