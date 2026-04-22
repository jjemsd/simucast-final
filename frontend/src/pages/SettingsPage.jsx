// ============================================================================
// SettingsPage.jsx
// ============================================================================
// Basic account page. Two things land here today:
//   - a read-only "Account" card showing your name + email
//   - an avatar picker (emoji) that saves to localStorage per user
//
// Dark mode lives in the avatar menu (bottom-left), not here, because it's
// used often and needs to be one click away.
// ============================================================================

import { useOutletContext } from 'react-router-dom'
import { useUserPrefs } from '../contexts/UserPrefsContext.jsx'
import AvatarPicker from '../components/AvatarPicker.jsx'

export default function SettingsPage() {
  const { user } = useOutletContext()
  const { avatar, setAvatar } = useUserPrefs()

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
        Settings
      </h1>

      {/* Account card */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Account
        </h2>
        <div className="flex items-center gap-4">
          <span className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-3xl">
            {avatar}
          </span>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {user.name}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {user.email}
            </div>
          </div>
        </div>
      </section>

      {/* Avatar picker */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Avatar
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Pick an emoji for your profile. Your choice is saved on this device.
        </p>
        <AvatarPicker value={avatar} onChange={setAvatar} />
      </section>
    </div>
  )
}
