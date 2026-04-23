// ============================================================================
// TypeConvertModal.jsx
// ============================================================================
// Lets the user pick a new logical type for a column. When the chosen
// type is 'date', an optional format input appears so the user can tell
// pandas how to parse the incoming strings (e.g. "%Y-%m-%d").
//
// Props:
//   open        : boolean
//   onClose     : () => void
//   column      : string — the column being converted
//   currentType : string — pandas dtype (e.g. "object", "int64")
//   onSubmit    : ({ targetType, dateFormat }) => Promise<void>
// ============================================================================

import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'

const TYPE_OPTIONS = [
  { value: 'str',   label: 'Text (string)',        hint: 'Treat every value as text.' },
  { value: 'int',   label: 'Whole number (int)',   hint: 'Round and convert to integer. Non-numbers become nulls.' },
  { value: 'float', label: 'Decimal (float)',      hint: 'Convert to decimal. Non-numbers become nulls.' },
  { value: 'date',  label: 'Date',                 hint: 'Parse as a calendar date. Unparseable values become nulls.' },
  { value: 'bool',  label: 'True/False (bool)',    hint: 'Yes/no, 1/0, true/false get mapped; anything else becomes null.' },
]

export default function TypeConvertModal({ open, onClose, column, currentType, onSubmit }) {
  const [targetType, setTargetType] = useState('str')
  const [dateFormat, setDateFormat] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setTargetType('str')
      setDateFormat('')
      setError('')
      setLoading(false)
    }
  }, [open])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onSubmit({
        targetType,
        dateFormat: targetType === 'date' && dateFormat.trim()
          ? dateFormat.trim()
          : null,
      })
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Conversion failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Change type — ${column || ''}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="text-xs text-gray-500">
          Current type: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{currentType || '—'}</code>
        </div>

        <div className="flex flex-col gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={
                'flex items-start gap-2 border rounded-md p-2.5 cursor-pointer transition-colors ' +
                (targetType === opt.value
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:bg-gray-50')
              }
            >
              <input
                type="radio"
                name="target-type"
                value={opt.value}
                checked={targetType === opt.value}
                onChange={() => setTargetType(opt.value)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">
                  {opt.label}
                </span>
                <span className="block text-xs text-gray-500">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {targetType === 'date' && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Date format{' '}
              <span className="text-gray-400">(optional — leave blank to auto-detect)</span>
            </label>
            <input
              type="text"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              placeholder="e.g. %Y-%m-%d or %d/%m/%Y"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
        )}

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <p className="text-xs text-gray-500">
          Values that can't be converted will become nulls and counted
          as errors in the timeline step.
        </p>

        <div className="flex justify-end gap-2 mt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
          >
            {loading ? 'Converting...' : 'Convert'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
