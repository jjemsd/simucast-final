// ============================================================================
// ProjectsPage.jsx
// ============================================================================
// The full list of the current user's projects. Supports creating new
// projects, renaming, and deleting.
//
// Delete confirms with a dialog — deleting a project permanently removes
// its datasets and timeline steps too (see Project model cascade).
// ============================================================================

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
} from '../api/projects.js'
import NewProjectModal from '../components/NewProjectModal.jsx'
import RenameModal from '../components/RenameModal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'

export default function ProjectsPage() {
  const navigate = useNavigate()

  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  // Which modal (if any) is open, and which project it's acting on.
  const [newOpen, setNewOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Which project's action menu is open (the "⋯" button on a card).
  const [menuOpenFor, setMenuOpenFor] = useState(null)

  useEffect(() => {
    reload()
  }, [])

  function reload() {
    setLoading(true)
    listProjects()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  async function handleCreate(name, description) {
    const project = await createProject(name, description)
    navigate(`/project/${project.id}`)
  }

  async function handleRename(newName) {
    await updateProject(renameTarget.id, { name: newName })
    reload()
  }

  async function handleDelete() {
    await deleteProject(deleteTarget.id)
    reload()
  }

  // Filter projects client-side by the search box. Case-insensitive.
  const filtered = query.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : projects

  return (
    <div
      className="p-8 max-w-6xl mx-auto"
      // Clicking anywhere in the page (that isn't a menu button) closes
      // whichever card menu is open.
      onClick={() => setMenuOpenFor(null)}
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Projects
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-md px-4 py-2"
        >
          + New project
        </button>
      </div>

      {/* Search box */}
      <input
        type="text"
        placeholder="Search projects..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full sm:max-w-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500 mb-5"
      />

      {loading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {query ? 'No projects match your search' : 'No projects yet'}
          </p>
          {!query && (
            <button
              onClick={() => setNewOpen(true)}
              className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
            >
              + Create your first project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              menuOpen={menuOpenFor === p.id}
              onMenuToggle={(e) => {
                // Stop propagation so the outer page click handler doesn't
                // immediately close the menu we just opened.
                e.stopPropagation()
                setMenuOpenFor(menuOpenFor === p.id ? null : p.id)
              }}
              onOpen={() => navigate(`/project/${p.id}`)}
              onRename={() => {
                setMenuOpenFor(null)
                setRenameTarget(p)
              }}
              onDelete={() => {
                setMenuOpenFor(null)
                setDeleteTarget(p)
              }}
            />
          ))}
        </div>
      )}

      <NewProjectModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={handleCreate}
      />

      <RenameModal
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="Rename project"
        initialValue={renameTarget?.name || ''}
        onSubmit={handleRename}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete project?"
        message={
          <span>
            This will permanently delete <strong>{deleteTarget?.name}</strong>{' '}
            and all of its datasets, analyses, and timeline steps. This cannot
            be undone.
          </span>
        }
        confirmLabel="Delete project"
        danger
        onConfirm={handleDelete}
      />
    </div>
  )
}


function ProjectCard({
  project,
  menuOpen,
  onMenuToggle,
  onOpen,
  onRename,
  onDelete,
}) {
  return (
    <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:border-brand-400 dark:hover:border-brand-500 transition-colors">
      {/* Clickable body */}
      <div onClick={onOpen} className="cursor-pointer">
        <div className="flex justify-between items-start mb-1.5">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-8">
            {project.name}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {new Date(project.updated_at).toLocaleDateString()}
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[2.2em]">
          {project.description || 'No description'}
        </p>
      </div>

      {/* Action menu trigger — sits in the top-right corner */}
      <button
        onClick={onMenuToggle}
        className="absolute top-2 right-2 w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 text-base leading-none flex items-center justify-center"
        aria-label="Project actions"
      >
        ⋯
      </button>

      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-8 right-2 z-10 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg overflow-hidden"
        >
          <button
            onClick={onRename}
            className="w-full text-left text-sm px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            Rename
          </button>
          <button
            onClick={onDelete}
            className="w-full text-left text-sm px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
