import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTrip, addTripMembersByName, inviteMemberByEmail } from '../lib/db'
import { supabase } from '../lib/supabase'
import { CURRENCIES, MYR, getCurrency, getCurrencyForNationality } from '../lib/currencies'
import { PageHeader, Field, Spinner, Avatar } from '../components/ui'
import { UserPlus, X, CalendarDays, Tag, Mail, User, Crown, ArrowLeftRight, DollarSign, ChevronDown, Search } from 'lucide-react'

export default function CreateTripPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [members, setMembers] = useState([])
  const [memberInput, setMemberInput] = useState('')
  const [addMode, setAddMode] = useState('name')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [addError, setAddError] = useState('')

  // Currency
  const [baseCurrency, setBaseCurrency] = useState(MYR) // driven by user nationality
  const [useCurrency, setUseCurrency] = useState(false)
  const [selectedCurrency, setSelectedCurrency] = useState(null)
  const [rate, setRate] = useState('')
  const [rateDirection, setRateDirection] = useState('base_to_secondary')
  const [currencySearch, setCurrencySearch] = useState('')
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) return
      const { data: profile } = await supabase.from('Profiles').select('display_name, nationality').eq('user_id', user.id).maybeSingle()
      const n = profile?.display_name || user.user_metadata?.display_name || user.email.split('@')[0]
      setCreatorName(n)
      // Set base currency from user nationality
      const nat = profile?.nationality || user.user_metadata?.nationality
      if (nat) {
        const code = getCurrencyForNationality(nat)
        const match = getCurrency(code)
        if (match) setBaseCurrency(match)
      }
    })
  }, [])

  const filteredCurrencies = CURRENCIES.filter(c =>
    c.code !== baseCurrency.code && (
      c.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(currencySearch.toLowerCase())
    )
  )

  function swapRate() {
    setRateDirection(d => d === 'base_to_secondary' ? 'secondary_to_base' : 'base_to_secondary')
    if (rate) {
      const r = parseFloat(rate)
      if (r > 0) setRate((1 / r).toFixed(6).replace(/\.?0+$/, ''))
    }
  }

  function handleAddByName() {
    const n = memberInput.trim()
    if (!n) return
    if (members.find(m => m.value.toLowerCase() === n.toLowerCase() && m.type === 'name')) { setAddError('Already added'); return }
    setMembers(prev => [...prev, { type: 'name', value: n }])
    setMemberInput(''); setAddError('')
  }

  function handleAddByEmail() {
    const e = memberInput.trim().toLowerCase()
    if (!e || !e.includes('@')) { setAddError('Enter a valid email'); return }
    if (members.find(m => m.value.toLowerCase() === e)) { setAddError('Already added'); return }
    setMembers(prev => [...prev, { type: 'email', value: e }])
    setMemberInput(''); setAddError('')
  }

  function removeMember(index) { setMembers(prev => prev.filter((_, i) => i !== index)) }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!name.trim()) errs.name = 'Trip name is required'
    if (startDate && endDate && endDate < startDate) errs.endDate = 'End date cannot be before start date'
    if (useCurrency) {
      if (!selectedCurrency) errs.currency = 'Please select a currency'
      if (!rate || parseFloat(rate) <= 0) errs.rate = 'Please enter a valid exchange rate'
    }
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      const currencyOpts = {
        base_currency: baseCurrency.code,
        base_currency_name: baseCurrency.name,
        base_currency_symbol: baseCurrency.symbol,
        ...(useCurrency && selectedCurrency ? {
          secondary_currency: selectedCurrency.code,
          secondary_currency_name: selectedCurrency.name,
          secondary_currency_symbol: selectedCurrency.symbol,
          secondary_currency_rate: parseFloat(rate),
          rate_direction: rateDirection,
        } : {})
      }
      const trip = await createTrip(name.trim(), startDate || null, endDate || null, currencyOpts)
      const nameMembers = members.filter(m => m.type === 'name').map(m => m.value)
      if (nameMembers.length > 0) await addTripMembersByName(trip.id, nameMembers)
      for (const m of members.filter(m => m.type === 'email')) {
        try { await inviteMemberByEmail(trip.id, m.value) } catch (err) { console.warn(err.message) }
      }
      navigate(`/trips/${trip.id}`)
    } catch (err) {
      setErrors({ submit: err.message }); setSaving(false)
    }
  }

  const leftCurrency = rateDirection === 'base_to_secondary' ? baseCurrency : selectedCurrency
  const rightCurrency = rateDirection === 'base_to_secondary' ? selectedCurrency : baseCurrency
  const ratePreview = rate && selectedCurrency
    ? rateDirection === 'base_to_secondary'
      ? `${baseCurrency.symbol} 1 = ${selectedCurrency.symbol} ${parseFloat(rate).toFixed(4)}`
      : `${selectedCurrency.symbol} 1 = ${baseCurrency.symbol} ${parseFloat(rate).toFixed(4)}`
    : null

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <PageHeader title="New Trip" onBack={() => navigate('/')} />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Trip info */}
          <div className="card p-5 space-y-4">
            <p className="section-title flex items-center gap-1.5"><Tag size={12} /> Trip Details</p>
            <Field label="Trip Name" error={errors.name}>
              <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="e.g. Bangkok Trip 2025" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date">
                <div className="relative">
                  <CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate('') }} className="input pl-9 text-sm" />
                </div>
              </Field>
              <Field label="End Date" error={errors.endDate}>
                <div className="relative">
                  <CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} className="input pl-9 text-sm" />
                </div>
              </Field>
            </div>
          </div>

          {/* Currency */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="section-title mb-0 flex items-center gap-1.5"><DollarSign size={12} /> Trip Currency</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-slate-500">Add 2nd currency</span>
                <div onClick={() => { setUseCurrency(!useCurrency); setErrors({}) }}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${useCurrency ? 'bg-brand-500' : 'bg-slate-200'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useCurrency ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>

            {!useCurrency ? (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <span className="text-emerald-600 font-bold text-sm">{baseCurrency.symbol}</span>
                </div>
                <div>
                  <p className="font-medium text-slate-700 text-sm">{baseCurrency.name} ({baseCurrency.code})</p>
                  <p className="text-slate-400 text-xs">Toggle above to add a 2nd currency for this trip</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Field label="Foreign Currency" error={errors.currency}>
                  <div className="relative">
                    <button type="button" onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                      className="input w-full flex items-center justify-between text-left">
                      {selectedCurrency ? (
                        <span className="flex items-center gap-2">
                          <span className="font-bold text-brand-600 w-10 text-sm">{selectedCurrency.code}</span>
                          <span className="text-slate-600 text-sm">{selectedCurrency.name}</span>
                          <span className="text-slate-400 text-xs">({selectedCurrency.symbol})</span>
                        </span>
                      ) : <span className="text-slate-400 text-sm">Select currency...</span>}
                      <ChevronDown size={15} className="text-slate-400 shrink-0" />
                    </button>
                    {currencyDropdownOpen && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                        <div className="p-2 border-b border-slate-100">
                          <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input autoFocus value={currencySearch} onChange={e => setCurrencySearch(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-brand-400"
                              placeholder="Search currency..." />
                          </div>
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          {filteredCurrencies.map(c => (
                            <button key={c.code} type="button"
                              onClick={() => { setSelectedCurrency(c); setCurrencyDropdownOpen(false); setCurrencySearch('') }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition text-sm
                                ${selectedCurrency?.code === c.code ? 'bg-brand-50 text-brand-700' : 'text-slate-700'}`}>
                              <span className="font-bold w-10 text-xs text-slate-500">{c.code}</span>
                              <span className="flex-1">{c.name}</span>
                              <span className="text-slate-400 text-xs">{c.symbol}</span>
                            </button>
                          ))}
                          {filteredCurrencies.length === 0 && <p className="text-center text-slate-400 text-sm py-4">No currencies found</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </Field>

                {selectedCurrency && (
                  <Field label="Exchange Rate" error={errors.rate}>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 shrink-0">
                          <span className="font-bold text-slate-600 text-sm">{leftCurrency?.symbol}</span>
                          <span className="text-slate-500 text-xs font-medium">{leftCurrency?.code}</span>
                        </div>
                        <span className="text-slate-400 text-sm font-medium shrink-0">1 =</span>
                        <input type="number" step="any" min="0" value={rate} onChange={e => setRate(e.target.value)}
                          className="input flex-1 text-center font-semibold" placeholder="0.00" />
                        <div className="flex items-center gap-1.5 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2.5 shrink-0">
                          <span className="font-bold text-brand-600 text-sm">{rightCurrency?.symbol}</span>
                          <span className="text-brand-500 text-xs font-medium">{rightCurrency?.code}</span>
                        </div>
                        <button type="button" onClick={swapRate}
                          className="p-2.5 rounded-xl bg-slate-100 hover:bg-brand-100 text-slate-500 hover:text-brand-600 transition shrink-0" title="Swap direction">
                          <ArrowLeftRight size={15} />
                        </button>
                      </div>
                      {ratePreview && (
                        <p className="text-emerald-600 text-xs font-medium text-center bg-emerald-50 border border-emerald-100 rounded-lg py-1.5">
                          ✓ {ratePreview}
                        </p>
                      )}
                    </div>
                  </Field>
                )}

                {selectedCurrency && rate && parseFloat(rate) > 0 && (
                  <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 space-y-1">
                    <p className="text-brand-700 text-xs font-semibold">Currency setup summary:</p>
                    <p className="text-brand-600 text-xs">• Default currency: <strong>{selectedCurrency.name} ({selectedCurrency.symbol})</strong></p>
                    <p className="text-brand-600 text-xs">• Secondary currency: <strong>Malaysian Ringgit (RM)</strong></p>
                    <p className="text-brand-600 text-xs">• Expenses will show both {selectedCurrency.code} and MYR values</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Members */}
          <div className="card p-5 space-y-4">
            <p className="section-title flex items-center gap-1.5"><UserPlus size={12} /> Add Members (optional)</p>
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              <button type="button" onClick={() => { setAddMode('name'); setAddError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5
                  ${addMode === 'name' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <User size={14} /> Guest (name only)
              </button>
              <button type="button" onClick={() => { setAddMode('email'); setAddError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5
                  ${addMode === 'email' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Mail size={14} /> Invite by email
              </button>
            </div>
            <p className="text-slate-400 text-xs -mt-1">
              {addMode === 'name' ? "Add members who don't have an account — tracked by name only." : 'Invite members with an account — they can log in and add expenses.'}
            </p>
            <div className="flex gap-2">
              <input value={memberInput} onChange={e => setMemberInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMode === 'name' ? handleAddByName() : handleAddByEmail())}
                className="input flex-1" placeholder={addMode === 'name' ? 'Member name' : 'their@email.com'}
                type={addMode === 'email' ? 'email' : 'text'} />
              <button type="button" onClick={addMode === 'name' ? handleAddByName : handleAddByEmail} className="btn-secondary shrink-0">Add</button>
            </div>
            {addError && <p className="text-red-500 text-xs -mt-2">{addError}</p>}
            {creatorName && (
              <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 px-3 py-2 rounded-xl">
                <Avatar name={creatorName} size="sm" />
                <span className="text-sm font-medium text-brand-700 flex-1">{creatorName}</span>
                <span className="flex items-center gap-1 text-xs text-amber-600 font-medium"><Crown size={11} /> You (owner)</span>
              </div>
            )}
            {members.length > 0 && (
              <div className="space-y-2">
                {members.filter(m => m.type === 'name').length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1.5">Guests ({members.filter(m => m.type === 'name').length})</p>
                    <div className="flex flex-wrap gap-2">
                      {members.map((m, i) => m.type === 'name' && (
                        <div key={i} className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-full">
                          <User size={12} className="text-slate-400" />{m.value}
                          <button type="button" onClick={() => removeMember(i)} className="hover:text-red-500 transition ml-0.5"><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {members.filter(m => m.type === 'email').length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1.5">Email invites ({members.filter(m => m.type === 'email').length})</p>
                    <div className="space-y-1.5">
                      {members.map((m, i) => m.type === 'email' && (
                        <div key={i} className="flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-sm font-medium px-3 py-2 rounded-xl">
                          <Mail size={13} className="text-brand-400 shrink-0" />
                          <span className="flex-1 truncate">{m.value}</span>
                          <button type="button" onClick={() => removeMember(i)} className="hover:text-red-500 transition shrink-0"><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {errors.submit && <p className="text-red-500 text-sm text-center">{errors.submit}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full py-3.5 text-base">
            {saving ? <Spinner size={18} /> : 'Create Trip'}
          </button>
        </form>
      </div>
    </div>
  )
}
