// ============================================================================
// IconSidebar.jsx
// ============================================================================
// The left sidebar inside the project workspace. One row per module
// (Data, Clean, Stats, ...). Clicking swaps the active view.
//
// The user can drag the right edge to resize it. The chosen width is
// persisted to localStorage so it sticks across sessions.
// ============================================================================

import { useEffect, useRef, useState } from 'react'

// List of modules — order matters (matches the typical user flow).
// Emoji column is a lightweight icon so the sidebar reads well at both
// narrow (~56px) and wide (~240px) widths.
const MODULES = [
  { id: 'data',   label: 'Data',    icon: '📊' },
  { id: 'clean',  label: 'Clean',   icon: '🧼' },
  { id: 'expand', label: 'Expand',  icon: '➕' },
  { id: 'stats',  label: 'Stats',   icon: '📈' },
  { id: 'tests',  label: 'Tests',   icon: '🧪' },
  { id: 'model',  label: 'Model',   icon: '🧠' },
  { id: 'whatif', label: 'What-if', icon: '🔮' },
  { id: 'report', label: 'Report',  icon: '📄' },
]

const MIN_WIDTH = 56
const MAX_WIDTH = 280
const STORAGE_KEY = 'workspace:sidebarWidth'

function readStoredWidth() {
  try {
    const v = parseInt(localStorage.getItem(STORAGE_KEY), 10)
    if (Number.isFinite(v)) return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, v))
  } catch { /* ignore */ }
  return 160  // reasonable default — wide enough to show labels comfortably
}

export default function IconSidebar({ activeModule, onChange }) {
  const [width, setWidth] = useState(readStoredWidth)
  const dragging = useRef(false)

  // Mouse-drag resize. We listen on the window so dragging continues
  // even if the cursor leaves the handle.
  useEffect(() => {
    function handleMove(e) {
      if (!dragging.current) return
      // Clamp between min and max; e.clientX is distance from viewport left,
      // which is exactly the sidebar width we want since the sidebar is at x=0.
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX))
      setWidth(next)
    }
    function handleUp() {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [])

  // Persist width whenever it changes.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(width)) } catch { /* ignore */ }
  }, [width])

  function startDrag(e) {
    e.preventDefault()
    dragging.current = true
    // Match cursor + disable text selection for the drag.
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // Collapsed-ish mode when narrow: center the icon, hide the label.
  const narrow = width < 100

  return (
    <aside
      // inline style because the width is dynamic; everything else is Tailwind
      style={{ width }}
      className="relative shrink-0 bg-white border-r border-gray-200 py-2 flex flex-col gap-0.5"
    >
      {MODULES.map((mod) => {
        const isActive = activeModule === mod.id
        return (
          <button
            key={mod.id}
            onClick={() => onChange(mod.id)}
            title={narrow ? mod.label : undefined}
            className={
              (narrow
                ? 'flex flex-col items-center justify-center py-2 gap-0.5 text-[11px] '
                : 'flex items-center gap-2.5 px-3 py-2 text-sm ') +
              'transition-colors border-l-2 ' +
              (isActive
                ? 'bg-brand-100 text-brand-700 font-medium border-brand-500'
                : 'text-gray-600 hover:bg-gray-50 border-transparent')
            }
          >
            <span className={narrow ? 'text-lg leading-none' : 'text-base'}>
              {mod.icon}
            </span>
            <span className={narrow ? 'leading-none' : ''}>{mod.label}</span>
          </button>
        )
      })}

      {/* Drag handle — a thin column on the right edge. Its visual size is
          1px but the hit area is wider so it's easy to grab. */}
      <div
        onMouseDown={startDrag}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize group"
        title="Drag to resize"
      >
        <div className="absolute right-0 top-0 h-full w-px bg-transparent group-hover:bg-brand-300 transition-colors" />
      </div>
    </aside>
  )
}
