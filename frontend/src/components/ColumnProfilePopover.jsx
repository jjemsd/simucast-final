// ============================================================================
// ColumnProfilePopover.jsx
// ============================================================================
// A small floating card shown when the user hovers a column header. It
// displays the column's data type, null count, numeric summary (for
// numeric columns) or top values (for categorical), and any errors.
//
// Props:
//   profile : the per-column slice from the profile endpoint, i.e.
//             { dtype, null_count, non_null_count, error_count,
//               numeric: {...}|null, categorical: {...}|null }
//             Pass `null` to render a "loading" placeholder.
// ============================================================================

function formatNumber(n) {
  if (n === null || n === undefined) return '—'
  if (typeof n !== 'number') return String(n)
  // Compact large numbers; keep small ones precise.
  if (Math.abs(n) >= 10000) return n.toLocaleString()
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

export default function ColumnProfilePopover({ profile }) {
  if (!profile) {
    return (
      <div className="text-xs text-gray-400 p-3">Loading column stats…</div>
    )
  }

  const total = profile.null_count + profile.non_null_count

  return (
    <div className="p-3 text-xs text-gray-700 w-64">
      {/* Type + null count */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900">Type</span>
        <code className="text-[11px] bg-gray-100 text-gray-700 rounded px-1.5 py-0.5">
          {profile.dtype}
        </code>
      </div>

      <Row label="Non-null" value={`${profile.non_null_count} / ${total}`} />
      <Row label="Nulls" value={profile.null_count} />
      {profile.error_count > 0 && (
        <Row
          label="Errors"
          value={profile.error_count}
          highlight
        />
      )}

      {/* Numeric summary */}
      {profile.numeric && (
        <div className="mt-3 pt-2 border-t border-gray-200">
          <div className="font-medium text-gray-900 mb-1">Numeric summary</div>
          <Row label="Sum" value={formatNumber(profile.numeric.sum)} />
          <Row label="Mean" value={formatNumber(profile.numeric.mean)} />
          <Row label="Min" value={formatNumber(profile.numeric.min)} />
          <Row label="Max" value={formatNumber(profile.numeric.max)} />
          <Row label="Std" value={formatNumber(profile.numeric.std)} />
        </div>
      )}

      {/* Categorical / top values */}
      {profile.categorical && profile.categorical.top_values?.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-200">
          <div className="font-medium text-gray-900 mb-1">
            Top values{' '}
            <span className="text-gray-400 font-normal">
              ({profile.categorical.unique_count} unique)
            </span>
          </div>
          <ul className="space-y-0.5">
            {profile.categorical.top_values.map((tv) => (
              <li key={tv.value} className="flex justify-between gap-2">
                <span className="truncate" title={tv.value}>{tv.value}</span>
                <span className="text-gray-500 shrink-0">{tv.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className={highlight ? 'text-red-600 font-medium' : ''}>{value}</span>
    </div>
  )
}
