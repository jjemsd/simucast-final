// ============================================================================
// ColumnHeaderMenu.jsx
// ============================================================================
// Small dropdown that appears next to a column name in the data table.
//
// Props:
//   open       : boolean
//   onClose    : () => void (called when the user clicks outside)
//   onAction   : (action) => void where action is one of:
//                  'rename' | 'convertType' | 'delete'
// ============================================================================

import { useEffect, useRef } from 'react'

export default function ColumnHeaderMenu({ open, onClose, onAction }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    // Use capture so we see the click before other handlers stop propagation.
    document.addEventListener('mousedown', handleClick, true)
    return () => document.removeEventListener('mousedown', handleClick, true)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 z-30 mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden"
    >
      <Item onClick={() => onAction('convertType')} icon="↔">
        Change data type
      </Item>
      <Item onClick={() => onAction('rename')} icon="✎">
        Rename column
      </Item>
      <div className="border-t border-gray-100" />
      <Item onClick={() => onAction('delete')} danger icon="🗑">
        Delete column
      </Item>
    </div>
  )
}

function Item({ children, onClick, icon, danger }) {
  return (
    <button
      onClick={onClick}
      className={
        'w-full flex items-center gap-2 px-3 py-2 text-left text-xs ' +
        (danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-gray-700 hover:bg-gray-50')
      }
    >
      <span className="w-3 text-center">{icon}</span>
      <span>{children}</span>
    </button>
  )
}
