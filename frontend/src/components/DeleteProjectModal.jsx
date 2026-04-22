// ============================================================================
// DeleteProjectModal.jsx
// ============================================================================
// A custom confirm dialog for deleting a project, with an optional
// "Also delete uploaded files" checkbox. When the checkbox is on, files
// that are also used by OTHER projects are automatically kept — the modal
// calls those out so the user knows what's happening.
//
// Props:
//   open       : boolean
//   onClose    : () => void
//   project    : { id, name }           — the project being deleted
//   files      : [{ id, original_filename, shared_with_other_projects }]
//   onConfirm  : ({ deleteFiles }) => Promise<void>
// ============================================================================

import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'

export default function DeleteProjectModal({ open, onClose, project, files, onConfirm }) {
  const [alsoDeleteFiles, setAlsoDeleteFiles] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setAlsoDeleteFiles(false)
      setLoading(false)
      setError('')
    }
  }, [open])

  async function handleConfirm() {
    setLoading(true)
    setError('')
    try {
      await onConfirm({ deleteFiles: alsoDeleteFiles })
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not delete')
    } finally {
      setLoading(false)
    }
  }

  const safeCount = files.filter((f) => f.shared_with_other_projects === 0).length
  const sharedCount = files.filter((f) => f.shared_with_other_projects > 0).length

  return (
    <Modal open={open} onClose={onClose} title="Delete project?">
      <div className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        This permanently deletes <strong>{project?.name}</strong> and all of
        its analyses and timeline steps. This cannot be undone.
      </div>

      {/* Only show the file section when the project actually has files. */}
      {files.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-md p-3 mb-4 bg-gray-50 dark:bg-gray-900/40">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={alsoDeleteFiles}
              onChange={(e) => setAlsoDeleteFiles(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-gray-700 dark:text-gray-200">
              Also delete {safeCount} uploaded file
              {safeCount === 1 ? '' : 's'}
            </span>
          </label>

          {sharedCount > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 pl-6">
              {sharedCount} file{sharedCount === 1 ? ' is' : 's are'} also used
              by other projects and will be kept.
            </div>
          )}

          {alsoDeleteFiles && safeCount > 0 && (
            <ul className="text-xs text-gray-500 dark:text-gray-400 mt-2 pl-6 list-disc">
              {files
                .filter((f) => f.shared_with_other_projects === 0)
                .map((f) => (
                  <li key={f.id} className="truncate">
                    {f.original_filename}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

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
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="text-sm bg-red-600 hover:bg-red-700 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
        >
          {loading ? 'Deleting...' : 'Delete project'}
        </button>
      </div>
    </Modal>
  )
}
