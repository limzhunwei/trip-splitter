import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toSecondary, toBase, getBaseCurrency } from '../lib/currencies'
import { getTripMembers, getExMembers, getBalances, getSettlement, getMySpending, markSettled, unmarkSettled } from '../lib/db'
import { fmtAmt, fmtDate } from '../lib/utils'
import { PageHeader, Tabs, Spinner, ConfirmDialog, Avatar } from '../components/ui'
import { Wallet, ArrowLeftRight, ReceiptText, ArrowRight, CheckCircle2, Circle, CalendarDays, TrendingUp, Download } from 'lucide-react'
import { exportTripToExcel } from '../lib/exportExcel'

export default function TripSummaryPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('balances')
  const [loading, setLoading] = useState(true)
  const [spendingLoading, setSpendingLoading] = useState(false)

  const [members, setMembers] = useState([])
  const [balances, setBalances] = useState({})
  const [settlements, setSettlements] = useState([])
  const [mySpending, setMySpending] = useState({ person: null, items: [], total: 0 })

  const [trip, setTrip] = useState(null)
  const [settleTarget, setSettleTarget] = useState(null)
  const [exporting, setExporting] = useState(false)

  const TABS = [
    { id: 'balances', label: 'Balances', icon: Wallet },
    { id: 'settlement', label: 'Settlement', icon: ArrowLeftRight },
    { id: 'spending', label: 'My Spending', icon: ReceiptText },
  ]

  async function load() {
    setLoading(true)
    const [{ data: tripData }, active, ex] = await Promise.all([
      supabase.from('Trips').select('*').eq('id', tripId).single(),
      getTripMembers(tripId, true),
      getExMembers(tripId),
    ])
    setTrip(tripData)
    setMembers([...active, ...ex])
    const [bal, sett] = await Promise.all([getBalances(tripId), getSettlement(tripId)])
    setBalances(bal)
    setSettlements(sett)
    setLoading(false)
  }

  async function reloadSettlement() {
    const sett = await getSettlement(tripId)
    setSettlements(sett)
  }

  async function loadMySpending() {
    setSpendingLoading(true)
    const data = await getMySpending(tripId)
    setMySpending(data)
    setSpendingLoading(false)
  }

  useEffect(() => { load() }, [tripId])

  useEffect(() => {
    if (tab === 'settlement') reloadSettlement()
    if (tab === 'spending') loadMySpending()
  }, [tab])

  const nameMap = Object.fromEntries(members.map(m => [m.id, m.name]))
  const hasSecondary = !!trip?.secondary_currency
  const baseCur = getBaseCurrency(trip)
  const secSymbol = trip?.secondary_currency_symbol || trip?.secondary_currency || ''

  async function handleSettle() {
    const { tx, action } = settleTarget
    if (action === 'settle') await markSettled(tripId, tx.fromPersonId, tx.toPersonId)
    else await unmarkSettled(tripId, tx.fromPersonId, tx.toPersonId)
    setSettleTarget(null)
    reloadSettlement()
  }

  const unsettledCount = settlements.filter(s => !s.settled).length

  async function handleExport() {
    setExporting(true)
    try {
      await exportTripToExcel({ trip, members, balances, settlements })
    } catch (err) {
      alert('Export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <PageHeader title="Summary & Settlement" onBack={() => navigate(-1)}
        actions={
          <button onClick={handleExport} disabled={exporting || loading}
            className="flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-xl transition disabled:opacity-50">
            {exporting
              ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /><span>Exporting...</span></>
              : <><Download size={14} /><span>Export</span></>
            }
          </button>
        }
      />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size={28} /></div>
        ) : (
          <>
            {/* ── BALANCES TAB ── */}
            {tab === 'balances' && (
              <div className="space-y-3">
                <div className="card p-4 flex items-start gap-3 bg-brand-50 border-brand-100">
                  <Wallet size={16} className="text-brand-400 mt-0.5 shrink-0" />
                  <p className="text-brand-700 text-sm">
                    <span className="font-semibold">Positive</span> = should receive money &nbsp;·&nbsp;
                    <span className="font-semibold">Negative</span> = owes money
                  </p>
                </div>
                {Object.entries(balances)
                  .sort(([, a], [, b]) => b - a)
                  .map(([id, val]) => {
                    const positive = val >= 0
                    const secVal = hasSecondary ? toSecondary(val, baseCur.code, trip) : null
                    return (
                      <div key={id} className="card p-4 flex items-center gap-3">
                        <Avatar name={nameMap[id]} />
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800">{nameMap[id] || id}</p>
                          <p className={`text-xs font-medium ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                            {positive ? 'To receive' : 'Owes'}
                          </p>
                        </div>
                        <div className="text-right">
                          {secVal != null ? (
                            <>
                              <p className={`font-bold text-lg ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                                {positive ? '+' : ''}{secSymbol} {fmtAmt(Math.abs(secVal))}
                              </p>
                              <p className="text-slate-400 text-xs">{baseCur.symbol} {fmtAmt(Math.abs(val))}</p>
                            </>
                          ) : (
                            <p className={`font-bold text-lg ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                              {positive ? '+' : ''}RM {fmtAmt(val)}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}

            {/* ── SETTLEMENT TAB ── */}
            {tab === 'settlement' && (
              <div className="space-y-3">
                <div className={`card p-4 flex items-center gap-3 ${unsettledCount === 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                  {unsettledCount === 0
                    ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                    : <Circle size={18} className="text-amber-400 shrink-0" />}
                  <p className={`text-sm font-medium ${unsettledCount === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {unsettledCount === 0
                      ? 'All payments settled! 🎉'
                      : `${unsettledCount} payment${unsettledCount > 1 ? 's' : ''} remaining`}
                  </p>
                </div>

                {settlements.length === 0 && (
                  <div className="card p-10 text-center text-slate-400 text-sm">
                    No transactions needed — everyone is even!
                  </div>
                )}

                {settlements.map((tx, i) => (
                  <div key={i}
                    onClick={() => setSettleTarget({ tx, action: tx.settled ? 'unsettle' : 'settle' })}
                    className={`card p-4 cursor-pointer transition-all duration-150
                      ${tx.settled ? 'opacity-50 hover:opacity-70' : 'hover:shadow-md hover:border-brand-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium ${tx.settled ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {tx.settled ? '✓ Settled — tap to unsettle' : 'Tap to mark as settled'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold
                        ${tx.settled ? 'bg-slate-100 text-slate-400' : 'bg-red-50 text-red-600'}`}>
                        <Avatar name={tx.fromPersonName} size="sm" />
                        {tx.fromPersonName}
                      </div>
                      <ArrowRight size={16} className={tx.settled ? 'text-slate-300' : 'text-slate-400'} />
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold
                        ${tx.settled ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-700'}`}>
                        <Avatar name={tx.toPersonName} size="sm" />
                        {tx.toPersonName}
                      </div>
                      <div className="flex-1 text-right">
                        {hasSecondary ? (
                          <>
                            <p className={`font-bold text-lg ${tx.settled ? 'line-through text-slate-400' : 'text-brand-600'}`}>
                              {secSymbol} {fmtAmt(toSecondary(tx.amount, baseCur.code, trip))}
                            </p>
                            <p className="text-slate-400 text-xs">{baseCur.symbol} {fmtAmt(tx.amount)}</p>
                          </>
                        ) : (
                          <p className={`font-bold text-lg ${tx.settled ? 'line-through text-slate-400' : 'text-brand-600'}`}>
                            {baseCur.symbol} {fmtAmt(tx.amount)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── MY SPENDING TAB ── */}
            {tab === 'spending' && (
              <div className="space-y-3">
                {spendingLoading ? (
                  <div className="flex justify-center py-20"><Spinner size={28} /></div>
                ) : !mySpending.person ? (
                  <div className="card p-10 text-center">
                    <ReceiptText size={32} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">You don't have a member record in this trip yet.</p>
                  </div>
                ) : (
                  <>
                    {/* Summary card */}
                    <div className="card p-4 bg-brand-50 border-brand-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar name={mySpending.person.name} />
                          <div>
                            <p className="font-semibold text-slate-800">{mySpending.person.name}</p>
                            <p className="text-slate-400 text-xs">{mySpending.items.length} expense{mySpending.items.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400 mb-0.5">My total expenses</p>
                          {hasSecondary ? (
                            <>
                              <p className="font-display font-bold text-xl text-brand-600">{secSymbol} {fmtAmt(toSecondary(mySpending.total, baseCur.code, trip))}</p>
                              <p className="text-slate-400 text-xs">{baseCur.symbol} {fmtAmt(mySpending.total)}</p>
                            </>
                          ) : (
                            <p className="font-display font-bold text-xl text-brand-600">{baseCur.symbol} {fmtAmt(mySpending.total)}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* No expenses */}
                    {mySpending.items.length === 0 && (
                      <div className="card p-10 text-center">
                        <TrendingUp size={32} className="text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm">You haven't been included in any expenses yet.</p>
                      </div>
                    )}

                    {/* Expense list */}
                    {mySpending.items.map(item => {
                      const displayCurrency = item.currency || baseCur.code
                      const myrAmt = hasSecondary
                        ? (displayCurrency === baseCur.code ? item.myShare : toBase(item.myShare, displayCurrency, trip))
                        : item.myShare
                      const secAmt = hasSecondary ? toSecondary(myrAmt, baseCur.code, trip) : null
                      return (
                        <div key={item.expenseId} className="card p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{item.title}</p>
                              <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                                <CalendarDays size={11} />
                                {fmtDate(item.date, 'MMM d, yyyy')}
                              </p>
                              {item.note && (
                                <p className="text-slate-400 text-xs mt-1.5 whitespace-pre-wrap break-words leading-relaxed">
                                  {item.note}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              {hasSecondary ? (
                                <>
                                  <p className="font-bold text-brand-600">{secSymbol} {fmtAmt(secAmt)}</p>
                                  <p className="text-slate-400 text-xs">{baseCur.symbol} {fmtAmt(myrAmt)}</p>
                                </>
                              ) : (
                                <p className="font-bold text-brand-600">{baseCur.symbol} {fmtAmt(item.myShare)}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!settleTarget}
        onClose={() => setSettleTarget(null)}
        onConfirm={handleSettle}
        title={settleTarget?.action === 'settle' ? 'Confirm Settlement' : 'Mark as Unsettled'}
        message={
          settleTarget?.action === 'settle'
            ? `${settleTarget?.tx.fromPersonName} has paid ${settleTarget?.tx.toPersonName} ${hasSecondary ? `${secSymbol} ${fmtAmt(toSecondary(settleTarget?.tx.amount || 0, baseCur.code, trip))}` : `${baseCur.symbol} ${fmtAmt(settleTarget?.tx.amount || 0)}`}?`
            : `Mark payment from ${settleTarget?.tx.fromPersonName} to ${settleTarget?.tx.toPersonName} as unsettled?`
        }
        confirmLabel={settleTarget?.action === 'settle' ? 'Yes, Settled' : 'Yes, Unsettle'}
      />
    </div>
  )
}
