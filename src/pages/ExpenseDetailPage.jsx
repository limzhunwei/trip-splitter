import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getExpenseParticipants, getExpensePayers, deleteExpense } from '../lib/db'
import { fmtAmt, fmtDate } from '../lib/utils'
import { getCurrency } from '../lib/currencies'
import { PageHeader, Spinner, Avatar, ConfirmDialog, Badge } from '../components/ui'
import { CalendarDays, StickyNote, Pencil, Trash2, Users, CreditCard } from 'lucide-react'

export default function ExpenseDetailPage() {
  const { tripId, expenseId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const members = state?.members || []
  const trip = state?.trip || null

  const [expense, setExpense] = useState(null)
  const [participants, setParticipants] = useState([])
  const [payers, setPayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const personMap = Object.fromEntries(members.map(m => [m.id, m]))
  const expCurrency = expense?.currency || 'MYR'
  const hasSecondary = !!trip?.secondary_currency
  const currSymbol = expCurrency === 'MYR' ? 'RM' : (trip?.secondary_currency_symbol || expCurrency)

  useEffect(() => {
    async function load() {
      const [{ data: exp }, parts, pays] = await Promise.all([
        supabase.from('Expenses').select('*').eq('id', expenseId).single(),
        getExpenseParticipants(expenseId),
        getExpensePayers(expenseId),
      ])
      setExpense(exp)
      setParticipants(parts)
      setPayers(pays)
      setLoading(false)
    }
    load()
  }, [expenseId])

  async function handleDelete() {
    await deleteExpense(expenseId)
    navigate(-1)
  }

  const payerIds = new Set(payers.map(p => p.person_id))
  const isMultiple = expense?.paid_by === 'MULTIPLE'

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Spinner size={28} />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <PageHeader
        title={expense?.title || 'Expense'}
        onBack={() => navigate(-1)}
        actions={
          <div className="flex gap-1">
            <button
              onClick={() => navigate(`/trips/${tripId}/expenses/${expenseId}/edit`, {
                state: { members, expense, trip }
              })}
              className="p-2 rounded-xl hover:bg-white/20 transition">
              <Pencil size={18} />
            </button>
            <button onClick={() => setDeleteOpen(true)}
              className="p-2 rounded-xl hover:bg-red-500/30 transition">
              <Trash2 size={18} />
            </button>
          </div>
        }
      />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Amount card */}
        <div className="card p-5">
          <p className="text-slate-400 text-sm mb-1">Total Amount</p>
          <p className="font-display font-bold text-3xl text-brand-600">
            {currSymbol} {fmtAmt(expense?.amount || 0)}
          </p>

          <div className="border-t border-slate-100 mt-4 pt-4 space-y-3">
            {/* Date */}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays size={15} className="text-slate-300" />
              <span>{fmtDate(expense?.date, 'MMMM d, yyyy')}</span>
            </div>

            {/* Paid by */}
            {!isMultiple ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <CreditCard size={15} className="text-slate-300" />
                <span>Paid by</span>
                <div className="flex items-center gap-1.5 ml-1">
                  <Avatar name={personMap[expense?.paid_by]?.name} size="sm" />
                  <span className="font-medium text-slate-700">{personMap[expense?.paid_by]?.name || 'Unknown'}</span>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                  <CreditCard size={15} className="text-slate-300" />
                  <span>Paid by multiple</span>
                </div>
                <div className="flex flex-wrap gap-2 ml-6">
                  {payers.map(p => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                      <Avatar name={personMap[p.person_id]?.name} size="sm" />
                      <span className="text-xs font-medium text-emerald-700">
                        {personMap[p.person_id]?.name} · {currSymbol} {fmtAmt(p.amount_paid)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            {expense?.note && (
              <div className="flex items-start gap-2 text-sm text-slate-500">
                <StickyNote size={15} className="text-slate-300 mt-0.5 shrink-0" />
                <span className="whitespace-pre-wrap break-words">{expense.note}</span>
              </div>
            )}
          </div>
        </div>

        {/* Participants */}
        <div>
          <p className="section-title px-1 flex items-center gap-1.5">
            <Users size={12} /> Participants ({participants.length})
          </p>
          <div className="space-y-2">
            {participants.map(p => {
              const person = personMap[p.person_id]
              const isPayer = isMultiple ? payerIds.has(p.person_id) : p.person_id === expense?.paid_by
              return (
                <div key={p.id} className="card p-4 flex items-center gap-3">
                  <Avatar name={person?.name} size="md" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 text-sm">{person?.name || 'Unknown'}</p>
                    {isPayer && <Badge color="green">Payer</Badge>}
                  </div>
                  <p className="font-bold text-slate-800">{currSymbol} {fmtAmt(p.share_amount)}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Expense"
        message={`Delete "${expense?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
