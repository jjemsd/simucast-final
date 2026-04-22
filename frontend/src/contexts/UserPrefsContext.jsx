// ============================================================================
// contexts/UserPrefsContext.jsx
// ============================================================================
// One place for small, per-user UI preferences that don't need to live on
// the server yet:
//   - theme       : 'light' | 'dark'
//   - avatar      : an emoji string (e.g. '🧑‍🎓')
//
// Everything is saved to localStorage so it survives page reloads.
// Keys are namespaced by the user's id so two accounts on the same
// browser don't stomp on each other.
//
// Usage:
//   const { theme, setTheme, avatar, setAvatar } = useUserPrefs()
// ============================================================================

import { createContext, useContext, useEffect, useState } from 'react'

const UserPrefsContext = createContext(null)

// The one list of avatars we offer in Settings. All standard Unicode
// emojis, so they're free to use and render on every OS font.
export const AVATAR_OPTIONS = [
  '🧑', '👨', '👩',
  '🧑‍🎓', '👨‍🎓', '👩‍🎓',
  '🧑‍💻', '👨‍💻', '👩‍💻',
  '🧑‍🔬', '👨‍🔬', '👩‍🔬',
  '🧑‍💼', '👨‍💼', '👩‍💼',
  '🧑‍🚀', '👨‍🚀', '👩‍🚀',
  '🧔', '🧔‍♀️',
  '👨‍🦰', '👩‍🦰',
  '👨‍🦳', '👩‍🦳',
]

function readLS(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v == null ? fallback : v
  } catch {
    return fallback
  }
}

function writeLS(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private-mode browsers etc. — just ignore */
  }
}

export function UserPrefsProvider({ user, children }) {
  // Namespace keys by user id, with a "guest" bucket for the login page.
  const ns = user?.id ? `u${user.id}` : 'guest'
  const themeKey = `prefs:${ns}:theme`
  const avatarKey = `prefs:${ns}:avatar`

  const [theme, setThemeState] = useState(() => readLS(themeKey, 'light'))
  const [avatar, setAvatarState] = useState(() => readLS(avatarKey, '🧑'))

  // Whenever the theme changes, toggle the `dark` class on <html>.
  // Tailwind's `dark:` utilities key off that class.
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [theme])

  // If the user changes (login / logout), reload the saved prefs for the
  // new user id.
  useEffect(() => {
    setThemeState(readLS(themeKey, 'light'))
    setAvatarState(readLS(avatarKey, '🧑'))
  }, [themeKey, avatarKey])

  function setTheme(next) {
    setThemeState(next)
    writeLS(themeKey, next)
  }

  function setAvatar(next) {
    setAvatarState(next)
    writeLS(avatarKey, next)
  }

  const value = { theme, setTheme, avatar, setAvatar }
  return (
    <UserPrefsContext.Provider value={value}>
      {children}
    </UserPrefsContext.Provider>
  )
}

export function useUserPrefs() {
  const ctx = useContext(UserPrefsContext)
  if (!ctx) {
    throw new Error('useUserPrefs must be used inside <UserPrefsProvider>')
  }
  return ctx
}
