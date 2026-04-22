// ============================================================================
// Sidebar.jsx
// ============================================================================
// The app-level left sidebar. Shows the logo up top, nav links in the
// middle, and the AvatarMenu pinned to the bottom.
//
// Only the three "app" routes (Dashboard, Projects, Files) live here —
// the project workspace has its own separate narrow sidebar.
// ============================================================================

import { NavLink } from 'react-router-dom'
import AvatarMenu from './AvatarMenu.jsx'

// One row per nav link. `emoji` is just a visual hint (feel free to
// swap for a real icon library later).
const NAV_ITEMS = [
  { to: '/',         label: 'Dashboard', emoji: '🏠', end: true },
  { to: '/projects', label: 'Projects',  emoji: '📁' },
  { to: '/files',    label: 'Files',     emoji: '📄' },
]

export default function Sidebar({ user, onLogout }) {
  return (
    <aside className="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Logo / app name */}
      <div className="px-4 py-4 flex items-center gap-2 border-b border-gray-200 dark:border-gray-800">
        <div className="w-7 h-7 rounded-md bg-brand-500 text-white flex items-center justify-center text-sm font-semibold">
          S
        </div>
        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
          SimuCast
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            // NavLink passes { isActive } so we can highlight the current route
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`
            }
          >
            <span className="text-base">{item.emoji}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Avatar menu pinned to the bottom */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-800">
        <AvatarMenu user={user} onLogout={onLogout} />
      </div>
    </aside>
  )
}
