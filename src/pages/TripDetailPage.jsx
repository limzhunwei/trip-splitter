import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  getExpenses, getTripMembers, getExMembers,
  addTripMembersByName, inviteMemberByEmail,
  deactivateMember, reactivateMember, updateTrip, updateTripCurrency,
  getPendingInvites, cancelInvite, isOwner, linkGuestByEmail
} from '../lib/db'
import { fmtAmt, fmtDate, fmtDateShort } from '../lib/utils'
import { toBase, toSecondary, getBaseCurrency } from '../lib/currencies'
import {
  Plus, Users, CalendarDays, ReceiptText, Trash2,
  ChevronRight, BarChart3, UserMinus, UserPlus,
  Pencil, Mail, X, Link, Crown, Clock, UserCheck, Coins, ArrowLeftRight
} from 'lucide-react'
import { PageHeader, Modal, ConfirmDialog, Spinner, EmptyState, Avatar, Field } from '../components/ui'

export default function TripDetailPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()

  const [trip, setTrip] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [members, setMembers] = useState([])
  const [exMembers, setExMembers] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [amOwner, setAmOwner] = useState(false)
  const [loading, setLoading] = useState(true)

  // Modals
  const [membersOpen, setMembersOpen] = useState(false)
  const [editTripOpen, setEditTripOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [cancelInviteTarget, setCancelInviteTarget] = useState(null)

  // Add member tabs: 'name' | 'email'
  const [addTab, setAddTab] = useState('name')
  const [nameInput, setNameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [addError, setAddError] = useState('')
  const [inviteLink, setInviteLink] = useState(null) // show link after email invite

  // Edit trip
  const [editName, setEditName] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Currency modal
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false)
  const [editRate, setEditRate] = useState('')
  const [editRateDirection, setEditRateDirection] = useState('base_to_secondary')
  const [currencySaving, setCurrencySaving] = useState(false)

  // Link guest to account
  const [linkGuestTarget, setLinkGuestTarget] = useState(null)
  const [linkGuestEmail, setLinkGuestEmail] = useState('')
  const [linkGuestLink, setLinkGuestLink] = useState(null)
  const [linkGuestError, setLinkGuestError] = useState('')
  const [linkGuestLoading, setLinkGuestLoading] = useState(false)

  const load = useCallback(async () => {
    const [{ data: tripData }, exps, mems, exMems, owner, invites] = await Promise.all([
      supabase.from('Trips').select('*').eq('id', tripId).single(),
      getExpenses(tripId),
      getTripMembers(tripId, true),
      getExMembers(tripId),
      isOwner(tripId),
      getPendingInvites(tripId),
    ])
    setTrip(tripData)
    setExpenses(exps)
    setMembers(mems)
    setExMembers(exMems)
    setAmOwner(owner)
    setPendingInvites(invites)
    setLoading(false)
  }, [tripId])

  useEffect(() => { load() }, [load])

  const personMap = Object.fromEntries([...members, ...exMembers].map(m => [m.id, m]))
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  const hasSecondary = !!trip?.secondary_currency
  const baseCur = getBaseCurrency(trip)  // dynamic base currency
  const secSymbol = hasSecondary ? (trip.secondary_currency_symbol || trip.secondary_currency) : ''
  const totalInBase = hasSecondary
    ? expenses.reduce((s, e) => s + toBase(e.amount, e.currency || baseCur.code, trip), 0)
    : totalExpenses
  const totalInSecondary = hasSecondary
    ? expenses.reduce((s, e) => s + toSecondary(e.amount, e.currency || baseCur.code, trip), 0)
    : 0

  function openEditTrip() {
    setEditName(trip.name)
    setEditStart(trip.start_date?.slice(0, 10) || '')
    setEditEnd(trip.end_date?.slice(0, 10) || '')
    setEditTripOpen(true)
  }

  async function saveEditTrip() {
    if (editStart && editEnd && editEnd < editStart) return
    setEditSaving(true)
    await updateTrip(tripId, editName, editStart || null, editEnd || null)
    setEditTripOpen(false)
    setEditSaving(false)
    load()
  }

  async function handleAddByName() {
    const n = nameInput.trim()
    if (!n) return
    setAddingMember(true)
    setAddError('')
    try {
      await addTripMembersByName(tripId, [n])
      setNameInput('')
      load()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAddingMember(false)
    }
  }

  async function handleInviteByEmail() {
    const e = emailInput.trim()
    if (!e) return
    setAddingMember(true)
    setAddError('')
    setInviteLink(null)
    try {
      const result = await inviteMemberByEmail(tripId, e)
      setEmailInput('')
      setInviteLink(result)
      load()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAddingMember(false)
    }
  }

  async function handleRemoveMember() {
    await deactivateMember(tripId, removeTarget.id)
    setRemoveTarget(null)
    load()
  }

  async function handleCancelInvite() {
    await cancelInvite(cancelInviteTarget.id)
    setCancelInviteTarget(null)
    load()
  }

  async function saveCurrency() {
    if (!editRate || parseFloat(editRate) <= 0) return
    setCurrencySaving(true)
    await updateTripCurrency(tripId, {
      secondary_currency: trip.secondary_currency,
      secondary_currency_name: trip.secondary_currency_name,
      secondary_currency_symbol: trip.secondary_currency_symbol,
      secondary_currency_rate: parseFloat(editRate),
      rate_direction: editRateDirection,
    })
    setCurrencyModalOpen(false)
    setCurrencySaving(false)
    load()
  }

  function swapEditRate() {
    setEditRateDirection(d => d === 'base_to_secondary' ? 'secondary_to_base' : 'base_to_secondary')
    if (editRate) {
      const r = parseFloat(editRate)
      if (r > 0) setEditRate((1 / r).toFixed(6).replace(/\.?0+$/, ''))
    }
  }

  async function handleLinkGuest() {
    if (!linkGuestEmail.trim() || !linkGuestEmail.includes('@')) {
      setLinkGuestError('Enter a valid email'); return
    }
    setLinkGuestLoading(true)
    setLinkGuestError('')
    try {
      const result = await linkGuestByEmail(tripId, linkGuestTarget.id, linkGuestEmail)
      setLinkGuestLink(result)
    } catch (err) {
      setLinkGuestError(err.message)
    } finally {
      setLinkGuestLoading(false)
    }
  }

  function copyLink(link) {
    navigator.clipboard.writeText(link)
  }

  const dateRange = (() => {
    if (!trip) return ''
    const s = fmtDateShort(trip.start_date)
    const e = fmtDateShort(trip.end_date)
    return s && e ? `${s} → ${e}` : s || e || ''
  })()

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Spinner size={30} /></div>
  )

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="bg-brand-500 text-white shadow-lg shadow-brand-500/20">
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-7">
          <div className="flex items-start justify-between gap-3">
            <button onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-xl hover:bg-white/20 transition mt-0.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-2xl leading-tight">{trip?.name}</h1>
                {amOwner && <Crown size={16} className="text-amber-300 shrink-0" />}
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {dateRange && (
                  <button onClick={amOwner ? openEditTrip : undefined}
                    className={`flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-sm ${amOwner ? 'hover:bg-white/25 transition cursor-pointer' : 'cursor-default'}`}>
                    <CalendarDays size={13} /> {dateRange}
                  </button>
                )}
                <button onClick={() => { load(); setMembersOpen(true) }}
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition px-3 py-1 rounded-full text-sm">
                  <Users size={13} />
                  {members.length} members
                  {pendingInvites.length > 0 && (
                    <span className="bg-amber-400 text-amber-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {pendingInvites.length} pending
                    </span>
                  )}
                </button>
              </div>
            </div>

          </div>

          <div className="mt-5 bg-white/15 rounded-2xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white/80 text-sm">Total Expenses</span>
              {hasSecondary && (
                <button onClick={() => {
                  setEditRate(trip.secondary_currency_rate?.toString() || '')
                  setEditRateDirection(trip.rate_direction || 'base_to_secondary')
                  setCurrencyModalOpen(true)
                }} className="p-1 rounded-lg hover:bg-white/20 transition" title="Edit exchange rate">
                  <Coins size={14} className="text-white/70" />
                </button>
              )}
            </div>
            <div className="text-right">
              {hasSecondary ? (
                <>
                  <p className="font-display font-bold text-xl">{secSymbol} {fmtAmt(totalInSecondary)}</p>
                  <p className="text-white/60 text-xs">{baseCur.symbol} {fmtAmt(totalInBase)}</p>
                </>
              ) : (
                <span className="font-display font-bold text-xl">{baseCur.symbol} {fmtAmt(totalExpenses)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-1 space-y-4 pt-5">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate(`/trips/${tripId}/add-expense`, { state: { members, trip } })}
            className="btn-primary py-3">
            <Plus size={18} /> Add Expense
          </button>
          <button onClick={() => navigate(`/trips/${tripId}/summary`)}
            className="btn-secondary py-3">
            <BarChart3 size={18} /> Summary
          </button>
        </div>

        <div>
          <p className="section-title flex items-center gap-1.5 px-1">
            <ReceiptText size={12} /> Expenses ({expenses.length})
          </p>
          {expenses.length === 0 ? (
            <div className="card">
              <EmptyState icon={ReceiptText} title="No expenses yet" subtitle="Tap 'Add Expense' to record one" />
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map(exp => {
                const payer = exp.paid_by === 'MULTIPLE' ? null : personMap[exp.paid_by]
                return (
                  <div key={exp.id}
                    onClick={() => navigate(`/trips/${tripId}/expenses/${exp.id}`, { state: { members: [...members, ...exMembers], trip } })}
                    className="card p-4 flex items-center gap-3 cursor-pointer hover:shadow-md hover:border-brand-100 transition-all group">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                      <ReceiptText size={18} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate group-hover:text-brand-600 transition">{exp.title}</p>
                      <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
                        <CalendarDays size={11} />
                        {fmtDate(exp.date, 'MMM d, yyyy')}
                        {' · '}
                        {exp.paid_by === 'MULTIPLE' ? 'Multiple payers' : `Paid by ${payer?.name || '?'}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-brand-600">
                        {hasSecondary
                          ? `${exp.currency === trip.secondary_currency ? secSymbol : baseCur.symbol} ${fmtAmt(exp.amount)}`
                          : `${baseCur.symbol} ${fmtAmt(exp.amount)}`}
                      </p>
                      <ChevronRight size={15} className="text-slate-300 group-hover:text-brand-400 transition ml-auto mt-0.5" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Members Modal ── */}
      <Modal open={membersOpen} onClose={() => { setMembersOpen(false); setInviteLink(null); setAddError('') }}
        title="Trip Members" maxWidth="max-w-md">

        {/* Add member section — owner only */}
        {amOwner && (
          <div className="mb-5">
            {/* Tab toggle */}
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1 mb-3">
              <button onClick={() => { setAddTab('name'); setAddError(''); setInviteLink(null) }}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5
                  ${addTab === 'name' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <UserPlus size={14} /> By Name
              </button>
              <button onClick={() => { setAddTab('email'); setAddError(''); setInviteLink(null) }}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5
                  ${addTab === 'email' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Mail size={14} /> By Email
              </button>
            </div>

            {addTab === 'name' ? (
              <div className="flex gap-2">
                <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddByName()}
                  className="input flex-1 text-sm" placeholder="Member name (guest)" />
                <button onClick={handleAddByName} disabled={addingMember} className="btn-secondary text-sm py-2 px-3 shrink-0">
                  {addingMember ? <Spinner size={14} /> : 'Add'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input value={emailInput} onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleInviteByEmail()}
                    type="email" className="input flex-1 text-sm" placeholder="their@email.com" />
                  <button onClick={handleInviteByEmail} disabled={addingMember} className="btn-primary text-sm py-2 px-3 shrink-0">
                    {addingMember ? <Spinner size={14} /> : 'Invite'}
                  </button>
                </div>
                <p className="text-slate-400 text-xs">They'll need to sign up and use the invite link to join.</p>
              </div>
            )}

            {addError && <p className="text-red-500 text-xs mt-2">{addError}</p>}

            {/* Invite link result */}
            {inviteLink && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <p className="text-emerald-700 text-xs font-semibold">✓ Invite created for {inviteLink.invitedEmail}</p>
                <p className="text-slate-500 text-xs">Share this link with them via WhatsApp, Telegram, or email:</p>
                <div className="flex gap-2 items-center">
                  <code className="text-xs bg-white border border-emerald-200 rounded px-2 py-1 flex-1 truncate text-slate-600">
                    {inviteLink.inviteLink}
                  </code>
                  <button onClick={() => copyLink(inviteLink.inviteLink)}
                    className="btn-secondary text-xs py-1.5 px-2 shrink-0 gap-1">
                    <Link size={12} /> Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pending invites */}
        {amOwner && pendingInvites.length > 0 && (
          <div className="mb-4">
            <p className="section-title flex items-center gap-1.5"><Clock size={11} /> Pending Invites</p>
            <div className="space-y-2">
              {pendingInvites.map(inv => {
                const inviteLink = `${window.location.origin}/join?invite=${inv.id}`
                return (
                  <div key={inv.id} className="p-3 rounded-xl bg-amber-50 border border-amber-100 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                        <Mail size={14} className="text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{inv.invited_email}</p>
                        <p className="text-amber-600 text-xs">Awaiting acceptance</p>
                      </div>
                      <button onClick={() => setCancelInviteTarget(inv)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                    {/* Always-visible invite link */}
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-white border border-amber-200 rounded px-2 py-1 flex-1 truncate text-slate-500">
                        {inviteLink}
                      </code>
                      <button onClick={() => copyLink(inviteLink)}
                        className="btn-secondary text-xs py-1.5 px-2 shrink-0 gap-1">
                        <Link size={12} /> Copy
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Active members */}
        <div className="space-y-1.5 mb-3">
          <p className="section-title flex items-center gap-1.5"><UserCheck size={11} /> Members</p>
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50">
              <Avatar name={m.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-700 text-sm">{m.name}</p>
                {m.linked_user_id ? (
                  <p className="text-xs text-brand-400 flex items-center gap-1">
                    <UserCheck size={10} /> Has account
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">Guest</p>
                )}
              </div>
              {amOwner && !m.linked_user_id && (
                <button onClick={() => { setLinkGuestTarget(m); setLinkGuestEmail(''); setLinkGuestLink(null); setLinkGuestError('') }}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-brand-400 hover:bg-brand-50 transition"
                  title="Link to account">
                  <Mail size={15} />
                </button>
              )}
              {amOwner && (
                <button onClick={() => setRemoveTarget(m)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition">
                  <UserMinus size={15} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Ex-members */}
        {exMembers.length > 0 && (
          <>
            <p className="section-title border-t border-slate-100 pt-4">Removed Members</p>
            <div className="space-y-1.5">
              {exMembers.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  <Avatar name={m.name} size="sm" />
                  <span className="flex-1 font-medium text-slate-400 text-sm line-through">{m.name}</span>
                  {amOwner && (
                    <button onClick={() => reactivateMember(tripId, m.id).then(load)}
                      className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700 font-medium transition">
                      <UserPlus size={13} /> Add back
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* Edit Trip Modal */}
      <Modal open={editTripOpen} onClose={() => setEditTripOpen(false)} title="Edit Trip">
        <div className="space-y-4">
          <Field label="Trip Name">
            <input value={editName} onChange={e => setEditName(e.target.value)} className="input" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date">
              <input type="date" value={editStart}
                onChange={e => { setEditStart(e.target.value); if (editEnd && e.target.value > editEnd) setEditEnd('') }}
                className="input text-sm" />
            </Field>
            <Field label="End Date" error={editStart && editEnd && editEnd < editStart ? 'End date cannot be before start date' : ''}>
              <input type="date" value={editEnd} min={editStart || undefined}
                onChange={e => setEditEnd(e.target.value)} className="input text-sm" />
            </Field>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditTripOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={saveEditTrip} disabled={editSaving} className="btn-primary flex-1">
              {editSaving ? <Spinner size={16} /> : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Currency Edit Modal ── */}
      {hasSecondary && (
        <Modal open={currencyModalOpen} onClose={() => setCurrencyModalOpen(false)}
          title={`Edit ${trip?.secondary_currency_name || trip?.secondary_currency} Rate`} maxWidth="max-w-sm">
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-600">
              <p className="font-medium mb-1">{trip?.secondary_currency_name} ({trip?.secondary_currency_symbol})</p>
              <p className="text-slate-400 text-xs">Update the exchange rate if it has changed</p>
            </div>
            <div className="space-y-2">
              <label className="label">Exchange Rate</label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 shrink-0">
                  <span className="font-bold text-slate-600 text-sm">
                    {editRateDirection === 'base_to_secondary' ? baseCur.symbol : trip?.secondary_currency_symbol}
                  </span>
                  <span className="text-slate-500 text-xs font-medium">
                    {editRateDirection === 'base_to_secondary' ? baseCur.code : trip?.secondary_currency}
                  </span>
                </div>
                <span className="text-slate-400 text-sm font-medium shrink-0">1 =</span>
                <input type="number" step="any" min="0" value={editRate}
                  onChange={e => setEditRate(e.target.value)}
                  className="input flex-1 text-center font-semibold" placeholder="0.00" />
                <div className="flex items-center gap-1.5 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2.5 shrink-0">
                  <span className="font-bold text-brand-600 text-sm">
                    {editRateDirection === 'base_to_secondary' ? trip?.secondary_currency_symbol : baseCur.symbol}
                  </span>
                  <span className="text-brand-500 text-xs font-medium">
                    {editRateDirection === 'base_to_secondary' ? trip?.secondary_currency : baseCur.code}
                  </span>
                </div>
                <button type="button" onClick={swapEditRate}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-brand-100 text-slate-500 hover:text-brand-600 transition shrink-0">
                  <ArrowLeftRight size={15} />
                </button>
              </div>
              {editRate && parseFloat(editRate) > 0 && (
                <p className="text-emerald-600 text-xs font-medium text-center bg-emerald-50 border border-emerald-100 rounded-lg py-1.5">
                  ✓ {editRateDirection === 'base_to_secondary'
                    ? `${baseCur.symbol} 1 = ${trip?.secondary_currency_symbol} ${parseFloat(editRate).toFixed(4)}`
                    : `${trip?.secondary_currency_symbol} 1 = ${baseCur.symbol} ${parseFloat(editRate).toFixed(4)}`}
                </p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setCurrencyModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveCurrency} disabled={currencySaving || !editRate || parseFloat(editRate) <= 0}
                className="btn-primary flex-1">
                {currencySaving ? <Spinner size={16} /> : 'Save Rate'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Link Guest Modal ── */}
      <Modal open={!!linkGuestTarget} onClose={() => { setLinkGuestTarget(null); setLinkGuestLink(null) }}
        title={`Link "${linkGuestTarget?.name}" to Account`} maxWidth="max-w-sm">
        <div className="space-y-4">
          {!linkGuestLink ? (
            <>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700">
                <p className="font-medium mb-0.5">Linking guest to a real account</p>
                <p className="text-xs text-amber-600">All expenses recorded under <strong>{linkGuestTarget?.name}</strong> will automatically belong to this account once they accept.</p>
              </div>
              <Field label="Email address">
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" value={linkGuestEmail}
                    onChange={e => { setLinkGuestEmail(e.target.value); setLinkGuestError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleLinkGuest()}
                    className="input pl-9" placeholder="their@email.com" />
                </div>
              </Field>
              {linkGuestError && <p className="text-red-500 text-sm">{linkGuestError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setLinkGuestTarget(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleLinkGuest} disabled={linkGuestLoading} className="btn-primary flex-1">
                  {linkGuestLoading ? <Spinner size={16} /> : 'Send Invite'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-700">
                <p className="font-medium mb-1">✓ Invite created for {linkGuestLink.invitedEmail}</p>
                <p className="text-xs text-emerald-600">Share this link with them. Once they accept, all past expenses will be linked to their account.</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <code className="flex-1 text-xs text-slate-500 truncate">{linkGuestLink.inviteLink}</code>
                <button onClick={() => copyLink(linkGuestLink.inviteLink)}
                  className="btn-secondary text-xs py-1 px-2 shrink-0 gap-1">
                  <Link size={11} /> Copy
                </button>
              </div>
              <button onClick={() => { setLinkGuestTarget(null); setLinkGuestLink(null); load() }}
                className="btn-primary w-full">Done</button>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveMember}
        title="Remove Member"
        message={`Remove ${removeTarget?.name} from this trip? They'll still appear in existing expenses.`}
        confirmLabel="Remove"
        danger
      />

      <ConfirmDialog
        open={!!cancelInviteTarget}
        onClose={() => setCancelInviteTarget(null)}
        onConfirm={handleCancelInvite}
        title="Cancel Invite"
        message={`Cancel the invite sent to ${cancelInviteTarget?.invited_email}?`}
        confirmLabel="Cancel Invite"
        danger
      />
    </div>
  )
}
