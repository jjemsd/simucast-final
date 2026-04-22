// ============================================================================
// RenameModal.jsx
// ============================================================================
// A small modal with a single text input. Used for renaming a project.
//
// Props:
//   open       : boolean
//   onClose    : () => void
//   title      : string (e.g. "Rename project")
//   initialValue : string
//   onSubmit   : (newName) => Promise<void>
// ============================================================================

import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'

export default function RenameModal({ open, onClose, title, initialValue, onSubmit }) {
  const [value, setValue] = useState(initialValue || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Reset the input whenever the modal opens (or the initial value changes).
  useEffect(() => {
    if (open) {
      setValue(initialValue || '')
      setError('')
      setLoading(false)
    }
  }, [open, initialValue])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Name cannot be empty')
      return
    }
    if (trimmed === initialValue) {
      // Nothing changed — just close.
      onClose()
      return
    }
    setLoading(true)
    setError('')
    try {
      await onSubmit(trimmed)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
          maxLength={120}
        />

        {error && (
          <div className="text-sm text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
