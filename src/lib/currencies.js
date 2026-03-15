// All supported currencies — base is now dynamic per user nationality
export const CURRENCIES = [
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'BND', name: 'Brunei Dollar', symbol: 'B$' },
  { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K' },
  { code: 'KHR', name: 'Cambodian Riel', symbol: '៛' },
  { code: 'LAK', name: 'Lao Kip', symbol: '₭' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: '₨' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: '₨' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: '£' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
]

// MYR kept for backward compat — prefer getCurrency('MYR')
export const MYR = { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' }

export function getCurrency(code) {
  return CURRENCIES.find(c => c.code === code) || { code, name: code, symbol: code }
}

// Get the base currency object for a trip (defaults to MYR for old trips)
export function getBaseCurrency(trip) {
  const code = trip?.base_currency || 'MYR'
  return getCurrency(code)
}

// Convert amount to base currency
// rate_direction: 'base_to_secondary' (1 base = rate secondary)
//                'secondary_to_base' (1 secondary = rate base)
// For backward compat, old values 'MYR_to_foreign' / 'foreign_to_MYR' are treated the same
export function toBase(amount, currency, trip) {
  const baseCode = trip?.base_currency || 'MYR'
  if (!trip?.secondary_currency || currency === baseCode) return amount
  const rate = trip.secondary_currency_rate || 1
  const dir = trip.rate_direction || 'base_to_secondary'
  // secondary_to_base OR foreign_to_MYR: 1 secondary = rate base
  if (dir === 'secondary_to_base' || dir === 'foreign_to_MYR') {
    return amount * rate
  } else {
    // base_to_secondary OR MYR_to_foreign: 1 base = rate secondary → secondary / rate = base
    return amount / rate
  }
}

// Backward compat alias
export const toMYR = toBase

// Convert amount to secondary currency
export function toSecondary(amount, currency, trip) {
  const baseCode = trip?.base_currency || 'MYR'
  if (!trip?.secondary_currency) return amount
  if (currency !== baseCode) return amount // already in secondary
  const rate = trip.secondary_currency_rate || 1
  const dir = trip.rate_direction || 'base_to_secondary'
  if (dir === 'secondary_to_base' || dir === 'foreign_to_MYR') {
    // 1 secondary = rate base → 1 base = 1/rate secondary
    return amount / rate
  } else {
    // 1 base = rate secondary
    return amount * rate
  }
}

// Get display symbol for a currency code
export function symbol(code) {
  return getCurrency(code)?.symbol || code
}

// Format with symbol
export function fmtCurrency(amount, code) {
  const s = symbol(code)
  return `${s} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`
}

// ── Nationality → Currency mapping ───────────────────────────────────────
export const NATIONALITIES = [
  { country: 'Malaysia',     currency: 'MYR' },
  { country: 'Singapore',    currency: 'SGD' },
  { country: 'Thailand',     currency: 'THB' },
  { country: 'Indonesia',    currency: 'IDR' },
  { country: 'Philippines',  currency: 'PHP' },
  { country: 'Vietnam',      currency: 'VND' },
  { country: 'Myanmar',      currency: 'MMK' },
  { country: 'Cambodia',     currency: 'KHR' },
  { country: 'Laos',         currency: 'LAK' },
  { country: 'Brunei',       currency: 'BND' },
  { country: 'Japan',        currency: 'JPY' },
  { country: 'South Korea',  currency: 'KRW' },
  { country: 'China',        currency: 'CNY' },
  { country: 'Hong Kong',    currency: 'HKD' },
  { country: 'Taiwan',       currency: 'TWD' },
  { country: 'India',        currency: 'INR' },
  { country: 'Bangladesh',   currency: 'BDT' },
  { country: 'Pakistan',     currency: 'PKR' },
  { country: 'Sri Lanka',    currency: 'LKR' },
  { country: 'Nepal',        currency: 'NPR' },
  { country: 'UAE',          currency: 'AED' },
  { country: 'Saudi Arabia', currency: 'SAR' },
  { country: 'Australia',    currency: 'AUD' },
  { country: 'New Zealand',  currency: 'NZD' },
  { country: 'USA',          currency: 'USD' },
  { country: 'Canada',       currency: 'CAD' },
  { country: 'UK',           currency: 'GBP' },
  { country: 'Germany',      currency: 'EUR' },
  { country: 'France',       currency: 'EUR' },
  { country: 'Italy',        currency: 'EUR' },
  { country: 'Spain',        currency: 'EUR' },
  { country: 'Netherlands',  currency: 'EUR' },
  { country: 'Switzerland',  currency: 'CHF' },
  { country: 'Sweden',       currency: 'SEK' },
  { country: 'Norway',       currency: 'NOK' },
  { country: 'Denmark',      currency: 'DKK' },
  { country: 'Turkey',       currency: 'TRY' },
  { country: 'Egypt',        currency: 'EGP' },
  { country: 'South Africa', currency: 'ZAR' },
  { country: 'Brazil',       currency: 'BRL' },
  { country: 'Mexico',       currency: 'MXN' },
]

export function getCurrencyForNationality(country) {
  const entry = NATIONALITIES.find(n => n.country === country)
  return entry?.currency || 'MYR'
}
