// ============================================================================
// DashboardPage.jsx
// ============================================================================
// The home screen after login. Shows a greeting, lifetime stats, and
// recent projects. Clicking a project opens ProjectPage.
// ============================================================================

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listProjects, createProject } from '../api/projects.js'
import { logout } from '../api/auth.js'

export default function DashboardPage({ user, onLogout }) {
  // --- State ---
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  // useNavigate lets us programmatically change the URL
  const navigate = useNavigate()

  // --- Load projects on mount ---
  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // --- Handler: create a new project ---
  async function handleNewProject() {
    const name = prompt('Project name?')  // simple for V1 — replace with modal later
    if (!name?.trim()) return

    try {
      const project = await createProject(name.trim())
      // Jump straight into the new project
      navigate(`/project/${project.id}`)
    } catch (err) {
      alert('Could not create project: ' + (err.response?.data?.error || err.message))
    }
  }

  // --- Handler: log out ---
  async function handleLogout() {
    await logout()
    onLogout()
  }

  // --- Greeting based on time of day ---
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-screen bg-stone-50">

      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-brand-500 text-white flex items-center justify-center text-xs font-medium">S</div>
          <span className="text-sm font-medium">SimuCast</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{user.name}</span>
          <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-medium">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="grid" style={{ gridTemplateColumns: '150px 1fr' }}>

        {/* Left sidebar — app-level nav (differs from project workspace) */}
        <aside className="bg-white border-r border-gray-200 p-3 min-h-[calc(100vh-45px)]">
          <nav className="flex flex-col gap-0.5">
            <div className="px-2.5 py-2 text-xs font-medium bg-brand-100 text-brand-700 rounded-md">
              Home
            </div>
            <div className="px-2.5 py-2 text-xs text-gray-500">Projects</div>
            <div className="px-2.5 py-2 text-xs text-gray-500">Datasets</div>
            <div className="px-2.5 py-2 text-xs text-gray-500">Templates</div>
            <div className="px-2.5 py-2 text-xs text-gray-500">Settings</div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="p-6">

          {/* Greeting row */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-lg font-medium">{greeting}, {user.name}</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <button
              onClick={handleNewProject}
              className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3.5 py-1.5"
            >
              + New project
            </button>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-2.5 mb-6">
            <StatCard label="Projects" value={projects.length} />
            <StatCard label="Analyses" value="—" />
            <StatCard label="Models" value="—" />
            <StatCard label="Reports" value="—" />
          </div>

          {/* Recent projects */}
          <h2 className="text-sm font-medium mb-2.5">Recent projects</h2>

          {loading ? (
            <div className="text-sm text-gray-400 py-8">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-md p-8 text-center">
              <p className="text-sm text-gray-500 mb-2">No projects yet</p>
              <button
                onClick={handleNewProject}
                className="text-sm text-brand-600 hover:underline"
              >
                + Create your first project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 mb-6">
              {projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/project/${p.id}`)}
                  className="bg-white border border-gray-200 rounded-md p-3.5 cursor-pointer hover:border-brand-300"
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-[10px] text-gray-400">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-1">
                    {p.description || 'No description'}
                  </p>
                </div>
              ))}

              {/* Dashed "new project" card */}
              <div
                onClick={handleNewProject}
                className="bg-white border border-dashed border-gray-300 rounded-md p-3.5 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-brand-400"
              >
                <span className="text-lg text-gray-400">+</span>
                <span className="text-xs text-gray-500">Start a new project</span>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}


// --- Small helper component (scoped to this page) ---
function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-xl font-medium">{value}</div>
    </div>
  )
}
