// ============================================================================
// NewProjectModal.jsx
// ============================================================================
// Replaces the native window.prompt('Project name?') with a proper modal.
//
// Props:
//   open      : boolean
//   onClose   : () => void
//   onCreate  : (name, description) => Promise<void>  (caller handles the API call + navigation)
// ============================================================================

import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'

export default function NewProjectModal({ open, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Clear the form every time the modal opens fresh.
  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setError('')
      setLoading(false)
    }
  }, [open])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter a name')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onCreate(trimmed, description.trim())
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New project">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-xs text-gray-600 dark:text-gray-300 -mb-2">Name</label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Titanic survival analysis"
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
          maxLength={120}
        />

        <label className="text-xs text-gray-600 dark:text-gray-300 -mb-2">
          Description <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this project about?"
          rows={3}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500 resize-none"
          maxLength={500}
        />

        {error && (
          <div className="text-sm text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
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
            {loading ? 'Creating...' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
