import { initials, avatarColor } from '../lib/utils'
import { X, Loader2, CalendarDays, XCircle } from 'lucide-react'

// ── Avatar ─────────────────────────────────────────────────────────────────
export function Avatar({ name, size = 'md' }) {
  const colors = avatarColor(name)
  const sizes = { xs: 'w-6 h-6 text-xs', sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-16 h-16 text-xl' }
  return (
    <div className={`${sizes[size]} ${colors} rounded-full flex items-center justify-center font-semibold shrink-0`}>
      {initials(name)}
    </div>
  )
}

// ── Badge ──────────────────────────────────────────────────────────────────
export function Badge({ children, color = 'slate' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-brand-100 text-brand-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-violet-100 text-violet-700',
  }
  return (
    <span className={`badge ${colors[color]}`}>{children}</span>
  )
}

// ── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ size = 20, className = '' }) {
  return <Loader2 size={size} className={`animate-spin text-brand-500 ${className}`} />
}

// ── Modal ──────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} card p-6 shadow-2xl page-enter`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold font-display text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }) {
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <p className="text-slate-500 text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
        <button onClick={() => { onConfirm(); onClose() }}
          className={`${danger ? 'btn-danger' : 'btn-primary'} text-sm py-2 px-4`}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// ── Empty State ────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon size={28} className="text-slate-300" />
      </div>
      <p className="font-semibold text-slate-400 text-base">{title}</p>
      {subtitle && <p className="text-slate-300 text-sm mt-1">{subtitle}</p>}
    </div>
  )
}

// ── Tab Bar ────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150
            ${active === t.id ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t.icon && <t.icon size={15} />}
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Page Header ────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions, onBack }) {
  return (
    <div className="bg-brand-500 text-white">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-white/20 transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-xl leading-tight truncate">{title}</h1>
            {subtitle && <p className="text-white/70 text-sm mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  )
}

// ── Input Field ────────────────────────────────────────────────────────────
export function Field({ label, error, children }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

// ── DateInput ──────────────────────────────────────────────────────────────
// Safari-safe date input with manual clear button
export function DateInput({ value, onChange, placeholder = 'Select date', className = '' }) {
  // Safari doesn't fire onChange when user taps the native "clear/reset" button
  // Using onInput as well catches it
  function handleChange(e) {
    onChange(e.target.value)
  }

  return (
    <div className="relative w-full min-w-0">
      <CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
      <input
        type="date"
        value={value}
        onChange={handleChange}
        onInput={handleChange}
        className={`input pl-9 w-full min-w-0 text-sm ${value ? 'pr-8' : ''} ${className}`}
        style={{ maxWidth: '100%' }}
      />
      {/* Manual clear — Safari native clear button doesn't reliably fire onChange */}
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition z-10">
          <XCircle size={15} />
        </button>
      )}
    </div>
  )
}

// ── DateRangePicker ────────────────────────────────────────────────────────
// Stacks vertically on mobile, side by side on sm+ screens
// Clears end date automatically if start date is set after it
export function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, endDateError }) {
  function handleStartChange(val) {
    onStartChange(val)
    // Clear end date if it would become invalid
    if (endDate && val && val > endDate) onEndChange('')
  }

  function handleEndChange(val) {
    // Validate: don't allow end before start (submit-time validation handles the rest)
    if (startDate && val && val < startDate) return
    onEndChange(val)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="w-full">
        <label className="label">Start Date</label>
        <DateInput value={startDate} onChange={handleStartChange} />
      </div>
      <div className="w-full">
        <label className="label">End Date</label>
        <DateInput value={endDate} onChange={handleEndChange} />
        {endDateError && <p className="text-red-500 text-xs mt-1">{endDateError}</p>}
      </div>
    </div>
  )
}
