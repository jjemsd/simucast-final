// ============================================================================
// Modal.jsx
// ============================================================================
// A simple modal dialog. Used for the full data preview, scenario save,
// synthetic data generator, etc.
//
// Props:
//   open      — boolean: is the modal visible?
//   onClose   — function called when the user clicks the X or the backdrop
//   title     — heading shown at the top
//   children  — modal body content
//   maxWidth  — e.g. "600px" (default "500px")
// ============================================================================

export default function Modal({ open, onClose, title, children, maxWidth = '500px' }) {
  // Don't render anything when closed (keeps the DOM clean)
  if (!open) return null

  return (
    <>
      {/* Dimmed backdrop — clicking it closes the modal */}
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={onClose}
      />

      {/* The modal itself — centered on the screen */}
      <div
        className="fixed top-1/2 left-1/2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-xl z-50 w-full max-h-[85vh] overflow-auto"
        style={{
          transform: 'translate(-50%, -50%)',
          maxWidth,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body (whatever children the caller passed in) */}
        <div className="p-4 text-gray-900 dark:text-gray-100">
          {children}
        </div>
      </div>
    </>
  )
}
