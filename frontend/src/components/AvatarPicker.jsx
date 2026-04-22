// ============================================================================
// AvatarPicker.jsx
// ============================================================================
// A grid of emoji avatars. Clicking one selects it and calls onChange.
// The currently-selected avatar is highlighted with a ring.
//
// Props:
//   value     : string — the currently selected emoji
//   onChange  : (emoji) => void
// ============================================================================

import { AVATAR_OPTIONS } from '../contexts/UserPrefsContext.jsx'

export default function AvatarPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {AVATAR_OPTIONS.map((emoji) => {
        const selected = emoji === value
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className={`aspect-square flex items-center justify-center text-2xl rounded-lg transition-all ${
              selected
                ? 'bg-brand-100 dark:bg-brand-900/40 ring-2 ring-brand-500'
                : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            aria-label={`Select avatar ${emoji}`}
            aria-pressed={selected}
          >
            {emoji}
          </button>
        )
      })}
    </div>
  )
}
