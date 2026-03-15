import { format, parseISO, isValid } from 'date-fns'

export function fmtAmt(value) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function fmtDate(dateStr, fmt = 'MMM d, yyyy') {
  if (!dateStr) return ''
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
    return isValid(d) ? format(d, fmt) : dateStr
  } catch {
    return dateStr
  }
}

export function fmtDateShort(dateStr) {
  return fmtDate(dateStr, 'MMM d')
}

export function toISODate(date) {
  return date ? format(date, 'yyyy-MM-dd') : null
}

export function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// Deterministic color from name
const AVATAR_COLORS = [
  'bg-violet-100 text-violet-600',
  'bg-blue-100 text-blue-600',
  'bg-emerald-100 text-emerald-600',
  'bg-amber-100 text-amber-600',
  'bg-rose-100 text-rose-600',
  'bg-cyan-100 text-cyan-600',
  'bg-fuchsia-100 text-fuchsia-600',
  'bg-lime-100 text-lime-600',
]

export function avatarColor(name) {
  if (!name) return AVATAR_COLORS[0]
  const code = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
}
