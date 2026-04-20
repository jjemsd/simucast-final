// ============================================================================
// Timeline.jsx
// ============================================================================
// Session history panel showing every step the user has taken on a project.
// Clicking the X on any step rolls back to that point.
//
// For V1 this is a display-only component. The rollback API (/api/history/*)
// is still a stub — we'll wire it up in a later week.
//
// Props:
//   steps — array of step objects from the backend:
//           [ { id, step_type, title, order_index, reverted, created_at }, ... ]
//   onRollback — function called with a step when the user clicks its X
// ============================================================================

// Map step_type → nice label + color for visual scanning
const STEP_STYLES = {
  import:        { label: 'Import',   cls: 'bg-brand-50 text-brand-700' },
  clean_missing: { label: 'Clean',    cls: 'bg-blue-50 text-blue-700' },
  recode:        { label: 'Recode',   cls: 'bg-purple-50 text-purple-700' },
  compute:       { label: 'Compute',  cls: 'bg-green-50 text-green-700' },
  descriptives:  { label: 'Stats',    cls: 'bg-gray-50 text-gray-700' },
  t_test:        { label: 'Test',     cls: 'bg-amber-50 text-amber-700' },
  model_fit:     { label: 'Model',    cls: 'bg-pink-50 text-pink-700' },
  scenario:      { label: 'Scenario', cls: 'bg-teal-50 text-teal-700' },
}


export default function Timeline({ steps = [], onRollback }) {

  if (steps.length === 0) {
    return (
      <div className="text-xs text-gray-400 italic py-4">
        No steps yet. Every action you take will show up here.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Newest first */}
      {steps.slice().reverse().map((step) => {
        const style = STEP_STYLES[step.step_type] || {
          label: step.step_type,
          cls: 'bg-gray-50 text-gray-700',
        }
        const time = new Date(step.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })

        return (
          <div
            key={step.id}
            className={
              'border border-gray-200 rounded-md p-2.5 bg-white ' +
              (step.reverted ? 'opacity-40 line-through' : '')
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={'text-[10px] px-1.5 py-0.5 rounded font-medium ' + style.cls}>
                    {style.label}
                  </span>
                  <span className="text-[10px] text-gray-400">{time}</span>
                </div>
                <div className="text-xs text-gray-700 truncate">{step.title}</div>
              </div>

              {/* X button — only for un-reverted steps */}
              {!step.reverted && (
                <button
                  onClick={() => onRollback?.(step)}
                  className="text-gray-400 hover:text-red-600 text-sm leading-none"
                  title="Roll back to before this step"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
