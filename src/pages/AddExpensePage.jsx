import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { addExpense, updateExpense, getExpenseParticipants, getExpensePayers } from '../lib/db'
import { fmtAmt } from '../lib/utils'
import { toBase, toSecondary, getBaseCurrency } from '../lib/currencies'
import { PageHeader, Field, Spinner, Avatar, DateInput } from '../components/ui'
import { ReceiptText, Users, SplitSquareHorizontal, ArrowLeftRight } from 'lucide-react'

export default function AddExpensePage({ editMode = false }) {
  const { tripId, expenseId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const members = state?.members || []
  const existingExpense = state?.expense || null
  const trip = state?.trip || null

  const hasSecondary = !!trip?.secondary_currency
  const baseCur = getBaseCurrency(trip)
  const secCode = trip?.secondary_currency || baseCur.code
  const secSymbol = trip?.secondary_currency_symbol || secCode

  // Resolve starting currency: last used for this trip → else secondary → else MYR
  function getInitialCurrency() {
    if (!hasSecondary) return baseCur.code
    try {
      const last = localStorage.getItem(`trip_last_currency_${tripId}`)
      if (last === baseCur.code || last === secCode) return last
    } catch {}
    return secCode // first time: default to secondary (foreign) currency
  }

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(() => getInitialCurrency()) // which currency user is entering
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [splitType, setSplitType] = useState('equal')
  const [selectedParticipants, setSelectedParticipants] = useState(members.map(m => m.id))
  const [customShares, setCustomShares] = useState({})
  const [multiPayer, setMultiPayer] = useState(false)
  const [singlePayer, setSinglePayer] = useState(members[0]?.id || '')
  const [payerAmounts, setPayerAmounts] = useState({})
  const [selectedPayers, setSelectedPayers] = useState({})
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (editMode && existingExpense) {
      setTitle(existingExpense.title)
      setAmount(String(existingExpense.amount))
      setCurrency(existingExpense.currency || defaultCurrency)
      setDate(existingExpense.date?.slice(0, 10) || '')
      setNote(existingExpense.note || '')
      loadExistingData()
    }
  }, [editMode, existingExpense])

  async function loadExistingData() {
    const [parts, payers] = await Promise.all([
      getExpenseParticipants(expenseId),
      getExpensePayers(expenseId),
    ])
    const participantIds = parts.map(p => p.person_id)
    setSelectedParticipants(participantIds)
    const totalAmt = existingExpense.amount
    const equalShare = totalAmt / participantIds.length
    const isEqual = parts.every(p => Math.abs(p.share_amount - equalShare) < 0.01)
    setSplitType(isEqual ? 'equal' : 'custom')
    if (!isEqual) {
      const shares = {}
      parts.forEach(p => { shares[p.person_id] = p.share_amount })
      setCustomShares(shares)
    }
    if (existingExpense.paid_by === 'MULTIPLE') {
      setMultiPayer(true)
      const selPayers = {}; const payAmt = {}
      payers.forEach(p => { selPayers[p.person_id] = true; payAmt[p.person_id] = p.amount_paid })
      setSelectedPayers(selPayers); setPayerAmounts(payAmt)
    } else {
      setMultiPayer(false); setSinglePayer(existingExpense.paid_by)
    }
  }

  const amountNum = parseFloat(amount) || 0
  const payerTotal = Object.entries(selectedPayers)
    .filter(([, sel]) => sel)
    .reduce((s, [id]) => s + (parseFloat(payerAmounts[id]) || 0), 0)
  const customTotal = selectedParticipants.reduce((s, id) => s + (parseFloat(customShares[id]) || 0), 0)

  // Conversion preview
  const conversionPreview = (() => {
    if (!hasSecondary || !amountNum) return null
    if (currency === secCode) {
      const base = toBase(amountNum, secCode, trip)
      return `≈ ${baseCur.symbol} ${fmtAmt(base)}`
    } else {
      const sec = toSecondary(amountNum, baseCur.code, trip)
      return `≈ ${secSymbol} ${fmtAmt(sec)}`
    }
  })()

  function toggleParticipant(id) {
    setSelectedParticipants(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function switchCurrency() {
    const newCurrency = currency === baseCur.code ? secCode : baseCur.code
    try { localStorage.setItem(`trip_last_currency_${tripId}`, newCurrency) } catch {}
    // Convert current amount to new currency
    if (amountNum > 0) {
      let converted
      if (currency === baseCur.code) {
        converted = toSecondary(amountNum, baseCur.code, trip)
      } else {
        converted = toBase(amountNum, secCode, trip)
      }
      setAmount(converted.toFixed(2))
    }
    setCurrency(newCurrency)
  }

  function validate() {
    const errs = {}
    if (!title.trim()) errs.title = 'Required'
    if (!date) errs.date = 'Date is required'
    if (!amount || amountNum <= 0) errs.amount = 'Enter a valid amount'
    if (selectedParticipants.length === 0) errs.participants = 'Select at least one participant'
    if (multiPayer) {
      const selPayerIds = Object.keys(selectedPayers).filter(id => selectedPayers[id])
      if (selPayerIds.length === 0) errs.payer = 'Select at least one payer'
      else if (Math.abs(payerTotal - amountNum) > 0.01)
        errs.payer = `Payer amounts (${fmtAmt(payerTotal)}) must equal expense amount (${fmtAmt(amountNum)})`
    }
    if (splitType === 'custom' && Math.abs(customTotal - amountNum) > 0.01)
      errs.split = `Split amounts (${fmtAmt(customTotal)}) must equal expense amount (${fmtAmt(amountNum)})`
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const paidBy = multiPayer ? 'MULTIPLE' : singlePayer
      const payers = multiPayer
        ? Object.keys(selectedPayers).filter(id => selectedPayers[id])
            .map(id => ({ personId: id, amountPaid: parseFloat(payerAmounts[id]) || 0 }))
        : []
      const participants = selectedParticipants.map(id => ({
        personId: id,
        shareAmount: splitType === 'custom' ? (parseFloat(customShares[id]) || 0) : null,
      }))
      const args = {
        tripId, title: title.trim(), amount: amountNum,
        paidBy, date, note: note.trim() || null,
        participants, isEqualSplit: splitType === 'equal', payers, currency,
      }
      if (editMode) {
        await updateExpense({ ...args, expenseId })
      } else {
        await addExpense(args)
      }
      navigate(-1)
    } catch (err) {
      setErrors({ submit: err.message }); setSaving(false)
    }
  }

  const currSymbol = currency === baseCur.code ? baseCur.symbol : secSymbol

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <PageHeader title={editMode ? 'Edit Expense' : 'Add Expense'} onBack={() => navigate(-1)} />
      <div className="max-w-2xl mx-auto px-4 py-5">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Basic info */}
          <div className="card p-5 space-y-4">
            <p className="section-title flex items-center gap-1.5"><ReceiptText size={12} /> Details</p>
            <Field label="Title" error={errors.title}>
              <input value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="e.g. Dinner at restaurant" />
            </Field>

            {/* Amount with currency switcher */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Amount</label>
                {hasSecondary && (
                  <button type="button" onClick={switchCurrency}
                    className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700 font-medium transition">
                    <ArrowLeftRight size={11} />
                    Switch to {currency === baseCur.code ? `${secCode} (${secSymbol})` : `${baseCur.code} (${baseCur.symbol})`}
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <span className="font-bold text-slate-500 text-sm">{currSymbol}</span>
                  {hasSecondary && (
                    <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-medium">{currency}</span>
                  )}
                </div>
                <input type="text" inputMode="decimal" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="input pl-16 text-right font-semibold" placeholder="0.00" />
              </div>
              {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
              {conversionPreview && (
                <p className="text-slate-400 text-xs mt-1.5 text-right font-medium">{conversionPreview}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" error={errors.date}>
                <DateInput value={date} onChange={setDate} />
              </Field>
              <Field label="Note (optional)">
                <textarea value={note} onChange={e => setNote(e.target.value)}
                  className="input resize-none leading-tight" placeholder="Any notes..."
                  rows={2} style={{ minHeight: 0 }} />
              </Field>
            </div>
          </div>

          {/* Paid by */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="section-title mb-0 flex items-center gap-1.5"><Users size={12} /> Paid By</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-slate-500">Multiple payers</span>
                <div onClick={() => setMultiPayer(!multiPayer)}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${multiPayer ? 'bg-brand-500' : 'bg-slate-200'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${multiPayer ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>

            {!multiPayer ? (
              <div className="flex flex-wrap gap-2">
                {members.map(m => (
                  <button key={m.id} type="button" onClick={() => setSinglePayer(m.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition border
                      ${singlePayer === m.id ? 'bg-brand-500 text-white border-brand-500' : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-brand-300'}`}>
                    <Avatar name={m.name} size="sm" />{m.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border transition
                    ${selectedPayers[m.id] ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-slate-50'}`}>
                    <input type="checkbox" checked={!!selectedPayers[m.id]}
                      onChange={e => setSelectedPayers(prev => ({ ...prev, [m.id]: e.target.checked }))}
                      className="accent-brand-500 w-4 h-4" />
                    <Avatar name={m.name} size="sm" />
                    <span className="flex-1 text-sm font-medium text-slate-700">{m.name}</span>
                    {selectedPayers[m.id] && (
                      <input type="text" inputMode="decimal"
                        value={payerAmounts[m.id] || ''}
                        onChange={e => setPayerAmounts(prev => ({ ...prev, [m.id]: e.target.value }))}
                        placeholder="Amount"
                        className="w-28 input text-sm py-1.5 text-right" />
                    )}
                  </div>
                ))}
                {amountNum > 0 && (
                  <div className={`text-xs text-right font-medium px-1 ${Math.abs(payerTotal - amountNum) < 0.01 ? 'text-emerald-600' : 'text-red-500'}`}>
                    Total: {currSymbol} {fmtAmt(payerTotal)} / {fmtAmt(amountNum)}
                  </div>
                )}
                {errors.payer && <p className="text-red-500 text-xs">{errors.payer}</p>}
              </div>
            )}
          </div>

          {/* Split */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="section-title mb-0 flex items-center gap-1.5"><SplitSquareHorizontal size={12} /> Split Among</p>
              <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                {['equal', 'custom'].map(t => (
                  <button key={t} type="button" onClick={() => setSplitType(t)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition ${splitType === t ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {t === 'equal' ? 'Equal' : 'Custom'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border transition
                  ${selectedParticipants.includes(m.id) ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-slate-50'}`}>
                  <input type="checkbox" checked={selectedParticipants.includes(m.id)}
                    onChange={() => toggleParticipant(m.id)} className="accent-brand-500 w-4 h-4" />
                  <Avatar name={m.name} size="sm" />
                  <span className="flex-1 text-sm font-medium text-slate-700">{m.name}</span>
                  {splitType === 'equal' && selectedParticipants.includes(m.id) && amountNum > 0 && (
                    <span className="text-xs text-brand-600 font-medium">
                      {currSymbol} {fmtAmt(amountNum / selectedParticipants.length)}
                    </span>
                  )}
                  {splitType === 'custom' && selectedParticipants.includes(m.id) && (
                    <input type="text" inputMode="decimal"
                      value={customShares[m.id] || ''}
                      onChange={e => setCustomShares(prev => ({ ...prev, [m.id]: e.target.value }))}
                      placeholder="Share"
                      className="w-28 input text-sm py-1.5 text-right" />
                  )}
                </div>
              ))}
            </div>

            {splitType === 'custom' && amountNum > 0 && (
              <div className={`text-xs text-right font-medium px-1 ${Math.abs(customTotal - amountNum) < 0.01 ? 'text-emerald-600' : 'text-red-500'}`}>
                Total: {currSymbol} {fmtAmt(customTotal)} / {fmtAmt(amountNum)}
              </div>
            )}
            {errors.participants && <p className="text-red-500 text-xs">{errors.participants}</p>}
            {errors.split && <p className="text-red-500 text-xs">{errors.split}</p>}
          </div>

          {errors.submit && <p className="text-red-500 text-sm text-center">{errors.submit}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full py-3.5 text-base">
            {saving ? <Spinner size={18} /> : (editMode ? 'Save Changes' : 'Add Expense')}
          </button>
        </form>
      </div>
    </div>
  )
}
