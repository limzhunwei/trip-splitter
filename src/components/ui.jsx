import { useState, useRef, useEffect } from 'react'
import { initials, avatarColor } from '../lib/utils'
import { X, Loader2, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

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
  return <span className={`badge ${colors[color]}`}>{children}</span>
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
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150
            ${active === t.id ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
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

// ── Date helpers ───────────────────────────────────────────────────────────
const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// Parse 'yyyy-MM-dd' → { y, m, d }  (m is 1-based)
function parseYMD(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return { y, m, d }
}

// Format { y, m, d } → 'yyyy-MM-dd'
function toYMD({ y, m, d }) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

// Display: 'Mar 15, 2025'
function displayDate(str) {
  const p = parseYMD(str)
  if (!p) return ''
  return `${MONTHS_SHORT[p.m - 1]} ${p.d}, ${p.y}`
}

function daysInMonth(y, m)    { return new Date(y, m, 0).getDate() }
function firstDayOfMonth(y, m) { return new Date(y, m - 1, 1).getDay() }

// Compare two 'yyyy-MM-dd' strings — returns negative if a < b
function cmpDate(a, b) { return a < b ? -1 : a > b ? 1 : 0 }

// ── Calendar Popup ─────────────────────────────────────────────────────────
// pickMode: null = day grid | 'month' = month grid | 'year' = year grid
// minDate: 'yyyy-MM-dd' — days before this are greyed and unclickable
function CalendarPopup({ value, onChange, onClose, anchorRef, minDate }) {
  const today    = new Date()
  const initial  = parseYMD(value) || { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() }
  const [viewY, setViewY]     = useState(initial.y)
  const [viewM, setViewM]     = useState(initial.m)
  const [pickMode, setPickMode] = useState(null) // null | 'month' | 'year'
  const popupRef = useRef(null)

  // Close on outside tap/click
  useEffect(() => {
    function onDown(e) {
      if (
        popupRef.current  && !popupRef.current.contains(e.target) &&
        anchorRef.current && !anchorRef.current.contains(e.target)
      ) onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [])

  function prevMonth() {
    if (viewM === 1) { setViewM(12); setViewY(y => y - 1) }
    else setViewM(m => m - 1)
  }
  function nextMonth() {
    if (viewM === 12) { setViewM(1); setViewY(y => y + 1) }
    else setViewM(m => m + 1)
  }

  function selectDay(d) {
    const str = toYMD({ y: viewY, m: viewM, d })
    if (minDate && cmpDate(str, minDate) < 0) return // blocked
    onChange(str)
    onClose()
  }

  function selectMonth(m) {
    setViewM(m)
    setPickMode(null) // go back to day grid
  }

  function selectYear(yr) {
    setViewY(yr)
    setPickMode('month') // after picking year → pick month
  }

  // Header button cycles: day → month → year → day
  function handleHeaderClick() {
    setPickMode(m => m === null ? 'month' : m === 'month' ? 'year' : null)
  }

  const selected   = parseYMD(value)
  const totalDays  = daysInMonth(viewY, viewM)
  const startDow   = firstDayOfMonth(viewY, viewM)
  const currentYear = today.getFullYear()
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i)

  // Is a given day-string before the minDate?
  function isDisabled(d) {
    if (!minDate) return false
    return cmpDate(toYMD({ y: viewY, m: viewM, d }), minDate) < 0
  }

  // Is the entire month before minDate's month? (grey prev arrow)
  const minParsed = parseYMD(minDate)

  return (
    <div
      ref={popupRef}
      className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
      style={{ minWidth: 280, width: '100%' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
        <button type="button" onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
          <ChevronLeft size={16} />
        </button>

        {/* Tap to cycle: day → month picker → year picker */}
        <button type="button" onClick={handleHeaderClick}
          className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 transition font-semibold text-slate-700 text-sm">
          {MONTHS_LONG[viewM - 1]} {viewY}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${pickMode ? 'rotate-180' : ''}`}>
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        <button type="button" onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Year picker ── */}
      {pickMode === 'year' && (
        <div className="max-h-44 overflow-y-auto p-2 grid grid-cols-4 gap-1 border-b border-slate-100">
          {years.map(yr => (
            <button key={yr} type="button" onClick={() => selectYear(yr)}
              className={`py-1.5 rounded-lg text-xs font-medium transition
                ${yr === viewY ? 'bg-brand-500 text-white' : 'hover:bg-slate-100 text-slate-600'}`}>
              {yr}
            </button>
          ))}
        </div>
      )}

      {/* ── Month picker ── */}
      {pickMode === 'month' && (
        <div className="p-2 grid grid-cols-3 gap-1.5 border-b border-slate-100">
          {MONTHS_SHORT.map((name, idx) => {
            const m = idx + 1
            return (
              <button key={m} type="button" onClick={() => selectMonth(m)}
                className={`py-2 rounded-xl text-sm font-medium transition
                  ${m === viewM ? 'bg-brand-500 text-white' : 'hover:bg-slate-100 text-slate-600'}`}>
                {name}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Day grid ── */}
      {pickMode === null && (
        <>
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {DAYS_SHORT.map(d => (
              <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-y-0.5 px-2 pb-3">
            {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: totalDays }).map((_, i) => {
              const d = i + 1
              const disabled = isDisabled(d)
              const isToday  = d === today.getDate() && viewM === today.getMonth() + 1 && viewY === today.getFullYear()
              const isSel    = selected && selected.d === d && selected.m === viewM && selected.y === viewY
              return (
                <button key={d} type="button"
                  onClick={() => !disabled && selectDay(d)}
                  disabled={disabled}
                  className={`flex items-center justify-center h-9 w-full rounded-xl text-sm font-medium transition
                    ${disabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : isSel
                        ? 'bg-brand-500 text-white'
                        : isToday
                          ? 'bg-brand-50 text-brand-600 font-bold'
                          : 'hover:bg-slate-100 text-slate-700'}`}>
                  {d}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* ── Clear button ── */}
      {value && (
        <div className="border-t border-slate-100 px-3 py-2">
          <button type="button" onClick={() => { onChange(''); onClose() }}
            className="w-full text-xs text-slate-400 hover:text-red-500 transition font-medium py-1">
            Clear date
          </button>
        </div>
      )}
    </div>
  )
}

// ── DateInput ──────────────────────────────────────────────────────────────
// Fully custom date picker — no native <input type="date">.
// Works identically on all iOS versions and browsers.
// minDate: 'yyyy-MM-dd' — dates before this are greyed/disabled in the picker.
export function DateInput({ value, onChange, minDate, className = '' }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)

  return (
    <div className="relative w-full" ref={anchorRef}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className={`input w-full flex items-center gap-2 text-left text-sm ${className}`}>
        <CalendarDays size={15} className="text-slate-400 shrink-0" />
        <span className={value ? 'text-slate-700 flex-1' : 'text-slate-400 flex-1'}>
          {value ? displayDate(value) : 'Select date'}
        </span>
        {/* Clear × button — only shows when a date is set */}
        {value && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onChange('') }}
            className="text-slate-300 hover:text-slate-500 transition shrink-0 leading-none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>
            </svg>
          </span>
        )}
      </button>

      {open && (
        <CalendarPopup
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
          anchorRef={anchorRef}
          minDate={minDate}
        />
      )}
    </div>
  )
}

// ── DateRangePicker ────────────────────────────────────────────────────────
// Start date: free pick. End date: days before start date are greyed + disabled.
export function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, endDateError }) {
  function handleStartChange(val) {
    onStartChange(val)
    // Clear end date if it's now before the new start date
    if (endDate && val && val > endDate) onEndChange('')
  }
  function handleEndChange(val) {
    onEndChange(val)
  }
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="w-full">
        <label className="label">Start Date</label>
        <DateInput value={startDate} onChange={handleStartChange} />
      </div>
      <div className="w-full">
        <label className="label">End Date</label>
        {/* Pass startDate as minDate — days before start are greyed in the picker */}
        <DateInput value={endDate} onChange={handleEndChange} minDate={startDate || undefined} />
        {endDateError && <p className="text-red-500 text-xs mt-1">{endDateError}</p>}
      </div>
    </div>
  )
}
