// ============================================================================
// AvatarMenu.jsx
// ============================================================================
// The profile "chip" that sits at the bottom of the app sidebar. Click it
// and a small popover shows: user info, dark mode toggle, Settings link,
// Log out.
//
// Props:
//   user     : { id, email, name } — the logged-in user
//   onLogout : () => void — called after a successful logout
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout as logoutApi } from '../api/auth.js'
import { useUserPrefs } from '../contexts/UserPrefsContext.jsx'

export default function AvatarMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const navigate = useNavigate()
  const { theme, setTheme, avatar } = useUserPrefs()

  // Close the popover when clicking outside it.
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function handleLogout() {
    try {
      await logoutApi()
    } catch {
      // Even if the server call fails, kick the user back to /login.
    }
    onLogout()
  }

  const isDark = theme === 'dark'

  return (
    <div ref={wrapperRef} className="relative">
      {/* The trigger — the user's avatar + name */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-lg">
          {avatar}
        </span>
        <span className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {user.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {user.email}
          </div>
        </span>
      </button>

      {/* The popover */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          {/* Dark mode toggle row */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <span className="flex items-center gap-2">
              <span>{isDark ? '☀️' : '🌙'}</span>
              <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
            </span>
            {/* A little pill to show it's a toggle */}
            <span
              className={`w-8 h-4 rounded-full relative transition-colors ${
                isDark ? 'bg-brand-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                  isDark ? 'left-4' : 'left-0.5'
                }`}
              />
            </span>
          </button>

          {/* Settings link */}
          <button
            onClick={() => {
              setOpen(false)
              navigate('/settings')
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <span>⚙️</span>
            <span>Settings</span>
          </button>

          {/* Logout — separated by a divider */}
          <div className="border-t border-gray-200 dark:border-gray-700" />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <span>↪</span>
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  )
}
