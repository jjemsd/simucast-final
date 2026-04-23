// ============================================================================
// AIOverview.jsx
// ============================================================================
// The "Overview" panel at the top of DataView. Calls the AI overview
// endpoint (which reads the profile and asks Claude to summarise) and
// shows:
//   - one-line health summary
//   - up to 6 issues (column + short description)
//   - up to 5 cleaning suggestions
//
// The panel is collapsible and has a Refresh button — each refresh
// re-runs the AI call, so only hit it when you want to spend the
// token budget.
//
// Props:
//   datasetId : number  — dataset to summarise
// ============================================================================

import { useEffect, useState } from 'react'
import { getOverview } from '../api/ai.js'

export default function AIOverview({ datasetId }) {
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  async function load() {
    if (!datasetId) return
    setLoading(true)
    setError('')
    try {
      const result = await getOverview(datasetId)
      setData(result)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not load overview')
    } finally {
      setLoading(false)
    }
  }

  // Auto-load once on mount (and whenever the dataset changes). We
  // intentionally keep the prior data visible while the next fetch
  // loads so the panel doesn't flash blank.
  useEffect(() => {
    setData(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId])

  return (
    <section className="bg-white border border-gray-200 rounded-md mb-4">
      <header className="flex items-center justify-between px-3.5 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-brand-500 text-sm">✦</span>
          <h2 className="text-xs font-semibold text-gray-800">Overview</h2>
          {loading && (
            <span className="text-[11px] text-gray-400">thinking…</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={load}
            disabled={loading}
            className="text-[11px] text-gray-500 hover:text-gray-900 disabled:opacity-40"
            title="Re-run AI overview"
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-[11px] text-gray-500 hover:text-gray-900"
            title={open ? 'Hide' : 'Show'}
          >
            {open ? '▾' : '▸'}
          </button>
        </div>
      </header>

      {open && (
        <div className="p-3.5">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5 mb-3">
              {error}
            </div>
          )}

          {!data && !error && loading && (
            <SkeletonOverview />
          )}

          {data && (
            <div className="flex flex-col gap-3">
              {/* One-liner summary */}
              {data.summary && (
                <p className="text-sm text-gray-800">{data.summary}</p>
              )}

              {/* Issues */}
              {data.issues && data.issues.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Issues to review
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {data.issues.map((iss, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-gray-700"
                      >
                        <IssueBadge type={iss.type} />
                        <span>
                          {iss.column && (
                            <code className="bg-gray-100 px-1 py-0.5 rounded mr-1 text-[11px]">
                              {iss.column}
                            </code>
                          )}
                          {iss.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggestions */}
              {data.suggestions && data.suggestions.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Suggested next steps
                  </h3>
                  <ul className="flex flex-col gap-1 list-disc pl-5">
                    {data.suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-gray-700">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(!data.issues || data.issues.length === 0) &&
                (!data.suggestions || data.suggestions.length === 0) && (
                  <p className="text-xs text-gray-400">
                    Nothing worth flagging — the dataset looks clean.
                  </p>
                )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function IssueBadge({ type }) {
  // Small colour-coded badge so the user can scan the list visually.
  const palette =
    type === 'errors'
      ? 'bg-red-100 text-red-700'
      : type === 'nulls'
      ? 'bg-yellow-100 text-yellow-800'
      : type === 'mixed'
      ? 'bg-orange-100 text-orange-800'
      : type === 'low_variance'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-gray-100 text-gray-700'
  return (
    <span
      className={
        'text-[10px] font-medium uppercase tracking-wider rounded px-1.5 py-0.5 shrink-0 ' +
        palette
      }
    >
      {type || 'note'}
    </span>
  )
}

function SkeletonOverview() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      <div className="h-3 bg-gray-100 rounded w-3/4" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
      <div className="h-3 bg-gray-100 rounded w-2/3" />
    </div>
  )
}
