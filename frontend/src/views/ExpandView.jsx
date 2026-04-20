// ============================================================================
// ExpandView.jsx
// ============================================================================
// Feature engineering UI — 4 tabs:
//   1. Math      — apply log, sqrt, z-score, etc. to a single column
//   2. Combine   — create a new column from two columns (a+b, a*b, ...)
//   3. Bins      — bucket a continuous column into categories
//   4. AI suggest — Claude suggests features based on your columns
// ============================================================================

import { useState } from 'react'
import {
  applyMathTransform,
  createInteraction,
  createBins,
  suggestFeatures,
  applySuggestion,
} from '../api/expand.js'


export default function ExpandView({ dataset, onChange }) {
  const [activeTab, setActiveTab] = useState('math')
  const [toast, setToast] = useState(null)

  function showSuccess(step) {
    setToast({ type: 'success', message: step.title })
    onChange?.()
    setTimeout(() => setToast(null), 5000)
  }

  function showError(err) {
    setToast({
      type: 'error',
      message: err.response?.data?.error || err.message,
    })
    setTimeout(() => setToast(null), 6000)
  }

  if (!dataset) {
    return (
      <div>
        <h1 className="text-base font-medium mb-1">Expand data</h1>
        <p className="text-sm text-gray-500">Upload a dataset in the Data module first.</p>
      </div>
    )
  }

  const columns = Object.keys(dataset.columns_info)
  const numericCols = columns.filter((c) => {
    const dtype = dataset.columns_info[c] || ''
    return dtype.includes('int') || dtype.includes('float')
  })

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-base font-medium">Expand data</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Create new columns from existing ones · {dataset.column_count} columns currently
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { id: 'math',    label: 'Math transforms' },
          { id: 'combine', label: 'Combine columns' },
          { id: 'bins',    label: 'Binning' },
          { id: 'ai',      label: '✦ AI suggest' },
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

      {/* Toast */}
      {toast && (
        <div
          className={
            'mb-4 text-xs rounded-md px-3 py-2 border ' +
            (toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800')
          }
        >
          {toast.message}
        </div>
      )}

      {activeTab === 'math' && (
        <MathTab dataset={dataset} numericCols={numericCols} onResult={showSuccess} onError={showError} />
      )}
      {activeTab === 'combine' && (
        <CombineTab dataset={dataset} numericCols={numericCols} onResult={showSuccess} onError={showError} />
      )}
      {activeTab === 'bins' && (
        <BinsTab dataset={dataset} numericCols={numericCols} onResult={showSuccess} onError={showError} />
      )}
      {activeTab === 'ai' && (
        <AITab dataset={dataset} onResult={showSuccess} onError={showError} />
      )}
    </div>
  )
}


// ============================================================================
// Tab 1 — Math transforms
// ============================================================================

const MATH_OPTIONS = [
  { value: 'log',        label: 'log (natural)' },
  { value: 'log10',      label: 'log base 10' },
  { value: 'sqrt',       label: 'square root' },
  { value: 'square',     label: 'squared' },
  { value: 'reciprocal', label: 'reciprocal (1/x)' },
  { value: 'zscore',     label: 'z-score (standardize)' },
  { value: 'minmax',     label: 'min-max normalize [0, 1]' },
  { value: 'abs',        label: 'absolute value' },
]


function MathTab({ dataset, numericCols, onResult, onError }) {
  const [column, setColumn] = useState(numericCols[0] || '')
  const [transform, setTransform] = useState('log')
  const [customName, setCustomName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleApply() {
    if (!column) return
    setLoading(true)
    try {
      const result = await applyMathTransform(dataset.id, column, transform, customName || null)
      onResult(result.step)
      setCustomName('')
    } catch (err) {
      onError(err)
    } finally {
      setLoading(false)
    }
  }

  if (numericCols.length === 0) {
    return <div className="text-xs text-gray-500">No numeric columns in this dataset.</div>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 max-w-2xl">
      <p className="text-xs text-gray-500 mb-4">
        Apply a mathematical transformation to a numeric column. Creates a new column, keeps the original.
      </p>

      <Field label="Column">
        <select
          value={column}
          onChange={(e) => setColumn(e.target.value)}
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
        >
          {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="Transform">
        <select
          value={transform}
          onChange={(e) => setTransform(e.target.value)}
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
        >
          {MATH_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </Field>

      <Field
        label="New column name"
        hint="Leave blank to auto-generate (e.g. log_age, z_income)."
      >
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="(auto)"
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
        />
      </Field>

      <button
        onClick={handleApply}
        disabled={loading}
        className="mt-3 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
      >
        {loading ? 'Applying...' : 'Create new column'}
      </button>
    </div>
  )
}


// ============================================================================
// Tab 2 — Combine two columns
// ============================================================================

function CombineTab({ dataset, numericCols, onResult, onError }) {
  const [colA, setColA] = useState(numericCols[0] || '')
  const [colB, setColB] = useState(numericCols[1] || numericCols[0] || '')
  const [operation, setOperation] = useState('multiply')
  const [customName, setCustomName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleApply() {
    if (!colA || !colB) return
    setLoading(true)
    try {
      const result = await createInteraction(dataset.id, colA, colB, operation, customName || null)
      onResult(result.step)
      setCustomName('')
    } catch (err) {
      onError(err)
    } finally {
      setLoading(false)
    }
  }

  if (numericCols.length < 2) {
    return <div className="text-xs text-gray-500">Need at least 2 numeric columns to combine.</div>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 max-w-2xl">
      <p className="text-xs text-gray-500 mb-4">
        Combine two numeric columns with basic arithmetic. Example: BMI = weight / height².
      </p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">Column A</div>
          <select
            value={colA}
            onChange={(e) => setColA(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
          >
            {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">Operation</div>
          <select
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
          >
            <option value="add">+ (add)</option>
            <option value="subtract">− (subtract)</option>
            <option value="multiply">× (multiply)</option>
            <option value="divide">÷ (divide)</option>
          </select>
        </div>

        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">Column B</div>
          <select
            value={colB}
            onChange={(e) => setColB(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
          >
            {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <Field label="New column name" hint="Leave blank for auto-generated name.">
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="(auto)"
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
        />
      </Field>

      <button
        onClick={handleApply}
        disabled={loading}
        className="mt-3 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create new column'}
      </button>
    </div>
  )
}


// ============================================================================
// Tab 3 — Binning
// ============================================================================

function BinsTab({ dataset, numericCols, onResult, onError }) {
  const [column, setColumn] = useState(numericCols[0] || '')
  const [numBins, setNumBins] = useState(4)
  const [method, setMethod] = useState('equal_width')
  const [customName, setCustomName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleApply() {
    if (!column) return
    setLoading(true)
    try {
      const result = await createBins(dataset.id, column, numBins, method, customName || null)
      onResult(result.step)
      setCustomName('')
    } catch (err) {
      onError(err)
    } finally {
      setLoading(false)
    }
  }

  if (numericCols.length === 0) {
    return <div className="text-xs text-gray-500">No numeric columns to bin.</div>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 max-w-2xl">
      <p className="text-xs text-gray-500 mb-4">
        Bucket a continuous column into categories (e.g. age → age group).
      </p>

      <Field label="Column">
        <select
          value={column}
          onChange={(e) => setColumn(e.target.value)}
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
        >
          {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label={`Number of bins: ${numBins}`}>
        <input
          type="range"
          min="2" max="10"
          value={numBins}
          onChange={(e) => setNumBins(parseInt(e.target.value))}
          className="w-full"
        />
      </Field>

      <Field
        label="Method"
        hint={
          method === 'equal_width'
            ? 'Each bin covers the same numeric range.'
            : 'Each bin contains the same number of rows (quantile-based).'
        }
      >
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
        >
          <option value="equal_width">Equal width</option>
          <option value="quantile">Quantile (equal count per bin)</option>
        </select>
      </Field>

      <Field label="New column name" hint="Leave blank for auto (e.g. age_bin).">
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="(auto)"
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
        />
      </Field>

      <button
        onClick={handleApply}
        disabled={loading}
        className="mt-3 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
      >
        {loading ? 'Binning...' : 'Create bins'}
      </button>
    </div>
  )
}


// ============================================================================
// Tab 4 — AI-suggested features
// ============================================================================

function AITab({ dataset, onResult, onError }) {
  const [suggestions, setSuggestions] = useState(null)
  const [loadingSuggest, setLoadingSuggest] = useState(false)
  const [applyingIdx, setApplyingIdx] = useState(null)

  async function handleSuggest() {
    setLoadingSuggest(true)
    try {
      const result = await suggestFeatures(dataset.id)
      setSuggestions(result)
    } catch (err) {
      onError(err)
    } finally {
      setLoadingSuggest(false)
    }
  }

  async function handleApply(suggestion, idx) {
    setApplyingIdx(idx)
    try {
      const result = await applySuggestion(
        dataset.id,
        suggestion.name,
        suggestion.formula,
        suggestion.source_columns
      )
      onResult(result.step)
      // Remove the applied suggestion from the list
      setSuggestions(suggestions.filter((_, i) => i !== idx))
    } catch (err) {
      onError(err)
    } finally {
      setApplyingIdx(null)
    }
  }

  return (
    <div>
      <div className="bg-brand-50 border border-brand-200 rounded-md p-4 mb-4">
        <div className="flex items-start gap-2">
          <span className="text-brand-600 mt-0.5">✦</span>
          <div className="flex-1">
            <div className="text-xs font-medium text-brand-900 mb-1">AI feature suggestions</div>
            <p className="text-xs text-brand-800 leading-relaxed mb-3">
              Claude will analyze your columns and suggest 4–6 useful derived features.
              Click Apply on any suggestion to create it.
            </p>
            <button
              onClick={handleSuggest}
              disabled={loadingSuggest}
              className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
            >
              {loadingSuggest ? 'Analyzing your data...' : suggestions ? 'Get new suggestions' : 'Analyze dataset'}
            </button>
          </div>
        </div>
      </div>

      {suggestions && suggestions.length === 0 && (
        <div className="text-xs text-gray-500 italic">
          No more suggestions. Click the button above to get fresh ones.
        </div>
      )}

      {suggestions && suggestions.map((s, idx) => (
        <div key={idx} className="bg-white border border-gray-200 rounded-md p-3.5 mb-2.5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">{s.name}</span>
                {s.source_columns?.length > 0 && (
                  <span className="text-[10px] text-gray-500">
                    from: {s.source_columns.join(', ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 mb-1.5">{s.description}</p>
              {s.formula && (
                <code className="text-[11px] bg-gray-100 rounded px-2 py-0.5 text-gray-800">
                  {s.formula}
                </code>
              )}
            </div>
            <button
              onClick={() => handleApply(s, idx)}
              disabled={applyingIdx !== null || !s.formula}
              className="shrink-0 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
            >
              {applyingIdx === idx ? '...' : 'Apply'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}


// ============================================================================
// Shared helper
// ============================================================================

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <div className="text-xs font-medium text-gray-700 mb-1">{label}</div>
      {children}
      {hint && <div className="text-[10px] text-gray-500 mt-1">{hint}</div>}
    </div>
  )
}
