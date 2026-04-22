// ============================================================================
// ConfirmModal.jsx
// ============================================================================
// A reusable "are you sure?" dialog. Replaces window.confirm() so we can
// style it consistently (and support dark mode).
//
// Props:
//   open         : boolean
//   onClose      : () => void — called when the user cancels or succeeds
//   title        : string
//   message      : string | ReactNode — body text (can include <strong>, etc.)
//   confirmLabel : string (default "Confirm")
//   cancelLabel  : string (default "Cancel")
//   danger       : boolean — if true, the confirm button is red (for destructive actions)
//   onConfirm    : () => Promise<void> | void
// ============================================================================

import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'

export default function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setLoading(false)
      setError('')
    }
  }, [open])

  async function handleConfirm() {
    setLoading(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const confirmClasses = danger
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-brand-500 hover:bg-brand-600 text-white'

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-sm text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">
        {message}
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-md px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="text-sm border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className={`text-sm rounded-md px-3 py-1.5 disabled:opacity-50 ${confirmClasses}`}
        >
          {loading ? 'Working...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
