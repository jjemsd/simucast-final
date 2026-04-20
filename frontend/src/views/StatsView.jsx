// ============================================================================
// StatsView.jsx  —  WEEK 6 VERSION
// ============================================================================
// Same 3-tab structure from Week 5, with one addition: every result now has
// a "Save to report" button that pushes it into the Report module.
// ============================================================================

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { computeDescriptives, computeFrequencies, computeNormality } from '../api/stats.js'
import { saveReportItem } from '../api/reports.js'
import StatCard from '../components/StatCard.jsx'
import ChartCard from '../components/ChartCard.jsx'


export default function StatsView({ dataset }) {
  const [activeTab, setActiveTab] = useState('descriptives')
  const { projectId } = useParams()

  if (!dataset) {
    return (
      <div>
        <h1 className="text-base font-medium mb-1">Descriptive statistics</h1>
        <p className="text-sm text-gray-500">Upload a dataset in the Data module first.</p>
      </div>
    )
  }

  const columns = Object.keys(dataset.columns_info)
  const numericCols = columns.filter((c) => {
    const d = dataset.columns_info[c] || ''
    return d.includes('int') || d.includes('float')
  })

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-base font-medium">Descriptive statistics</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {dataset.row_count} rows · {dataset.column_count} columns
        </p>
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { id: 'descriptives', label: 'Descriptives' },
          { id: 'frequencies',  label: 'Frequencies' },
          { id: 'normality',    label: 'Normality' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={
              'px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ' +
              (activeTab === tab.id
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-900')
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'descriptives' && (
        <DescriptivesTab dataset={dataset} numericCols={numericCols} projectId={projectId} />
      )}
      {activeTab === 'frequencies' && (
        <FrequenciesTab dataset={dataset} columns={columns} projectId={projectId} />
      )}
      {activeTab === 'normality' && (
        <NormalityTab dataset={dataset} numericCols={numericCols} projectId={projectId} />
      )}
    </div>
  )
}


// ============================================================================
// Shared: save-to-report button
// ============================================================================

function SaveToReportButton({ kind, title, data, projectId }) {
  const [state, setState] = useState('idle')  // idle | saving | saved

  async function handleSave() {
    setState('saving')
    try {
      await saveReportItem(projectId, kind, title, data)
      setState('saved')
      setTimeout(() => setState('idle'), 3000)
    } catch (err) {
      alert('Save failed: ' + (err.response?.data?.error || err.message))
      setState('idle')
    }
  }

  if (state === 'saved') {
    return (
      <span className="text-[11px] text-green-700 font-medium">✓ Added to report</span>
    )
  }

  return (
    <button
      onClick={handleSave}
      disabled={state === 'saving'}
      className="text-[11px] border border-gray-200 rounded-md px-2 py-1 text-gray-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
    >
      {state === 'saving' ? 'Saving...' : '+ Save to report'}
    </button>
  )
}


// ============================================================================
// Tab 1 — Descriptives
// ============================================================================

function DescriptivesTab({ dataset, numericCols, projectId }) {
  const [selectedCols, setSelectedCols] = useState([])
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleColumn(col) {
    setSelectedCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    )
  }

  async function handleRun() {
    if (selectedCols.length === 0) { setError('Pick at least one column'); return }
    setError('')
    setLoading(true)
    try {
      const res = await computeDescriptives(dataset.id, selectedCols)
      setResults(res)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-md p-3.5 mb-4">
        <div className="text-xs font-medium mb-2">Numeric columns (click to select)</div>
        {numericCols.length === 0 ? (
          <div className="text-xs text-gray-500">No numeric columns in this dataset.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {numericCols.map((col) => {
              const isSelected = selectedCols.includes(col)
              return (
                <button
                  key={col}
                  onClick={() => toggleColumn(col)}
                  className={
                    'text-xs rounded-md px-2.5 py-1 border ' +
                    (isSelected
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-brand-400')
                  }
                >
                  {col}
                </button>
              )
            })}
          </div>
        )}

        <button
          onClick={handleRun}
          disabled={loading || selectedCols.length === 0}
          className="mt-3 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
        >
          {loading ? 'Computing...' : 'Run descriptives'}
        </button>

        {error && (
          <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
        )}
      </div>

      {results && (
        <div className="space-y-4">
          {Object.entries(results).map(([col, stats]) => {
            if (stats.error) {
              return (
                <div key={col} className="bg-white border border-gray-200 rounded-md p-3.5">
                  <div className="text-sm font-medium mb-1">{col}</div>
                  <div className="text-xs text-red-700">{stats.error}</div>
                </div>
              )
            }
            return (
              <div key={col} className="bg-white border border-gray-200 rounded-md p-3.5">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-sm font-medium">{col}</div>
                  <div className="flex items-center gap-3">
                    <div className="text-[10px] text-gray-500">
                      {stats.count} values · {stats.missing} missing
                    </div>
                    <SaveToReportButton
                      projectId={projectId}
                      kind="descriptives"
                      title={`Descriptives: ${col}`}
                      data={{ [col]: stats }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <StatCard label="Mean"     value={stats.mean} />
                  <StatCard label="Median"   value={stats.median} />
                  <StatCard label="SD"       value={stats.std} />
                  <StatCard label="Range"    value={stats.range} />
                  <StatCard label="Min"      value={stats.min} />
                  <StatCard label="Max"      value={stats.max} />
                  <StatCard label="Skew"     value={stats.skewness} />
                  <StatCard label="Kurtosis" value={stats.kurtosis} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ============================================================================
// Tab 2 — Frequencies
// ============================================================================

function FrequenciesTab({ dataset, columns, projectId }) {
  const [column, setColumn] = useState(columns[0] || '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRun() {
    setError(''); setResult(null); setLoading(true)
    try {
      const res = await computeFrequencies(dataset.id, column)
      setResult(res)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const chartData = result ? {
    labels: result.frequencies.slice(0, 15).map((f) => f.value),
    datasets: [{
      label: 'Count',
      data: result.frequencies.slice(0, 15).map((f) => f.count),
      backgroundColor: '#EA580C',
    }],
  } : null

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-md p-3.5 mb-4 max-w-xl">
        <p className="text-xs text-gray-500 mb-3">
          Count how often each unique value appears. Works best for categorical columns.
        </p>
        <div className="text-xs font-medium text-gray-700 mb-1">Column</div>
        <select
          value={column}
          onChange={(e) => setColumn(e.target.value)}
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs mb-3"
        >
          {columns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={handleRun}
          disabled={loading || !column}
          className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
        >
          {loading ? 'Computing...' : 'Compute frequencies'}
        </button>
        {error && <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
      </div>

      {result && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-500">
              {result.column} · {result.unique_count} unique · {result.total} rows
            </div>
            <SaveToReportButton
              projectId={projectId}
              kind="frequencies"
              title={`Frequencies: ${result.column}`}
              data={result}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-gray-600">Value</th>
                      <th className="px-3 py-1.5 text-right font-medium text-gray-600">Count</th>
                      <th className="px-3 py-1.5 text-right font-medium text-gray-600">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.frequencies.map((f, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                        <td className="px-3 py-1.5 truncate max-w-[160px]" title={f.value}>{f.value}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{f.count}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{f.percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {chartData && (
              <ChartCard
                title={`Top ${Math.min(15, result.frequencies.length)} values`}
                type="bar"
                data={chartData}
                options={{
                  indexAxis: 'y',
                  scales: { x: { beginAtZero: true, grid: { color: '#F3F4F6' } }, y: { grid: { display: false } } },
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ============================================================================
// Tab 3 — Normality
// ============================================================================

function NormalityTab({ dataset, numericCols, projectId }) {
  const [column, setColumn] = useState(numericCols[0] || '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRun() {
    setError(''); setResult(null); setLoading(true)
    try {
      const res = await computeNormality(dataset.id, column)
      setResult(res)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const chartData = result?.histogram ? {
    labels: result.histogram.map((b) => `${b.bin_start}–${b.bin_end}`),
    datasets: [{
      label: 'Count',
      data: result.histogram.map((b) => b.count),
      backgroundColor: '#FB923C',
      borderColor: '#EA580C',
      borderWidth: 1,
    }],
  } : null

  if (numericCols.length === 0) {
    return <div className="text-xs text-gray-500">No numeric columns in this dataset.</div>
  }

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-md p-3.5 mb-4 max-w-xl">
        <p className="text-xs text-gray-500 mb-3">
          Tests whether a column follows a normal distribution. If p &gt; 0.05, parametric tests are appropriate.
        </p>
        <div className="text-xs font-medium text-gray-700 mb-1">Numeric column</div>
        <select
          value={column}
          onChange={(e) => setColumn(e.target.value)}
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs mb-3"
        >
          {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={handleRun}
          disabled={loading || !column}
          className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test normality'}
        </button>
        {error && <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
      </div>

      {result && (
        <div>
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-4">
            <div className={
              'px-4 py-2.5 text-xs font-medium border-b flex items-center justify-between ' +
              (result.is_normal
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-amber-50 text-amber-800 border-amber-200')
            }>
              <span>
                {result.column} — {result.is_normal ? 'Normal distribution' : 'Not normal'} (p = {result.shapiro_p})
              </span>
              <SaveToReportButton
                projectId={projectId}
                kind="normality"
                title={`Normality: ${result.column}`}
                data={result}
              />
            </div>

            <div className="p-4 grid grid-cols-4 gap-2.5">
              <StatCard label="n"              value={result.n} />
              <StatCard label="Shapiro-Wilk W" value={result.shapiro_statistic} />
              <StatCard label="Skewness"       value={result.skewness} />
              <StatCard label="Kurtosis"       value={result.kurtosis} />
            </div>

            <div className="px-4 pb-4 text-[11px] text-gray-500 leading-relaxed">
              {result.is_normal
                ? `Shapiro-Wilk p-value of ${result.shapiro_p} is above 0.05, so we can't reject the hypothesis that this data is normal. Parametric tests are fine.`
                : `Shapiro-Wilk p-value of ${result.shapiro_p} is below 0.05, so the data is probably not normal. Consider non-parametric tests.`
              }
              {result.n > 5000 && ' Note: with this many rows, Shapiro-Wilk often flags small deviations — visual inspection of the histogram matters more.'}
            </div>
          </div>

          {chartData && (
            <ChartCard
              title={`${result.column} — histogram`}
              type="bar"
              data={chartData}
              options={{
                scales: {
                  x: { grid: { display: false }, ticks: { font: { size: 9 } } },
                  y: { beginAtZero: true, grid: { color: '#F3F4F6' } },
                },
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
