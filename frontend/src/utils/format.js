// ============================================================================
// utils/format.js
// ============================================================================
// Small formatting helpers. Import these wherever you need to display
// numbers or dates so the whole app looks consistent.
// ============================================================================


/**
 * Format a number with commas and a fixed number of decimals.
 *
 * Examples:
 *   formatNumber(1234567)       → "1,234,567"
 *   formatNumber(3.14159, 2)    → "3.14"
 *   formatNumber(null)          → "—"
 *
 * @param {number | null | undefined} value
 * @param {number} decimals — how many decimal places to show (default 2)
 */
export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '—'

  // toLocaleString handles commas/periods based on the user's locale,
  // and minimumFractionDigits+maximumFractionDigits force a fixed decimal count.
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}


/**
 * Format a percentage. Input is a decimal (0.72), output is "72%".
 *
 *   formatPercent(0.7234, 1)  → "72.3%"
 */
export function formatPercent(value, decimals = 0) {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return (value * 100).toFixed(decimals) + '%'
}


/**
 * Format an ISO date string as "Apr 20, 2026".
 */
export function formatDate(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}


/**
 * Format an ISO date string as a relative time like "2h ago" or "Yesterday".
 */
export function formatRelative(isoString) {
  if (!isoString) return '—'

  const d = new Date(isoString)
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr  = Math.floor(diffMs / 3_600_000)
  const diffDay = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1)  return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24)  return `${diffHr}h ago`
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7)  return `${diffDay}d ago`

  return formatDate(isoString)
}
