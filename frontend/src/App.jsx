import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProjectsPage from './pages/ProjectsPage.jsx'
import FilesPage from './pages/FilesPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import ProjectPage from './pages/ProjectPage.jsx'

import AppShell from './layouts/AppShell.jsx'
import { UserPrefsProvider } from './contexts/UserPrefsContext.jsx'
import { getCurrentUser } from './api/auth.js'

export default function App() {
  // `undefined` = still checking, `null` = not logged in, object = logged in
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    getCurrentUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
  }, [])

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500 text-sm">
        Loading...
      </div>
    )
  }

  function handleLogout() {
    setUser(null)
  }

  return (
    <UserPrefsProvider user={user}>
      <Routes>
        {/* Public route */}
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <LoginPage onLogin={setUser} />}
        />

        {/* App shell — wraps the main navigation pages */}
        <Route
          element={
            user ? (
              <AppShell user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" />
            )
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Project workspace — full-screen, no shell */}
        <Route
          path="/project/:projectId"
          element={user ? <ProjectPage user={user} /> : <Navigate to="/login" />}
        />

        {/* Anything else — bounce to the dashboard (or login) */}
        <Route path="*" element={<Navigate to={user ? '/' : '/login'} />} />
      </Routes>
    </UserPrefsProvider>
  )
}
