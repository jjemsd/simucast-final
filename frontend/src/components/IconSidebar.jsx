// ============================================================================
// IconSidebar.jsx
// ============================================================================
// The 60px navigation on the left of ProjectPage.
//
// Each item represents a module/view. Clicking swaps activeModule in the
// parent component, which re-renders the main canvas.
// ============================================================================

// List of modules — order matters (matches the typical user flow)
// id is the internal name, label is what the user sees
const MODULES = [
  { id: 'data',    label: 'Data' },
  { id: 'clean',   label: 'Clean' },
  { id: 'expand',  label: 'Expand' },
  { id: 'stats',   label: 'Stats' },
  { id: 'tests',   label: 'Tests' },
  { id: 'model',   label: 'Model' },
  { id: 'whatif',  label: 'What-if' },
  { id: 'report',  label: 'Report' },
]


export default function IconSidebar({ activeModule, onChange }) {
  return (
    <aside className="bg-white border-r border-gray-200 py-3 flex flex-col gap-0.5">
      {MODULES.map((mod) => {
        const isActive = activeModule === mod.id
        return (
          <button
            key={mod.id}
            onClick={() => onChange(mod.id)}
            className={
              'py-2 text-[10px] text-center transition-colors ' +
              (isActive
                ? 'bg-brand-100 text-brand-700 font-medium border-l-2 border-brand-500'
                : 'text-gray-500 hover:bg-gray-50 border-l-2 border-transparent')
            }
          >
            {mod.label}
          </button>
        )
      })}
    </aside>
  )
}
