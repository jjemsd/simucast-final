// ============================================================================
// SyntheticModal.jsx
// ============================================================================
// The modal that opens from "Generate synthetic data" button in DataView.
// Two tabs:
//   1. Schema    — user builds up columns with a dynamic form
//   2. AI        — user describes the data in plain English
//
// On success, calls onGenerated(dataset) so the parent can refresh.
// ============================================================================

import { useState } from 'react'
import Modal from './Modal.jsx'
import { generateFromSchema, generateWithAI } from '../api/synthetic.js'


export default function SyntheticModal({ open, onClose, projectId, onGenerated }) {
  const [activeTab, setActiveTab] = useState('schema')

  return (
    <Modal open={open} onClose={onClose} title="Generate synthetic data" maxWidth="700px">
      {/* Tab header */}
      <div className="flex gap-1 mb-4 border-b border-gray-200 -mx-4 px-4">
        {[
          { id: 'schema', label: 'From schema' },
          { id: 'ai',     label: '✦ AI-generated' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={
              'px-3 py-2 text-xs font-medium border-b-2 -mb-px ' +
              (activeTab === tab.id
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-900')
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'schema' && (
        <SchemaBuilder
          projectId={projectId}
          onGenerated={(dataset) => {
            onGenerated(dataset)
            onClose()
          }}
        />
      )}

      {activeTab === 'ai' && (
        <AIGenerator
          projectId={projectId}
          onGenerated={(dataset) => {
            onGenerated(dataset)
            onClose()
          }}
        />
      )}
    </Modal>
  )
}


// ============================================================================
// Tab 1 — Schema builder
// ============================================================================

// Available column types and their param shapes
const COLUMN_TYPES = [
  { value: 'numeric',  label: 'Numeric (normal distribution)' },
  { value: 'category', label: 'Category (fixed values)' },
  { value: 'boolean',  label: 'Boolean (true/false)' },
  { value: 'date',     label: 'Date range' },
  { value: 'uuid',     label: 'UUID / ID' },
  { value: 'name',     label: 'Person name' },
  { value: 'email',    label: 'Email address' },
  { value: 'phone',    label: 'Phone number' },
  { value: 'city',     label: 'City' },
  { value: 'company',  label: 'Company name' },
]


function SchemaBuilder({ projectId, onGenerated }) {
  const [numRows, setNumRows] = useState(500)
  const [filename, setFilename] = useState('synthetic_data.csv')
  const [columns, setColumns] = useState([
    { name: 'id',        type: 'uuid',    params: { prefix: 'ID' } },
    { name: 'age',       type: 'numeric', params: { mean: 35, std: 10, min: 18, max: 80, integer: true } },
    { name: 'gender',    type: 'category', params: { values: 'Male, Female, Non-binary' } },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function addColumn() {
    setColumns([...columns, { name: `column_${columns.length + 1}`, type: 'numeric', params: { mean: 0, std: 1 } }])
  }

  function removeColumn(idx) {
    setColumns(columns.filter((_, i) => i !== idx))
  }

  function updateColumn(idx, changes) {
    const next = [...columns]
    next[idx] = { ...next[idx], ...changes }
    setColumns(next)
  }

  function updateColumnType(idx, newType) {
    // Reset params when type changes
    const defaultParams = {
      numeric:  { mean: 0, std: 1 },
      category: { values: 'A, B, C' },
      boolean:  {},
      date:     { start: '2020-01-01', end: '2024-12-31' },
      uuid:     { prefix: 'ID' },
      name:     {},
      email:    {},
      phone:    {},
      city:     {},
      company:  {},
    }[newType] || {}
    updateColumn(idx, { type: newType, params: defaultParams })
  }

  async function handleGenerate() {
    setError('')

    // Convert our friendly UI shape into the backend schema shape
    const schema = {
      num_rows: numRows,
      filename,
      columns: columns.map((col) => {
        const base = { name: col.name.trim(), type: col.type }

        if (col.type === 'numeric') {
          return {
            ...base,
            mean: parseFloat(col.params.mean || 0),
            std:  parseFloat(col.params.std || 1),
            min:  col.params.min !== undefined && col.params.min !== '' ? parseFloat(col.params.min) : undefined,
            max:  col.params.max !== undefined && col.params.max !== '' ? parseFloat(col.params.max) : undefined,
            integer: !!col.params.integer,
          }
        }
        if (col.type === 'category') {
          return {
            ...base,
            values: col.params.values.split(',').map((s) => s.trim()).filter(Boolean),
          }
        }
        if (col.type === 'date') {
          return { ...base, start: col.params.start, end: col.params.end }
        }
        if (col.type === 'uuid') {
          return { ...base, prefix: col.params.prefix || 'ID' }
        }
        return base  // boolean, name, email, phone, city, company — no params
      }),
    }

    // Basic validation
    if (!schema.columns.every((c) => c.name)) {
      setError('Every column needs a name')
      return
    }
    if (schema.columns.length === 0) {
      setError('Add at least one column')
      return
    }

    setLoading(true)
    try {
      const result = await generateFromSchema(projectId, schema)
      onGenerated(result.dataset)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Top-level settings */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">Number of rows</div>
          <input
            type="number"
            min="1" max="10000"
            value={numRows}
            onChange={(e) => setNumRows(parseInt(e.target.value) || 100)}
            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
          />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">Filename</div>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
          />
        </div>
      </div>

      {/* Columns */}
      <div className="text-xs font-medium text-gray-700 mb-2">Columns ({columns.length})</div>
      <div className="flex flex-col gap-2 mb-3 max-h-80 overflow-y-auto">
        {columns.map((col, idx) => (
          <ColumnEditor
            key={idx}
            column={col}
            onChange={(changes) => updateColumn(idx, changes)}
            onTypeChange={(type) => updateColumnType(idx, type)}
            onRemove={() => removeColumn(idx)}
          />
        ))}
      </div>

      <button
        onClick={addColumn}
        className="text-xs border border-dashed border-gray-300 rounded-md px-3 py-1.5 text-gray-600 hover:border-brand-400 hover:text-brand-700 w-full"
      >
        + Add column
      </button>

      {error && (
        <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end mt-4">
        <button
          onClick={handleGenerate}
          disabled={loading || columns.length === 0}
          className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-4 py-1.5 disabled:opacity-50"
        >
          {loading ? 'Generating...' : `Generate ${numRows} rows`}
        </button>
      </div>
    </div>
  )
}


// ============================================================================
// Column editor — one row per column with type-specific params
// ============================================================================

function ColumnEditor({ column, onChange, onTypeChange, onRemove }) {
  return (
    <div className="border border-gray-200 rounded-md p-2.5">
      {/* Row 1: name + type + remove */}
      <div className="flex gap-2 items-center mb-2">
        <input
          type="text"
          value={column.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="column name"
          className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-xs"
        />
        <select
          value={column.type}
          onChange={(e) => onTypeChange(e.target.value)}
          className="border border-gray-200 rounded-md px-2 py-1 text-xs"
        >
          {COLUMN_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-600 text-sm px-1"
          title="Remove column"
        >×</button>
      </div>

      {/* Row 2: type-specific params */}
      <ColumnParams column={column} onChange={onChange} />
    </div>
  )
}


function ColumnParams({ column, onChange }) {
  const update = (key, value) => onChange({ params: { ...column.params, [key]: value } })

  if (column.type === 'numeric') {
    return (
      <div className="flex gap-2 items-center flex-wrap">
        <ParamInput label="mean" value={column.params.mean} onChange={(v) => update('mean', v)} />
        <ParamInput label="std"  value={column.params.std}  onChange={(v) => update('std', v)} />
        <ParamInput label="min"  value={column.params.min}  onChange={(v) => update('min', v)} placeholder="none" />
        <ParamInput label="max"  value={column.params.max}  onChange={(v) => update('max', v)} placeholder="none" />
        <label className="flex items-center gap-1 text-[11px] text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={!!column.params.integer}
            onChange={(e) => update('integer', e.target.checked)}
          />
          integer
        </label>
      </div>
    )
  }

  if (column.type === 'category') {
    return (
      <div>
        <div className="text-[10px] text-gray-500 mb-0.5">Comma-separated values</div>
        <input
          type="text"
          value={column.params.values || ''}
          onChange={(e) => update('values', e.target.value)}
          placeholder="e.g. Red, Green, Blue"
          className="w-full border border-gray-200 rounded-md px-2 py-1 text-xs"
        />
      </div>
    )
  }

  if (column.type === 'date') {
    return (
      <div className="flex gap-2 items-center">
        <ParamInput label="from" type="date" value={column.params.start} onChange={(v) => update('start', v)} />
        <ParamInput label="to"   type="date" value={column.params.end}   onChange={(v) => update('end', v)} />
      </div>
    )
  }

  if (column.type === 'uuid') {
    return (
      <div className="flex gap-2 items-center">
        <ParamInput label="prefix" value={column.params.prefix || ''} onChange={(v) => update('prefix', v)} placeholder="ID" />
      </div>
    )
  }

  return <div className="text-[10px] text-gray-400 italic">No parameters — uses realistic defaults.</div>
}


function ParamInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-gray-500">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-20 border border-gray-200 rounded-md px-1.5 py-0.5 text-[11px]"
      />
    </div>
  )
}


// ============================================================================
// Tab 2 — AI generator
// ============================================================================

function AIGenerator({ projectId, onGenerated }) {
  const [description, setDescription] = useState('')
  const [numRows, setNumRows] = useState(50)
  const [filename, setFilename] = useState('ai_data.csv')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    if (!description.trim()) { setError('Describe the data you want'); return }

    setError('')
    setLoading(true)
    try {
      const result = await generateWithAI(projectId, description.trim(), numRows, filename)
      onGenerated(result.dataset)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Describe the dataset you want in plain English. Claude will generate realistic rows based on your description.
        Capped at 100 rows because the full output must fit in one AI response.
      </p>

      <div className="mb-3">
        <div className="text-xs font-medium text-gray-700 mb-1">Description</div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="50 rows of customer purchase data for a coffee shop in Manila, with columns for customer ID, date, item, quantity, price in PHP, and tip"
          rows={4}
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">Number of rows (max 100)</div>
          <input
            type="number"
            min="1" max="100"
            value={numRows}
            onChange={(e) => setNumRows(Math.min(100, parseInt(e.target.value) || 50))}
            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
          />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">Filename</div>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
          />
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleGenerate}
          disabled={loading || !description.trim()}
          className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-4 py-1.5 disabled:opacity-50"
        >
          {loading ? 'Asking Claude...' : `Generate ${numRows} rows with AI`}
        </button>
      </div>
    </div>
  )
}
