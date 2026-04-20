import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProjectPage from './pages/ProjectPage.jsx'
import { getCurrentUser } from './api/auth.js'

export default function App() {
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

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" /> : <LoginPage onLogin={setUser} />}
      />
      <Route
        path="/"
        element={user ? <DashboardPage user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" />}
      />
      <Route
        path="/project/:projectId"
        element={user ? <ProjectPage user={user} /> : <Navigate to="/login" />}
      />
    </Routes>
  )
}
