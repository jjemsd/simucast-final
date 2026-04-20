// ============================================================================
// StatCard.jsx
// ============================================================================
// A small card showing a label and a number. Reused everywhere we need
// a compact metric display (dashboard, stats view, what-if scenarios).
//
// Props:
//   label — short text above the number ("Mean", "Rows", etc.)
//   value — the number or string to display
// ============================================================================

export default function StatCard({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-md px-3 py-2.5">
      <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
      <div className="text-base font-medium">{value}</div>
    </div>
  )
}
