import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { getBaseCurrency, getCurrency } from './currencies'
import { fmtAmt } from './utils'

// Round to 2 decimal places — safe for Excel numeric cells (no locale comma issue)
const round2 = v => Math.round((v || 0) * 100) / 100

async function getAllPayers(expenseIds) {
  if (!expenseIds.length) return {}
  const { data } = await supabase.from('ExpensePayers').select('*').in('expense_id', expenseIds)
  const map = {}
  for (const row of data || []) {
    if (!map[row.expense_id]) map[row.expense_id] = []
    map[row.expense_id].push(row)
  }
  return map
}

async function getAllParticipants(expenseIds) {
  if (!expenseIds.length) return {}
  const { data } = await supabase.from('ExpenseParticipants').select('*').in('expense_id', expenseIds)
  const map = {}
  for (const row of data || []) {
    if (!map[row.expense_id]) map[row.expense_id] = []
    map[row.expense_id].push(row)
  }
  return map
}

// Convert amount to base currency — explicit and safe
function toBaseAmt(amount, currency, trip, baseCur) {
  // Already in base — return as-is, no conversion
  if (!currency || currency === baseCur.code) return amount
  // Not the secondary currency either — return as-is (shouldn't happen)
  if (currency !== trip?.secondary_currency) return amount
  // It's the secondary currency — convert to base
  return toBase(amount, currency, trip)
}

export async function exportTripToExcel({ trip, members, balances, settlements }) {
  const baseCur = getBaseCurrency(trip)
  const hasSecondary = !!trip.secondary_currency
  const secCur = hasSecondary ? getCurrency(trip.secondary_currency) : null
  const nameMap = Object.fromEntries(members.map(m => [m.id, m.name]))

  // Normalise rate_direction — old trips may still have old naming
  const rateDir = (() => {
    const d = trip.rate_direction || ''
    if (d === 'foreign_to_MYR' || d === 'secondary_to_base') return 'secondary_to_base'
    return 'base_to_secondary' // MYR_to_foreign or base_to_secondary
  })()

  // Safe conversion: secondary → base
  function secToBase(amount) {
    const rate = trip.secondary_currency_rate || 1
    return rateDir === 'secondary_to_base' ? amount * rate : amount / rate
  }

  // Convert any expense amount to base currency — completely explicit
  function expToBase(amount, currency) {
    if (!hasSecondary) return amount               // single currency trip
    if (!currency || currency === baseCur.code) return amount  // already base
    if (currency === trip.secondary_currency) return secToBase(amount) // secondary → base
    return amount                                   // unknown currency, return as-is
  }

  // ── Fetch expenses ────────────────────────────────────────────────
  const { data: expenses } = await supabase
    .from('Expenses').select('*').eq('trip_id', trip.id).order('date', { ascending: true })
  const expIds = (expenses || []).map(e => e.id)
  const [payersMap, partsMap] = await Promise.all([
    getAllPayers(expIds),
    getAllParticipants(expIds),
  ])

  // Does this trip have expenses in more than one currency?
  const hasMultiCurrency = (expenses || []).some(e => (e.currency || baseCur.code) !== baseCur.code)

  // ── Sheet 1: Expenses ─────────────────────────────────────────────
  // Simple columns: No. | Date | Title | Amount | [Amount(base) if multi-currency] | Paid By | Note
  // Then one column per member showing their share in base currency
  const expenseRows = (expenses || []).map((exp, i) => {
    const payers = payersMap[exp.id] || []
    const parts  = partsMap[exp.id]  || []
    const currency = exp.currency || baseCur.code
    const curObj = getCurrency(currency)
    // If already base currency, use amount directly — never convert
    const baseAmt = expToBase(exp.amount, currency)

    // Paid by string
    const paidByStr = exp.paid_by === 'MULTIPLE'
      ? payers.map(p => {
          const paidBase = expToBase(p.amount_paid, currency)
          return `${nameMap[p.person_id] || '?'} (${baseCur.symbol}${fmtAmt(paidBase)})`
        }).join(', ')
      : nameMap[exp.paid_by] || exp.paid_by || '?'

    const row = {}
    row['No.']   = i + 1
    row['Date']  = exp.date || ''
    row['Title'] = exp.title

    // Amount in original currency — clear and unambiguous
    row['Amount'] = `${curObj.symbol} ${fmtAmt(exp.amount)}`

    // Only add base currency column if trip uses 2 currencies
    if (hasMultiCurrency) {
      row[`≈ ${baseCur.code}`] = round2(baseAmt)
    }

    row['Paid By'] = paidByStr

    // Each member's share in base currency
    members.forEach(m => {
      const part = parts.find(p => p.person_id === m.id)
      if (part?.share_amount != null) {
        const shareBase = expToBase(part.share_amount, currency)
        row[`${m.name} (${baseCur.code})`] = round2(shareBase)
      } else {
        row[`${m.name} (${baseCur.code})`] = '-'
      }
    })

    row['Note'] = exp.note || ''
    return row
  })

  // Convert base amount to secondary — self-contained, same rate logic
  function baseToSec(amount) {
    const rate = trip.secondary_currency_rate || 1
    return rateDir === 'secondary_to_base' ? amount / rate : amount * rate
  }

  // ── Sheet 2: Balances ──────────────────────────────────────────────
  const balanceRows = Object.entries(balances)
    .sort(([, a], [, b]) => b - a)
    .map(([id, val]) => {
      const row = {
        'Name':   nameMap[id] || id,
        'Status': val >= 0 ? 'To Receive' : 'Owes',
        [`${baseCur.code}`]: round2(Math.abs(val)),
      }
      if (hasSecondary) {
        row[`${secCur.code}`] = round2(Math.abs(baseToSec(val)))
      }
      return row
    })

  // ── Sheet 3: Settlement ────────────────────────────────────────────
  const settlementRows = settlements.map(tx => {
    const row = {
      'From':   tx.fromPersonName,
      'To':     tx.toPersonName,
      [`${baseCur.code}`]: round2(tx.amount),
      'Status': tx.settled ? 'Settled' : 'Pending',
    }
    if (hasSecondary) {
      row[`${secCur.code}`] = round2(baseToSec(tx.amount))
    }
    return row
  })

  // ── Sheet 4: Trip Info ─────────────────────────────────────────────
  const totalBase = (expenses || []).reduce((s, e) => {
    return s + expToBase(e.amount, e.currency || baseCur.code)
  }, 0)

  const rateDesc = hasSecondary
    ? trip.rate_direction === 'secondary_to_base'
      ? `${secCur.symbol} 1 = ${baseCur.symbol} ${trip.secondary_currency_rate}`
      : `${baseCur.symbol} 1 = ${secCur.symbol} ${trip.secondary_currency_rate}`
    : '-'

  const infoRows = [
    { 'Field': 'Trip Name',       'Value': trip.name },
    { 'Field': 'Date',            'Value': [trip.start_date, trip.end_date].filter(Boolean).join(' → ') || 'No date set' },
    { 'Field': 'Members',         'Value': members.map(m => m.name).join(', ') },
    { 'Field': 'Total Expenses',  'Value': `${baseCur.symbol} ${fmtAmt(totalBase)}` },
    { 'Field': 'No. of Expenses', 'Value': (expenses || []).length },
    { 'Field': 'Base Currency',   'Value': `${baseCur.name} (${baseCur.code})` },
    ...(hasSecondary ? [
      { 'Field': '2nd Currency',  'Value': `${secCur.name} (${secCur.code})` },
      { 'Field': 'Exchange Rate', 'Value': rateDesc },
    ] : []),
    { 'Field': 'Exported On',     'Value': new Date().toLocaleDateString() },
  ]

  // ── Build workbook ──────────────────────────────────────────────
  function makeSheet(rows) {
    if (!rows.length) {
      const ws = XLSX.utils.aoa_to_sheet([['No data']])
      ws['!cols'] = [{ wch: 20 }]
      return ws
    }
    const ws = XLSX.utils.json_to_sheet(rows)
    const cols = Object.keys(rows[0]).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2
    }))
    ws['!cols'] = cols
    return ws
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, makeSheet(expenseRows),    'Expenses')
  XLSX.utils.book_append_sheet(wb, makeSheet(balanceRows),    'Balances')
  XLSX.utils.book_append_sheet(wb, makeSheet(settlementRows), 'Settlement')
  XLSX.utils.book_append_sheet(wb, makeSheet(infoRows),       'Trip Info')

  const safeName = trip.name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim()
  const dateStr  = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${safeName}_expenses_${dateStr}.xlsx`)
}
