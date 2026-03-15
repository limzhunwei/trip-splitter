import { supabase } from './supabase'
import { v4 as uuid } from 'uuid'

// ── Auth helpers ───────────────────────────────────────────────────────────

async function getCurrentUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}

async function getUserDisplayName(user) {
  const { data } = await supabase.from('Profiles')
    .select('display_name').eq('user_id', user.id).maybeSingle()
  if (data?.display_name) return data.display_name
  if (user.user_metadata?.display_name) return user.user_metadata.display_name
  return user.email.includes('@') ? user.email.split('@')[0] : user.email
}

// ── Trips ──────────────────────────────────────────────────────────────────

export async function getTrips() {
  const user = await getCurrentUser()

  // Trips I own
  const { data: ownedTrips, error: e1 } = await supabase
    .from('Trips').select('*').eq('owner_id', user.id)
  if (e1) throw e1

  // Trips I'm a member of (via linked_user_id on TripMembers)
  const { data: memberRows, error: e2 } = await supabase
    .from('TripMembers').select('trip_id')
    .eq('linked_user_id', user.id).eq('invite_status', 'accepted')
  if (e2) throw e2

  const ownedIds = new Set((ownedTrips || []).map(t => t.id))
  const sharedIds = (memberRows || []).map(r => r.trip_id).filter(id => !ownedIds.has(id))

  let sharedTrips = []
  if (sharedIds.length > 0) {
    const { data, error: e3 } = await supabase
      .from('Trips').select('*').in('id', sharedIds)
    if (e3) throw e3
    sharedTrips = data || []
  }

  const all = [...(ownedTrips || []), ...sharedTrips]
  all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return all
}

export async function createTrip(name, startDate, endDate, currencyOpts = {}) {
  const user = await getCurrentUser()
  const tripId = uuid()
  const trip = {
    id: tripId, name,
    start_date: startDate || null,
    end_date: endDate || null,
    created_at: new Date().toISOString(),
    owner_id: user.id,
    base_currency: currencyOpts.base_currency || 'MYR',
    base_currency_name: currencyOpts.base_currency_name || 'Malaysian Ringgit',
    base_currency_symbol: currencyOpts.base_currency_symbol || 'RM',
    secondary_currency: currencyOpts.secondary_currency || null,
    secondary_currency_rate: currencyOpts.secondary_currency_rate || null,
    secondary_currency_name: currencyOpts.secondary_currency_name || null,
    secondary_currency_symbol: currencyOpts.secondary_currency_symbol || null,
    rate_direction: currencyOpts.rate_direction || 'base_to_secondary',
  }
  const { error } = await supabase.from('Trips').insert(trip)
  if (error) throw error

  // Auto-add creator as first member
  const displayName = await getUserDisplayName(user)
  const person = await getOrCreatePerson(displayName, user.id)
  await supabase.from('TripMembers').insert({
    id: uuid(), trip_id: tripId, person_id: person.id,
    linked_user_id: user.id, is_active: 1,
    invite_status: 'accepted', invite_email: user.email,
  })

  return trip
}

export async function updateTrip(id, name, startDate, endDate, currencyOpts = {}) {
  const updates = {
    name,
    start_date: startDate || null,
    end_date: endDate || null,
  }
  // Only update currency fields if provided
  if ('secondary_currency' in currencyOpts) {
    updates.secondary_currency = currencyOpts.secondary_currency || null
    updates.secondary_currency_rate = currencyOpts.secondary_currency_rate || null
    updates.secondary_currency_name = currencyOpts.secondary_currency_name || null
    updates.secondary_currency_symbol = currencyOpts.secondary_currency_symbol || null
    updates.rate_direction = currencyOpts.rate_direction || 'base_to_secondary'
  }
  if ('base_currency' in currencyOpts) {
    updates.base_currency = currencyOpts.base_currency
    updates.base_currency_name = currencyOpts.base_currency_name
    updates.base_currency_symbol = currencyOpts.base_currency_symbol
  }
  const { error } = await supabase.from('Trips').update(updates).eq('id', id)
  if (error) throw error
}

export async function updateTripCurrency(id, currencyOpts) {
  const { error } = await supabase.from('Trips').update({
    base_currency: currencyOpts.base_currency || 'MYR',
    base_currency_name: currencyOpts.base_currency_name || 'Malaysian Ringgit',
    base_currency_symbol: currencyOpts.base_currency_symbol || 'RM',
    secondary_currency: currencyOpts.secondary_currency || null,
    secondary_currency_rate: currencyOpts.secondary_currency_rate || null,
    secondary_currency_name: currencyOpts.secondary_currency_name || null,
    secondary_currency_symbol: currencyOpts.secondary_currency_symbol || null,
    rate_direction: currencyOpts.rate_direction || 'base_to_secondary',
  }).eq('id', id)
  if (error) throw error
}

export async function deleteTrip(tripId) {
  const { error } = await supabase.from('Trips').delete().eq('id', tripId)
  if (error) throw error
}

export async function getTripOwner(tripId) {
  const { data } = await supabase.from('Trips').select('owner_id').eq('id', tripId).single()
  return data?.owner_id
}

export async function isOwner(tripId) {
  const user = await getCurrentUser()
  const ownerId = await getTripOwner(tripId)
  return user.id === ownerId
}

// ── Persons ────────────────────────────────────────────────────────────────

// Get or create a Person by name, optionally linking to a user account
export async function getOrCreatePerson(name, linkedUserId = null) {
  // If linking to a user, check if they already have a person record in any trip context
  if (linkedUserId) {
    const { data: existing } = await supabase.from('Persons')
      .select('*').eq('linked_user_id', linkedUserId).maybeSingle()
    if (existing) {
      // Update name if changed
      if (existing.name !== name) {
        await supabase.from('Persons').update({ name }).eq('id', existing.id)
        existing.name = name
      }
      return existing
    }
  }

  // For guest members, check by name (no user link)
  if (!linkedUserId) {
    // Just create a new person — guests can have duplicate names in different trips
    const person = { id: uuid(), name, linked_user_id: null }
    const { error } = await supabase.from('Persons').insert(person)
    if (error) throw error
    return person
  }

  // Create new linked person
  const person = { id: uuid(), name, linked_user_id: linkedUserId }
  const { error } = await supabase.from('Persons').insert(person)
  if (error) throw error
  return person
}

// ── TripMembers ────────────────────────────────────────────────────────────

export async function addTripMembersByName(tripId, names) {
  for (const name of names) {
    // Guest member — no linked user
    const person = await getOrCreatePerson(name, null)
    const { data: exists } = await supabase.from('TripMembers')
      .select('id').eq('trip_id', tripId).eq('person_id', person.id).maybeSingle()
    if (!exists) {
      await supabase.from('TripMembers').insert({
        id: uuid(), trip_id: tripId, person_id: person.id,
        linked_user_id: null, is_active: 1,
        invite_status: 'accepted', invite_email: null,
      })
    }
  }
}

export const addTripMembers = addTripMembersByName

export async function inviteMemberByEmail(tripId, email) {
  const user = await getCurrentUser()
  const trimmedEmail = email.trim().toLowerCase()

  // Check for existing invite
  const { data: existingInvite } = await supabase.from('TripInvites')
    .select('id, status').eq('trip_id', tripId).eq('invited_email', trimmedEmail).maybeSingle()
  if (existingInvite) {
    if (existingInvite.status === 'accepted') throw new Error('This person is already a member.')
    throw new Error('An invite has already been sent to this email.')
  }

  // Check if already a member via linked_user_id
  const { data: authUser } = await supabase.from('Profiles')
    .select('user_id').eq('user_id', user.id).maybeSingle()

  const inviteId = uuid()
  const { error } = await supabase.from('TripInvites').insert({
    id: inviteId, trip_id: tripId, invited_email: trimmedEmail,
    invited_by: user.id, status: 'pending',
  })
  if (error) throw error

  const { data: trip } = await supabase.from('Trips').select('name').eq('id', tripId).single()
  const inviteLink = `${window.location.origin}/join?invite=${inviteId}`

  return { inviteId, inviteLink, tripName: trip?.name, invitedEmail: trimmedEmail }
}

export async function linkGuestByEmail(tripId, personId, email) {
  const user = await getCurrentUser()
  const trimmedEmail = email.trim().toLowerCase()

  // Check no existing pending invite for this email in this trip
  const { data: existing } = await supabase.from('TripInvites')
    .select('id, status').eq('trip_id', tripId).eq('invited_email', trimmedEmail).maybeSingle()
  if (existing) {
    if (existing.status === 'accepted') throw new Error('This email is already a member.')
    throw new Error('An invite has already been sent to this email.')
  }

  const inviteId = uuid()
  const { error } = await supabase.from('TripInvites').insert({
    id: inviteId, trip_id: tripId, invited_email: trimmedEmail,
    invited_by: user.id, status: 'pending',
    guest_person_id: personId, // link to existing guest person
  })
  if (error) throw error

  const { data: trip } = await supabase.from('Trips').select('name').eq('id', tripId).single()
  const inviteLink = `${window.location.origin}/join?invite=${inviteId}`
  return { inviteId, inviteLink, tripName: trip?.name, invitedEmail: trimmedEmail }
}

export async function getPendingInvites(tripId) {
  const { data, error } = await supabase.from('TripInvites')
    .select('*').eq('trip_id', tripId).eq('status', 'pending')
  if (error) throw error
  return data || []
}

export async function cancelInvite(inviteId) {
  const { error } = await supabase.from('TripInvites').delete().eq('id', inviteId)
  if (error) throw error
}

export async function getMyPendingInvites() {
  const user = await getCurrentUser()
  const { data, error } = await supabase.from('TripInvites')
    .select('*, Trips(id, name, start_date, end_date)')
    .eq('invited_email', user.email.toLowerCase())
    .eq('status', 'pending')
  if (error) throw error
  return data || []
}

export async function acceptInvite(inviteId) {
  const user = await getCurrentUser()

  const { data: invite, error: invErr } = await supabase.from('TripInvites')
    .select('*').eq('id', inviteId).maybeSingle()
  if (invErr || !invite) throw new Error('Invite not found or already used.')
  if (invite.status !== 'pending') throw new Error('This invite has already been used.')
  if (invite.invited_email.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error(`This invite was sent to ${invite.invited_email}. Please sign in with that email.`)
  }

  const displayName = await getUserDisplayName(user)

  if (invite.guest_person_id) {
    // This invite is linking an existing guest — update the Person + TripMember row
    await supabase.from('Persons')
      .update({ name: displayName, linked_user_id: user.id })
      .eq('id', invite.guest_person_id)

    await supabase.from('TripMembers')
      .update({ linked_user_id: user.id, invite_status: 'accepted' })
      .eq('trip_id', invite.trip_id).eq('person_id', invite.guest_person_id)
  } else {
    // Normal invite — get or create a Person linked to this user
    const person = await getOrCreatePerson(displayName, user.id)

    // Check if already a TripMember
    const { data: existing } = await supabase.from('TripMembers')
      .select('id').eq('trip_id', invite.trip_id).eq('linked_user_id', user.id).maybeSingle()

    if (existing) {
      await supabase.from('TripMembers')
        .update({ is_active: 1, invite_status: 'accepted', person_id: person.id })
        .eq('id', existing.id)
    } else {
      const { error: mErr } = await supabase.from('TripMembers').insert({
        id: uuid(), trip_id: invite.trip_id, person_id: person.id,
        linked_user_id: user.id, is_active: 1,
        invite_status: 'accepted', invite_email: user.email,
      })
      if (mErr) throw mErr
    }
  }

  await supabase.from('TripInvites').update({ status: 'accepted' }).eq('id', inviteId)
  return invite.trip_id
}

export async function getTripMembers(tripId, activeOnly = true) {
  let query = supabase.from('TripMembers')
    .select('id, is_active, invite_status, linked_user_id, person_id, Persons(id, name)')
    .eq('trip_id', tripId)
  if (activeOnly) query = query.eq('is_active', 1)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(m => ({
    id: m.Persons?.id,
    name: m.Persons?.name,
    member_row_id: m.id,
    linked_user_id: m.linked_user_id,
    invite_status: m.invite_status,
  }))
}

export async function getExMembers(tripId) {
  const { data, error } = await supabase.from('TripMembers')
    .select('id, linked_user_id, Persons(id, name)')
    .eq('trip_id', tripId).eq('is_active', 0)
  if (error) throw error
  return (data || []).map(m => ({
    id: m.Persons?.id,
    name: m.Persons?.name,
    member_row_id: m.id,
    linked_user_id: m.linked_user_id,
  }))
}

export async function deactivateMember(tripId, personId) {
  const { error } = await supabase.from('TripMembers')
    .update({ is_active: 0 })
    .eq('trip_id', tripId).eq('person_id', personId)
  if (error) throw error
}

export async function reactivateMember(tripId, personId) {
  const { error } = await supabase.from('TripMembers')
    .update({ is_active: 1 })
    .eq('trip_id', tripId).eq('person_id', personId)
  if (error) throw error
}

// ── Expenses ───────────────────────────────────────────────────────────────

export async function getExpenses(tripId) {
  const { data, error } = await supabase.from('Expenses')
    .select('*').eq('trip_id', tripId).order('date', { ascending: false })
  if (error) throw error
  return data || []
}

export async function addExpense({ tripId, title, amount, paidBy, date, note, participants, isEqualSplit, payers = [], currency = 'MYR' }) {
  const expenseId = uuid()
  const { error: eErr } = await supabase.from('Expenses').insert({
    id: expenseId, trip_id: tripId, title, amount,
    paid_by: paidBy, date, note: note || null, currency,
  })
  if (eErr) throw eErr

  const effectivePayers = paidBy === 'MULTIPLE'
    ? payers : [{ personId: paidBy, amountPaid: amount }]

  await supabase.from('ExpensePayers').insert(
    effectivePayers.map(p => ({
      id: uuid(), expense_id: expenseId,
      person_id: p.personId, amount_paid: p.amountPaid,
    }))
  )

  const shareAmount = isEqualSplit ? amount / participants.length : null
  const participantRows = []
  const debtRows = []

  for (const p of participants) {
    const pShare = shareAmount ?? p.shareAmount
    participantRows.push({ id: uuid(), expense_id: expenseId, person_id: p.personId, share_amount: pShare })
    for (const payer of effectivePayers) {
      if (p.personId === payer.personId) continue
      const debtAmt = pShare * (payer.amountPaid / amount)
      if (debtAmt > 0.001) {
        debtRows.push({
          id: uuid(), trip_id: tripId, expense_id: expenseId,
          from_person: p.personId, to_person: payer.personId, amount: debtAmt,
        })
      }
    }
  }

  if (participantRows.length) await supabase.from('ExpenseParticipants').insert(participantRows)
  if (debtRows.length) await supabase.from('Debts').insert(debtRows)
  return expenseId
}

export async function updateExpense({ expenseId, tripId, title, amount, paidBy, date, note, participants, isEqualSplit, payers = [], currency = 'MYR' }) {
  await supabase.from('Debts').delete().eq('expense_id', expenseId)
  await supabase.from('ExpenseParticipants').delete().eq('expense_id', expenseId)
  await supabase.from('ExpensePayers').delete().eq('expense_id', expenseId)

  await supabase.from('Expenses')
    .update({ title, amount, paid_by: paidBy, date, note: note || null, currency })
    .eq('id', expenseId)

  const effectivePayers = paidBy === 'MULTIPLE'
    ? payers : [{ personId: paidBy, amountPaid: amount }]

  await supabase.from('ExpensePayers').insert(
    effectivePayers.map(p => ({
      id: uuid(), expense_id: expenseId,
      person_id: p.personId, amount_paid: p.amountPaid,
    }))
  )

  const shareAmount = isEqualSplit ? amount / participants.length : null
  const participantRows = []
  const debtRows = []

  for (const p of participants) {
    const pShare = shareAmount ?? p.shareAmount
    participantRows.push({ id: uuid(), expense_id: expenseId, person_id: p.personId, share_amount: pShare })
    for (const payer of effectivePayers) {
      if (p.personId === payer.personId) continue
      const debtAmt = pShare * (payer.amountPaid / amount)
      if (debtAmt > 0.001) {
        debtRows.push({
          id: uuid(), trip_id: tripId, expense_id: expenseId,
          from_person: p.personId, to_person: payer.personId, amount: debtAmt,
        })
      }
    }
  }

  if (participantRows.length) await supabase.from('ExpenseParticipants').insert(participantRows)
  if (debtRows.length) await supabase.from('Debts').insert(debtRows)
}

export async function deleteExpense(expenseId) {
  const { error } = await supabase.from('Expenses').delete().eq('id', expenseId)
  if (error) throw error
}

export async function getExpenseParticipants(expenseId) {
  const { data, error } = await supabase.from('ExpenseParticipants').select('*').eq('expense_id', expenseId)
  if (error) throw error
  return data || []
}

export async function getExpensePayers(expenseId) {
  const { data, error } = await supabase.from('ExpensePayers').select('*').eq('expense_id', expenseId)
  if (error) throw error
  return data || []
}

// ── Balances & Settlement ──────────────────────────────────────────────────

export async function getBalances(tripId) {
  const members = await getTripMembers(tripId, false)
  const balances = Object.fromEntries(members.map(m => [m.id, 0]))
  const { data: debts } = await supabase.from('Debts').select('*').eq('trip_id', tripId)
  for (const d of (debts || [])) {
    balances[d.to_person] = (balances[d.to_person] || 0) + d.amount
    balances[d.from_person] = (balances[d.from_person] || 0) - d.amount
  }
  return balances
}

export async function getSettlement(tripId) {
  const balances = await getBalances(tripId)
  const members = await getTripMembers(tripId, false)
  const nameMap = Object.fromEntries(members.map(m => [m.id, m.name]))
  const { data: settledData } = await supabase.from('SettledPayments').select('*').eq('trip_id', tripId)
  const settledSet = new Set((settledData || []).map(s => `${s.from_person}_${s.to_person}`))

  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0.001).map(([id, amount]) => ({ id, amount }))
    .sort((a, b) => b.amount - a.amount)
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < -0.001).map(([id, amount]) => ({ id, amount }))
    .sort((a, b) => a.amount - b.amount)

  const transactions = []
  while (creditors.length && debtors.length) {
    const creditor = creditors[0]
    const debtor = debtors[0]
    const payment = Math.min(creditor.amount, -debtor.amount)
    transactions.push({
      fromPersonId: debtor.id, fromPersonName: nameMap[debtor.id] || debtor.id,
      toPersonId: creditor.id, toPersonName: nameMap[creditor.id] || creditor.id,
      amount: payment, settled: settledSet.has(`${debtor.id}_${creditor.id}`),
    })
    creditor.amount -= payment
    debtor.amount += payment
    if (creditor.amount < 0.001) creditors.shift()
    if (debtor.amount > -0.001) debtors.shift()
  }
  return transactions.sort((a, b) => (a.settled ? 1 : -1))
}

export async function getSpending(tripId) {
  const members = await getTripMembers(tripId, false)
  const spending = Object.fromEntries(members.map(m => [m.id, 0]))
  const expenses = await getExpenses(tripId)
  for (const e of expenses) {
    const { data: parts } = await supabase.from('ExpenseParticipants').select('*').eq('expense_id', e.id)
    for (const p of (parts || [])) {
      spending[p.person_id] = (spending[p.person_id] || 0) + p.share_amount
    }
  }
  return spending
}

export async function markSettled(tripId, fromPerson, toPerson) {
  const { error } = await supabase.from('SettledPayments').insert({
    id: uuid(), trip_id: tripId, from_person: fromPerson, to_person: toPerson,
  })
  if (error) throw error
}

export async function unmarkSettled(tripId, fromPerson, toPerson) {
  const { error } = await supabase.from('SettledPayments').delete()
    .eq('trip_id', tripId).eq('from_person', fromPerson).eq('to_person', toPerson)
  if (error) throw error
}

// ── My Personal Spending ───────────────────────────────────────────────────

export async function getMySpending(tripId) {
  const user = await getCurrentUser()

  // Find this user's Person record in the trip
  const { data: memberRow } = await supabase.from('TripMembers')
    .select('person_id, Persons(id, name)')
    .eq('trip_id', tripId)
    .eq('linked_user_id', user.id)
    .maybeSingle()

  if (!memberRow) return { person: null, items: [], total: 0 }

  const personId = memberRow.person_id
  const personName = memberRow.Persons?.name

  // Get all expense participations for this person scoped to this trip only
  const { data: tripExpenses } = await supabase.from('Expenses')
    .select('id').eq('trip_id', tripId)
  const tripExpenseIds = (tripExpenses || []).map(e => e.id)

  if (tripExpenseIds.length === 0) return { person: { id: personId, name: personName }, items: [], total: 0 }

  const { data: parts, error } = await supabase.from('ExpenseParticipants')
    .select('share_amount, expense_id')
    .eq('person_id', personId)
    .in('expense_id', tripExpenseIds)
  if (error) throw error

  if (!parts || parts.length === 0) return { person: { id: personId, name: personName }, items: [], total: 0 }

  // Fetch expense details for each participation
  const expenseIds = parts.map(p => p.expense_id)
  const { data: expenses, error: eErr } = await supabase.from('Expenses')
    .select('id, title, amount, date, paid_by')
    .in('id', expenseIds)
    .order('date', { ascending: false })
  if (eErr) throw eErr

  const shareMap = Object.fromEntries(parts.map(p => [p.expense_id, p.share_amount]))

  const items = (expenses || []).map(e => ({
    expenseId: e.id,
    title: e.title,
    totalAmount: e.amount,
    myShare: shareMap[e.id] || 0,
    date: e.date,
    paidBy: e.paid_by,
  }))

  const total = items.reduce((s, i) => s + i.myShare, 0)

  return { person: { id: personId, name: personName }, items, total }
}
