// ============================================================================
// CleanView.jsx
// ============================================================================
// The Clean module. Four cleaning operations, one per tab:
//   1. Missing values — fill or drop nulls in a column
//   2. Outliers       — remove outlier rows (IQR or Z-score)
//   3. Columns        — delete unwanted columns
//   4. Duplicates     — remove duplicate rows
//
// Every operation creates a NEW dataset snapshot and logs a timeline step.
// After any operation we call onChange() so ProjectPage reloads its state.
// ============================================================================

import { useState } from 'react'
import {
  fillMissing,
  removeOutliers,
  deleteColumns,
  deduplicate,
} from '../api/clean.js'


export default function CleanView({ dataset, onChange }) {
  // Which cleaning operation the user is looking at
  const [activeTab, setActiveTab] = useState('missing')

  // Feedback banner after an operation completes
  const [toast, setToast] = useState(null)   // { type: 'success' | 'error', message }

  function handleResult(result) {
    // Called after a successful cleaning op. Show toast + refresh project.
    setToast({ type: 'success', message: result.step.title })
    onChange?.()
    // Hide toast after 5 seconds
    setTimeout(() => setToast(null), 5000)
  }

  function handleError(err) {
    setToast({
      type: 'error',
      message: err.response?.data?.error || err.message,
    })
    setTimeout(() => setToast(null), 6000)
  }

  // No dataset — show hint
  if (!dataset) {
    return (
      <div>
        <h1 className="text-base font-medium mb-1">Clean data</h1>
        <p className="text-sm text-gray-500">
          Upload a dataset in the Data module first.
        </p>
      </div>
    )
  }

  const columns = Object.keys(dataset.columns_info)

  return (
    <div>
      {/* Header with dataset summary */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-base font-medium">Clean data</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {dataset.row_count} rows · {dataset.column_count} columns
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { id: 'missing',    label: 'Missing values' },
          { id: 'outliers',   label: 'Outliers' },
          { id: 'columns',    label: 'Delete columns' },
          { id: 'duplicates', label: 'Duplicates' },
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

      {/* Toast banner */}
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

      {/* Active tab content */}
      {activeTab === 'missing' && (
        <MissingValuesTab
          dataset={dataset}
          columns={columns}
          onResult={handleResult}
          onError={handleError}
        />
      )}
      {activeTab === 'outliers' && (
        <OutliersTab
          dataset={dataset}
          columns={columns}
          onResult={handleResult}
          onError={handleError}
        />
      )}
      {activeTab === 'columns' && (
        <DeleteColumnsTab
          dataset={dataset}
          columns={columns}
          onResult={handleResult}
          onError={handleError}
        />
      )}
      {activeTab === 'duplicates' && (
        <DuplicatesTab
          dataset={dataset}
          columns={columns}
          onResult={handleResult}
          onError={handleError}
        />
      )}
    </div>
  )
}


// ============================================================================
// Tab 1 — Missing Values
// ============================================================================

function MissingValuesTab({ dataset, columns, onResult, onError }) {
  const [column, setColumn] = useState(columns[0] || '')
  const [strategy, setStrategy] = useState('drop')
  const [fillValue, setFillValue] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleApply() {
    if (!column) return
    setLoading(true)
    try {
      const result = await fillMissing(
        dataset.id,
        column,
        strategy,
        strategy === 'value' ? fillValue : null
      )
      onResult(result)
    } catch (err) {
      onError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 max-w-2xl">
      <p className="text-xs text-gray-500 mb-4">
        Replace or drop null (missing) values in a column.
      </p>

      {/* Column picker */}
      <Field label="Column">
        <select
          value={column}
          onChange={(e) => setColumn(e.target.value)}
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
        >
          {columns.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>

      {/* Strategy picker */}
      <Field label="Strategy">
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
        >
          <option value="drop">Drop rows with nulls</option>
          <option value="mean">Fill with mean (numeric)</option>
          <option value="median">Fill with median (numeric)</option>
          <option value="mode">Fill with mode (most common)</option>
          <option value="value">Fill with a specific value</option>
          <option value="ffill">Forward-fill (use previous row)</option>
          <option value="bfill">Backward-fill (use next row)</option>
        </select>
      </Field>

      {/* Fill value — only shown when strategy === 'value' */}
      {strategy === 'value' && (
        <Field label="Fill with">
          <input
            type="text"
            value={fillValue}
            onChange={(e) => setFillValue(e.target.value)}
            placeholder="e.g. 0 or Unknown"
            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
          />
        </Field>
      )}

      <button
        onClick={handleApply}
        disabled={loading || !column}
        className="mt-3 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
      >
        {loading ? 'Applying...' : 'Apply'}
      </button>
    </div>
  )
}


// ============================================================================
// Tab 2 — Outliers
// ============================================================================

function OutliersTab({ dataset, columns, onResult, onError }) {
  // Filter to numeric columns only — outlier detection is for numbers
  const numericCols = columns.filter((c) => {
    const dtype = dataset.columns_info[c] || ''
    return dtype.includes('int') || dtype.includes('float')
  })

  const [column, setColumn] = useState(numericCols[0] || '')
  const [method, setMethod] = useState('iqr')
  const [threshold, setThreshold] = useState(1.5)
  const [loading, setLoading] = useState(false)

  async function handleApply() {
    if (!column) return
    setLoading(true)
    try {
      const result = await removeOutliers(dataset.id, column, method, threshold)
      onResult(result)
    } catch (err) {
      onError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 max-w-2xl">
      <p className="text-xs text-gray-500 mb-4">
        Remove rows where the selected numeric column has extreme values.
      </p>

      {numericCols.length === 0 ? (
        <div className="text-xs text-gray-500">No numeric columns in this dataset.</div>
      ) : (
        <>
          <Field label="Column (numeric only)">
            <select
              value={column}
              onChange={(e) => setColumn(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
            >
              {numericCols.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          <Field
            label="Method"
            hint={
              method === 'iqr'
                ? 'Drops values outside Q1−1.5·IQR and Q3+1.5·IQR (Tukey fence, standard approach).'
                : 'Drops values with |z-score| > 3 (extreme by normal-distribution standards).'
            }
          >
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
            >
              <option value="iqr">IQR (interquartile range)</option>
              <option value="zscore">Z-score</option>
            </select>
          </Field>

          {method === 'iqr' && (
            <Field
              label={`IQR multiplier (currently ${threshold})`}
              hint="Larger = more tolerant of outliers. 1.5 is standard; 3.0 only flags the most extreme."
            >
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full"
              />
            </Field>
          )}

          <button
            onClick={handleApply}
            disabled={loading || !column}
            className="mt-3 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
          >
            {loading ? 'Removing...' : 'Remove outliers'}
          </button>
        </>
      )}
    </div>
  )
}


// ============================================================================
// Tab 3 — Delete Columns
// ============================================================================

function DeleteColumnsTab({ dataset, columns, onResult, onError }) {
  // A Set is easier for toggling than an array
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)

  function toggle(col) {
    // Create a new Set (React needs a new reference to re-render)
    const next = new Set(selected)
    if (next.has(col)) next.delete(col)
    else next.add(col)
    setSelected(next)
  }

  async function handleApply() {
    if (selected.size === 0) return

    const cols = Array.from(selected)
    const confirmMsg = `Delete ${cols.length} column(s)?\n\n${cols.join(', ')}`
    if (!window.confirm(confirmMsg)) return

    setLoading(true)
    try {
      const result = await deleteColumns(dataset.id, cols)
      onResult(result)
      setSelected(new Set())
    } catch (err) {
      onError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <p className="text-xs text-gray-500 mb-3">
        Select columns to delete. Click a chip to toggle.
        {selected.size > 0 && (
          <span className="text-brand-700 font-medium"> {selected.size} selected.</span>
        )}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {columns.map((col) => {
          const isSelected = selected.has(col)
          const dtype = dataset.columns_info[col]
          return (
            <button
              key={col}
              onClick={() => toggle(col)}
              className={
                'text-xs rounded-md px-2.5 py-1 border transition-colors ' +
                (isSelected
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-red-400')
              }
              title={`type: ${dtype}`}
            >
              {col}
            </button>
          )
        })}
      </div>

      <button
        onClick={handleApply}
        disabled={loading || selected.size === 0}
        className="bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
      >
        {loading ? 'Deleting...' : `Delete ${selected.size} column(s)`}
      </button>
    </div>
  )
}


// ============================================================================
// Tab 4 — Duplicates
// ============================================================================

function DuplicatesTab({ dataset, columns, onResult, onError }) {
  const [useSubset, setUseSubset] = useState(false)
  const [subset, setSubset] = useState(new Set())
  const [loading, setLoading] = useState(false)

  function toggle(col) {
    const next = new Set(subset)
    if (next.has(col)) next.delete(col)
    else next.add(col)
    setSubset(next)
  }

  async function handleApply() {
    setLoading(true)
    try {
      const subsetArr = useSubset && subset.size > 0 ? Array.from(subset) : null
      const result = await deduplicate(dataset.id, subsetArr)
      onResult(result)
    } catch (err) {
      onError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 max-w-2xl">
      <p className="text-xs text-gray-500 mb-4">
        Remove exact duplicate rows.
      </p>

      <Field
        label={
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useSubset}
              onChange={(e) => setUseSubset(e.target.checked)}
            />
            <span>Only check specific columns for duplicates</span>
          </label>
        }
        hint={
          useSubset
            ? 'Rows with the same values in these columns count as duplicates.'
            : 'All columns must match for a row to count as duplicate (strictest).'
        }
      >
        {useSubset && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {columns.map((col) => {
              const isSelected = subset.has(col)
              return (
                <button
                  key={col}
                  onClick={() => toggle(col)}
                  className={
                    'text-xs rounded-md px-2.5 py-1 border transition-colors ' +
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
      </Field>

      <button
        onClick={handleApply}
        disabled={loading || (useSubset && subset.size === 0)}
        className="mt-3 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
      >
        {loading ? 'Removing...' : 'Remove duplicates'}
      </button>
    </div>
  )
}


// ============================================================================
// Small helper — consistent label + hint layout for form fields
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
