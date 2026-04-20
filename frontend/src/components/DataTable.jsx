// ============================================================================
// DataTable.jsx
// ============================================================================
// A simple read-only data grid.
// For V1 this just renders an HTML table. We can swap in AG Grid or similar
// later if we need better performance on large datasets.
//
// Props:
//   columns — array of column names
//   rows    — array of objects, each a row keyed by column name
// ============================================================================

export default function DataTable({ columns, rows }) {
  if (!columns || columns.length === 0) {
    return <div className="text-xs text-gray-400">No data</div>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-auto max-h-[500px]">
      <table className="w-full text-xs">
        {/* Header row */}
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="text-left font-medium text-gray-700 px-3 py-2 border-b border-gray-200 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>

        {/* Data rows */}
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td
                  key={col}
                  className="px-3 py-2 border-b border-gray-100 whitespace-nowrap text-gray-700"
                >
                  {/* Values might be numbers, strings, or empty — convert safely */}
                  {row[col] === '' || row[col] === null || row[col] === undefined
                    ? <span className="text-gray-300">—</span>
                    : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
