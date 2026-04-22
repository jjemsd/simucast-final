// ============================================================================
// DashboardPage.jsx
// ============================================================================
// The home screen after login. Shows:
//   - a greeting
//   - up to 6 recent projects as cards, with a "View all →" link
//   - up to 6 recent files, with a "View all →" link
//
// The full project list lives on /projects, the full file list on /files.
// ============================================================================

import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, Link } from 'react-router-dom'
import { listProjects, createProject } from '../api/projects.js'
import { listAllDatasets } from '../api/data.js'
import NewProjectModal from '../components/NewProjectModal.jsx'

const MAX_RECENT = 6

export default function DashboardPage() {
  const { user } = useOutletContext()
  const navigate = useNavigate()

  const [projects, setProjects] = useState([])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [newOpen, setNewOpen] = useState(false)

  useEffect(() => {
    // Load both lists in parallel. We only display the first MAX_RECENT.
    Promise.all([listProjects(), listAllDatasets()])
      .then(([p, d]) => {
        setProjects(p)
        setFiles(d)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(name, description) {
    const project = await createProject(name, description)
    navigate(`/project/${project.id}`)
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = user.name.split(' ')[0]

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Greeting row */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-md px-4 py-2"
        >
          + New project
        </button>
      </div>

      {/* Recent projects */}
      <SectionHeader title="Recent projects" linkTo="/projects" />
      {loading ? (
        <SkeletonCards />
      ) : projects.length === 0 ? (
        <EmptyCard
          message="No projects yet"
          actionLabel="+ Create your first project"
          onAction={() => setNewOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
          {projects.slice(0, MAX_RECENT).map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => navigate(`/project/${p.id}`)}
            />
          ))}
        </div>
      )}

      {/* Recent files */}
      <SectionHeader title="Recent files" linkTo="/files" />
      {loading ? (
        <SkeletonCards />
      ) : files.length === 0 ? (
        <EmptyCard message="No files yet — upload one inside a project" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.slice(0, MAX_RECENT).map((f) => (
            <FileCard
              key={f.id}
              file={f}
              onClick={() => navigate(`/project/${f.project_id}`)}
            />
          ))}
        </div>
      )}

      <NewProjectModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}


// ============================================================================
// Small helper components scoped to this page
// ============================================================================

function SectionHeader({ title, linkTo }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h2>
      <Link
        to={linkTo}
        className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
      >
        View all →
      </Link>
    </div>
  )
}

function SkeletonCards() {
  // Three grey placeholder cards while the request is in flight.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-24 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg animate-pulse"
        />
      ))}
    </div>
  )
}

function EmptyCard({ message, actionLabel, onAction }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center mb-10">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{message}</p>
      {actionLabel && (
        <button
          onClick={onAction}
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function ProjectCard({ project, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 cursor-pointer hover:border-brand-400 dark:hover:border-brand-500 transition-colors"
    >
      <div className="flex justify-between items-start mb-1.5">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {project.name}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-2">
          {new Date(project.updated_at).toLocaleDateString()}
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
        {project.description || 'No description'}
      </p>
    </div>
  )
}

function FileCard({ file, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 cursor-pointer hover:border-brand-400 dark:hover:border-brand-500 transition-colors"
    >
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-1">
        {file.original_filename}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {file.row_count} rows · {file.column_count} columns
      </div>
      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        in {file.project_name}
      </div>
    </div>
  )
}
