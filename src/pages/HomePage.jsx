import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTrips, deleteTrip, getMyPendingInvites, acceptInvite } from '../lib/db'
import { fmtDate } from '../lib/utils'
import { Plane, Plus, Trash2, LogOut, ChevronRight, ChevronsDown, CalendarDays, Bell, Check, Crown, User, Pencil, X, Mail, Pin, PinOff, ArrowUpDown, ArrowDownAZ, CalendarRange, Globe } from 'lucide-react'
import { NATIONALITIES } from '../lib/currencies'
import { Spinner, ConfirmDialog, EmptyState, Avatar, Modal, Field } from '../components/ui'

// Sort options
const SORT_OPTIONS = [
  { id: 'nearest',  label: 'Nearest date',  icon: CalendarRange },
  { id: 'farthest', label: 'Farthest date', icon: CalendarRange },
  { id: 'name',     label: 'Name (A–Z)',    icon: ArrowDownAZ },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [trips, setTrips] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [acceptingId, setAcceptingId] = useState(null)

  // User info
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('')

  // Profile modal
  const [profileOpen, setProfileOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nationality, setNationality] = useState('')
  const [editNationality, setEditNationality] = useState('')

  // Pins & sort — persisted in localStorage per user
  const [pinnedIds, setPinnedIds] = useState(new Set())
  const [sortBy, setSortBy] = useState('nearest')
  const [sortOpen, setSortOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(10)
  const sentinelRef = useRef(null)

  // Reset visible count when sort or pins change
  useEffect(() => { setVisibleCount(10) }, [sortBy, pinnedIds, trips])

  useEffect(() => {
    if (!userId) return
    try {
      const raw = localStorage.getItem(`trip_pins_${userId}`)
      if (raw) setPinnedIds(new Set(JSON.parse(raw)))
      const savedSort = localStorage.getItem(`trip_sort_${userId}`)
      if (savedSort) setSortBy(savedSort)
    } catch {}
  }, [userId])

  function savePins(newSet) {
    setPinnedIds(newSet)
    if (userId) localStorage.setItem(`trip_pins_${userId}`, JSON.stringify([...newSet]))
  }

  function togglePin(e, tripId) {
    e.stopPropagation()
    const next = new Set(pinnedIds)
    if (next.has(tripId)) next.delete(tripId)
    else next.add(tripId)
    savePins(next)
  }

  function changeSort(id) {
    setSortBy(id)
    setSortOpen(false)
    if (userId) localStorage.setItem(`trip_sort_${userId}`, id)
  }

  // Sorted + pinned trips
  const sortedTrips = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const isPast = t => t.end_date && new Date(t.end_date) < today

    const pinned   = trips.filter(t => pinnedIds.has(t.id))
    const unpinned = trips.filter(t => !pinnedIds.has(t.id))

    function applySort(arr) {
      const active = arr.filter(t => !isPast(t))
      const past   = arr.filter(t => isPast(t))

      const noDates = active.filter(t => !t.start_date && !t.end_date)
      const dated   = active.filter(t => t.start_date || t.end_date)

      // Always sort by start_date (fall back to end_date if no start)
      const getDate = t => new Date(t.start_date || t.end_date)

      let sortedActive, sortedPast
      if (sortBy === 'name') {
        sortedActive = [...noDates.sort((a, b) => a.name.localeCompare(b.name)),
                        ...dated.sort((a, b) => a.name.localeCompare(b.name))]
        sortedPast   = [...past].sort((a, b) => a.name.localeCompare(b.name))
      } else if (sortBy === 'nearest') {
        // Nearest = earliest start date first (ascending)
        sortedActive = [...noDates, ...dated.sort((a, b) => getDate(a) - getDate(b))]
        sortedPast   = [...past].sort((a, b) => getDate(a) - getDate(b))
      } else if (sortBy === 'farthest') {
        // Farthest = latest start date first (descending)
        sortedActive = [...noDates, ...dated.sort((a, b) => getDate(b) - getDate(a))]
        sortedPast   = [...past].sort((a, b) => getDate(b) - getDate(a))
      } else {
        sortedActive = active
        sortedPast   = past
      }
      return { active: sortedActive, past: sortedPast }
    }

    const pr = applySort(pinned)
    const ur = applySort(unpinned)

    return {
      pinnedActive:   pr.active,
      pinnedPast:     pr.past,
      unpinnedActive: ur.active,
      unpinnedPast:   ur.past,
      all: [...pr.active, ...ur.active, ...pr.past, ...ur.past],
    }
  }, [trips, pinnedIds, sortBy])

  // IntersectionObserver — auto load when sentinel scrolled into view on mobile
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || visibleCount >= (sortedTrips.all?.length ?? 0)) return
    // Small delay so observer doesn't fire on initial render
    const timer = setTimeout(() => {
      const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) setVisibleCount(n => n + 10)
      }, { threshold: 0, rootMargin: '0px 0px 100px 0px' })
      observer.observe(el)
      return () => observer.disconnect()
    }, 300)
    return () => clearTimeout(timer)
  }, [visibleCount, sortedTrips.all?.length])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) return
      setUserEmail(user.email || '')
      setUserId(user.id || '')
      const { data: profile } = await supabase.from('Profiles').select('display_name, nationality').eq('user_id', user.id).maybeSingle()
      if (profile?.nationality) setNationality(profile.nationality)
      const name = profile?.display_name
        || user.user_metadata?.display_name
        || (user.email?.includes('@') ? user.email.split('@')[0] : user.email)
      setDisplayName(name)
    })
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const t = await getTrips().catch(err => { console.error('getTrips error:', err); return [] })
      setTrips(t)
      const invites = await getMyPendingInvites().catch(err => { console.error('invites error:', err); return [] })
      setPendingInvites(invites)
    } finally {
      setLoading(false)
    }
  }

  function openProfile() {
    setEditName(displayName)
    setEditNationality(nationality)
    setSaveSuccess(false)
    setSaveError('')
    setEditingName(false)
    setProfileOpen(true)
  }

  async function saveProfile() {
    const trimmed = editName.trim()
    if (!trimmed) { setSaveError('Name cannot be empty'); return }
    setSavingName(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      const { error } = await supabase.from('Profiles')
        .upsert({ user_id: userId, display_name: trimmed, nationality: editNationality }, { onConflict: 'user_id' })
      if (error) throw error
      await supabase.auth.updateUser({ data: { display_name: trimmed, nationality: editNationality } })
      await supabase.from('Persons').update({ name: trimmed }).eq('linked_user_id', userId)
      setDisplayName(trimmed)
      setNationality(editNationality)
      setSaveSuccess(true)
      setEditingName(false)
    } catch (err) {
      setSaveError(err.message || 'Failed to save')
    } finally {
      setSavingName(false)
    }
  }

  async function handleAcceptInvite(invite) {
    setAcceptingId(invite.id)
    try {
      const tripId = await acceptInvite(invite.id)
      await load()
      navigate(`/trips/${tripId}`)
    } catch (err) {
      alert(err.message)
    } finally {
      setAcceptingId(null)
    }
  }

  async function handleDelete() {
    await deleteTrip(deleteTarget.id)
    setDeleteTarget(null)
    load()
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const currentSortLabel = SORT_OPTIONS.find(o => o.id === sortBy)?.label || 'Sort'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-brand-500 text-white shadow-lg shadow-brand-500/20">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Plane size={18} className="text-white" />
            </div>
            <span className="font-display font-bold text-lg">Trip Splitter</span>
          </div>
          <div className="flex items-center gap-2">
            {displayName && (
              <button onClick={openProfile}
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 transition px-3 py-1.5 rounded-xl">
                <Avatar name={displayName} size="xs" />
                <span className="text-white text-sm font-medium hidden sm:block max-w-[120px] truncate">
                  {displayName}
                </span>
              </button>
            )}
            {pendingInvites.length > 0 && (
              <div className="relative">
                <Bell size={18} className="text-white" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                  {pendingInvites.length}
                </span>
              </div>
            )}
            <button onClick={signOut}
              className="p-2 rounded-xl hover:bg-white/20 transition text-white/80 hover:text-white"
              title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="space-y-2">
            <p className="section-title flex items-center gap-1.5">
              <Bell size={12} /> Trip Invitations
            </p>
            {pendingInvites.map(invite => (
              <div key={invite.id} className="card p-4 border-brand-200 bg-brand-50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{invite.Trips?.name}</p>
                    <p className="text-slate-400 text-xs mt-0.5">You've been invited to join this trip</p>
                    {invite.Trips?.start_date && (
                      <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                        <CalendarDays size={10} />
                        {fmtDate(invite.Trips.start_date, 'MMM d')}
                        {invite.Trips.end_date && ` → ${fmtDate(invite.Trips.end_date, 'MMM d, yyyy')}`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAcceptInvite(invite)}
                    disabled={acceptingId === invite.id}
                    className="btn-primary text-sm py-2 px-4 shrink-0">
                    {acceptingId === invite.id ? <Spinner size={16} /> : <><Check size={15} /> Join Trip</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Trips */}
        <div>
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display font-bold text-xl text-slate-800">My Trips</h2>
              <p className="text-slate-400 text-sm">
                {trips.length} trip{trips.length !== 1 ? 's' : ''}
                {pinnedIds.size > 0 && ` · ${pinnedIds.size} pinned`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Sort dropdown */}
              {trips.length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => setSortOpen(!sortOpen)}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-600 bg-white border border-slate-200 hover:border-brand-300 px-2.5 py-2 rounded-xl transition">
                    <ArrowUpDown size={13} />
                    <span className="hidden sm:inline">{currentSortLabel}</span>
                  </button>
                  {sortOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden w-44">
                        {SORT_OPTIONS.map(opt => (
                          <button key={opt.id} onClick={() => changeSort(opt.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition
                              ${sortBy === opt.id ? 'bg-brand-50 text-brand-600 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                            <opt.icon size={13} className={sortBy === opt.id ? 'text-brand-500' : 'text-slate-400'} />
                            {opt.label}
                            {sortBy === opt.id && <span className="ml-auto text-brand-400">✓</span>}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              <button onClick={() => navigate('/create-trip')} className="btn-primary text-sm py-2.5">
                <Plus size={17} /> New Trip
              </button>
            </div>
          </div>

          {/* Pinned section label */}
          {pinnedIds.size > 0 && !loading && (
            <p className="text-xs font-semibold text-amber-500 flex items-center gap-1 px-1 mb-2">
              <Pin size={11} /> Pinned
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-20"><Spinner size={28} /></div>
          ) : trips.length === 0 ? (
            <div className="card">
              <EmptyState icon={Plane} title="No trips yet" subtitle="Create your first trip to start splitting expenses" />
            </div>
          ) : (
            (() => {
              const { pinnedActive = [], unpinnedActive = [], pinnedPast = [], unpinnedPast = [], all = [] } = sortedTrips
              const allPast = [...pinnedPast, ...unpinnedPast]
              const today = new Date(); today.setHours(0,0,0,0)
              const visibleAll = all.slice(0, visibleCount)

              function TripCard({ trip }) {
                const isPinned = pinnedIds.has(trip.id)
                const isPast = trip.end_date && new Date(trip.end_date) < today
                const start = fmtDate(trip.start_date, 'MMM d')
                const end = fmtDate(trip.end_date, 'MMM d, yyyy')
                const dateRange = start && end ? `${start} → ${end}` : start || end || null
                const isOwned = trip.owner_id === userId
                if (!visibleAll.includes(trip)) return null
                return (
                  <div
                    onClick={() => navigate(`/trips/${trip.id}`)}
                    className={`card p-4 flex items-center gap-4 cursor-pointer transition-all duration-150 group
                      ${isPast
                        ? 'opacity-50 hover:opacity-75 bg-slate-50 border-slate-200 hover:border-slate-300'
                        : isPinned
                          ? 'border-amber-200 hover:border-amber-300 bg-amber-50/30 hover:shadow-md'
                          : 'hover:border-brand-200 hover:shadow-md'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0
                      ${isPast ? 'bg-slate-100' : isPinned ? 'bg-amber-100' : 'bg-brand-50'}`}>
                      <Plane size={22} className={isPast ? 'text-slate-400' : isPinned ? 'text-amber-500' : 'text-brand-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`font-semibold truncate transition ${isPast ? 'text-slate-400' : 'text-slate-800 group-hover:text-brand-600'}`}>{trip.name}</p>
                        {isOwned && !isPast && <Crown size={13} className="text-amber-400 shrink-0" />}
                        {isPinned && !isPast && <Pin size={11} className="text-amber-400 shrink-0" />}
                        {isPast && <span className="text-xs font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0">Past</span>}
                      </div>
                      {dateRange && (
                        <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                          <CalendarDays size={11} /> {dateRange}
                        </p>
                      )}
                      {!isOwned && !isPast && <p className="text-brand-400 text-xs mt-0.5">Shared with you</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {!isPast && (
                        <button onClick={e => togglePin(e, trip.id)} title={isPinned ? 'Unpin' : 'Pin to top'}
                          className={`p-2 rounded-lg transition
                            ${isPinned ? 'text-amber-400 hover:text-amber-600 hover:bg-amber-100'
                                       : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50 opacity-0 group-hover:opacity-100'}`}>
                          {isPinned ? <PinOff size={15} /> : <Pin size={15} />}
                        </button>
                      )}
                      {isOwned && (
                        <button onClick={e => { e.stopPropagation(); setDeleteTarget(trip) }}
                          className="p-2 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition opacity-0 group-hover:opacity-100">
                          <Trash2 size={15} />
                        </button>
                      )}
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-brand-400 transition" />
                    </div>
                  </div>
                )
              }

              return (
                <div className="space-y-3">
                  {pinnedActive.map(t => <TripCard key={t.id} trip={t} />)}
                  {pinnedActive.length > 0 && unpinnedActive.length > 0 &&
                    visibleAll.some(t => unpinnedActive.includes(t)) && (
                    <p className="text-xs font-semibold text-slate-400 px-1 pt-1">All Trips</p>
                  )}
                  {unpinnedActive.map(t => <TripCard key={t.id} trip={t} />)}
                  {allPast.length > 0 && visibleAll.some(t => allPast.includes(t)) && (
                    <div className="flex items-center gap-2 pt-2">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs font-semibold text-slate-400 px-1">Past Trips</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                  )}
                  {allPast.map(t => <TripCard key={t.id} trip={t} />)}
                  {visibleCount < all.length ? (
                    <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-4">
                      <button onClick={() => setVisibleCount(n => n + 10)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-brand-300 hover:text-brand-600 text-slate-500 text-sm font-medium transition shadow-sm">
                        <ChevronsDown size={15} />
                        Load more
                      </button>
                      <p className="text-slate-300 text-xs">{all.length - visibleCount} more trip{all.length - visibleCount !== 1 ? 's' : ''}</p>
                    </div>
                  ) : (
                    <div ref={sentinelRef} />
                  )}
                </div>
              )
            })()
          )}
        </div>
      </div>

      {/* ── Profile Modal ── */}
      <Modal open={profileOpen} onClose={() => { setProfileOpen(false); setEditingName(false) }} title="My Profile" maxWidth="max-w-sm">
        {/* Avatar + name header */}
        <div className="flex flex-col items-center mb-5">
          <Avatar name={displayName} size="lg" />
          <p className="font-display font-bold text-lg text-slate-800 mt-3">{displayName}</p>
          <p className="text-slate-400 text-sm">{userEmail}</p>
        </div>

        {/* View mode */}
        {!editingName ? (
          <div className="space-y-3">
            {/* Read-only info rows */}
            <div className="bg-slate-50 rounded-xl divide-y divide-slate-100">
              <div className="flex items-center gap-3 px-4 py-3">
                <User size={15} className="text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400">Display Name</p>
                  <p className="text-sm font-medium text-slate-700 truncate">{displayName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <Mail size={15} className="text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400">Email</p>
                  <p className="text-sm font-medium text-slate-700 truncate">{userEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <Globe size={15} className="text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400">Nationality</p>
                  <p className="text-sm font-medium text-slate-700">{nationality || <span className="text-slate-400 italic">Not set</span>}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => { setEditingName(true); setEditName(displayName); setEditNationality(nationality); setSaveSuccess(false); setSaveError('') }}
              className="btn-secondary w-full">
              <Pencil size={14} /> Edit Profile
            </button>
            <button onClick={() => setProfileOpen(false)} className="btn-secondary w-full">
              Close
            </button>
          </div>
        ) : (
          /* Edit mode */
          <div className="space-y-4">
            <Field label="Display Name">
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={editName}
                  onChange={e => { setEditName(e.target.value); setSaveSuccess(false); setSaveError('') }}
                  className="input pl-10"
                  placeholder="Your display name"
                  autoFocus
                />
              </div>
            </Field>

            <Field label="Nationality">
              <div className="relative">
                <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select value={editNationality} onChange={e => { setEditNationality(e.target.value); setSaveSuccess(false) }}
                  className="input pl-10 appearance-none">
                  <option value="">Select your country...</option>
                  {NATIONALITIES.map(n => (
                    <option key={n.country} value={n.country}>{n.country}</option>
                  ))}
                </select>
              </div>
              <p className="text-slate-400 text-xs mt-1">Sets your default currency for new trips</p>
            </Field>

            {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
            {saveSuccess && <p className="text-emerald-600 text-sm font-medium">✓ Profile updated</p>}

            <button onClick={saveProfile}
              disabled={savingName || !editName.trim() || (editName.trim() === displayName && editNationality === nationality)}
              className="btn-primary w-full">
              {savingName ? <Spinner size={16} /> : <><Pencil size={14} /> Save Changes</>}
            </button>

            <button onClick={() => { setEditingName(false); setSaveError('') }} className="btn-secondary w-full">
              Cancel
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Trip"
        message={`Delete "${deleteTarget?.name}"? All expenses will be permanently removed.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
