// ============================================================================
// layouts/AppShell.jsx
// ============================================================================
// The outer frame that wraps every "app" page (Dashboard, Projects, Files,
// Settings). The project workspace (/project/:id) does NOT use this layout
// because it has its own full-screen UI with a different sidebar.
//
// Uses React Router's <Outlet /> so each child route renders inside the
// main content area.
// ============================================================================

import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar.jsx'

export default function AppShell({ user, onLogout }) {
  return (
    <div className="min-h-screen flex bg-stone-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar user={user} onLogout={onLogout} />

      {/* Main content — the child route renders here */}
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet context={{ user }} />
      </main>
    </div>
  )
}
