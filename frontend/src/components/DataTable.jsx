// ============================================================================
// DataTable.jsx
// ============================================================================
// Read-only data grid. The table itself is the only thing that scrolls
// (both X and Y). The header row is sticky to the top and the first
// column is sticky to the left, so large datasets stay navigable.
//
// Props:
//   columns      : string[]                — ordered column names
//   rows         : object[]                — each row keyed by column name
//   profile      : Record<col, profile> | null
//                                          — per-column stats (see
//                                            ColumnProfilePopover). When
//                                            omitted or null, no hover
//                                            popover is shown.
//   onColumnAction : (col, action) => void | null
//                                          — caller receives 'rename' |
//                                            'convertType' | 'delete' and
//                                            opens the appropriate modal.
//                                            Pass null/undefined to
//                                            disable the header dropdown.
//   maxHeight    : string (default "70vh") — CSS value for scroll area
// ============================================================================

import { useState } from 'react'
import ColumnProfilePopover from './ColumnProfilePopover.jsx'
import ColumnHeaderMenu from './ColumnHeaderMenu.jsx'

export default function DataTable({
  columns,
  rows,
  profile = null,
  onColumnAction = null,
  maxHeight = '70vh',
}) {
  // Which column's action menu is open (null = none).
  const [menuOpenFor, setMenuOpenFor] = useState(null)
  // Which column's stats popover is showing (null = none). Driven by
  // mouse-enter/leave on each header cell.
  const [hoverCol, setHoverCol] = useState(null)

  if (!columns || columns.length === 0) {
    return <div className="text-xs text-gray-400">No data</div>
  }

  return (
    // Single scroll container — the whole table is inside. overflow-auto
    // plus position:sticky on the th/first-td cells does the heavy lifting.
    <div
      className="bg-white border border-gray-200 rounded-md overflow-auto relative"
      style={{ maxHeight }}
    >
      <table className="text-xs border-collapse min-w-full">
        <thead>
          <tr>
            {columns.map((col, idx) => {
              const isFirst = idx === 0
              const colProfile = profile ? profile[col] : null
              return (
                <th
                  key={col}
                  onMouseEnter={() => setHoverCol(col)}
                  onMouseLeave={() => setHoverCol(null)}
                  className={
                    'relative text-left font-medium text-gray-700 px-3 py-2 ' +
                    'border-b border-gray-200 whitespace-nowrap bg-gray-50 ' +
                    // Sticky header row; first column sticks to the left
                    // too and gets a higher z so it wins the corner.
                    'sticky top-0 ' +
                    (isFirst ? 'left-0 z-20' : 'z-10')
                  }
                >
                  <div className="flex items-center gap-1">
                    <span>{col}</span>
                    {colProfile && (
                      <span
                        className="text-[10px] text-gray-400"
                        title={colProfile.dtype}
                      >
                        {colProfile.dtype}
                      </span>
                    )}
                    {onColumnAction && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenFor(menuOpenFor === col ? null : col)
                        }}
                        className="ml-auto w-4 h-4 rounded hover:bg-gray-200 text-gray-500 text-xs flex items-center justify-center"
                        aria-label={`Actions for ${col}`}
                      >
                        ▾
                      </button>
                    )}
                  </div>

                  {/* Hover popover with column stats */}
                  {hoverCol === col && profile && menuOpenFor !== col && (
                    <div className="absolute top-full left-0 z-30 mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                      <ColumnProfilePopover profile={colProfile} />
                    </div>
                  )}

                  {/* Action dropdown */}
                  {onColumnAction && (
                    <ColumnHeaderMenu
                      open={menuOpenFor === col}
                      onClose={() => setMenuOpenFor(null)}
                      onAction={(action) => {
                        setMenuOpenFor(null)
                        onColumnAction(col, action)
                      }}
                    />
                  )}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIdx) => (
            // `group` lets the sticky first-column cell pick up the row
            // hover state via group-hover:*.
            <tr key={rowIdx} className="group hover:bg-gray-50">
              {columns.map((col, idx) => {
                const isFirst = idx === 0
                return (
                  <td
                    key={col}
                    className={
                      'px-3 py-2 border-b border-gray-100 whitespace-nowrap text-gray-700 ' +
                      // Sticky first column — needs its own background
                      // colour so scrolling content behind it is hidden.
                      // The group-hover rule keeps it matched to the
                      // row's hover highlight.
                      (isFirst
                        ? 'sticky left-0 z-10 bg-white group-hover:bg-gray-50'
                        : '')
                    }
                  >
                    {row[col] === '' || row[col] === null || row[col] === undefined
                      ? <span className="text-gray-300">—</span>
                      : String(row[col])}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
