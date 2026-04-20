// ============================================================================
// TopBar.jsx
// ============================================================================
// The top navigation bar. Shows the SimuCast logo and optional project name
// on the left, and user info + action buttons on the right.
//
// Both DashboardPage and ProjectPage currently inline their own top bars
// for flexibility. This component is here if you want to swap them over
// to a single shared bar — which becomes more valuable as features grow.
//
// Props:
//   projectName — optional; shown as a breadcrumb next to the logo
//   userName    — user's display name
//   onLogout    — called when the user clicks Logout
//   children    — extra buttons to show on the right (Save, Export, etc.)
// ============================================================================

import { useNavigate } from 'react-router-dom'


export default function TopBar({ projectName, userName, onLogout, children }) {
  const navigate = useNavigate()

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">

      {/* Left side: logo + optional project name */}
      <div className="flex items-center gap-2.5">
        <div
          onClick={() => navigate('/')}
          className="w-6 h-6 rounded-md bg-brand-500 text-white flex items-center justify-center text-xs font-medium cursor-pointer"
          title="Back to dashboard"
        >
          S
        </div>
        <span className="text-sm font-medium">SimuCast</span>
        {projectName && (
          <span className="text-sm text-gray-400">/ {projectName}</span>
        )}
      </div>

      {/* Right side: actions + user */}
      <div className="flex items-center gap-3">
        {children}

        {userName && (
          <>
            <span className="text-xs text-gray-500">{userName}</span>
            <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-medium">
              {userName.charAt(0).toUpperCase()}
            </div>
          </>
        )}

        {onLogout && (
          <button
            onClick={onLogout}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  )
}
