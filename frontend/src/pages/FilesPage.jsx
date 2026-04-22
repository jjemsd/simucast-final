// ============================================================================
// FilesPage.jsx
// ============================================================================
// Lists every file the current user has uploaded. Phase B: files are
// first-class — you can upload, rename, delete, export, or spin up a new
// project seeded from any of them.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listFiles,
  uploadFile,
  renameFile,
  deleteFile,
  newProjectFromFile,
  exportFileUrl,
} from '../api/files.js'
import RenameModal from '../components/RenameModal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import NewProjectModal from '../components/NewProjectModal.jsx'

export default function FilesPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [query, setQuery] = useState('')
  const [menuOpenFor, setMenuOpenFor] = useState(null)

  // Modal targets: each holds the file being acted on (or null when closed).
  const [renameTarget, setRenameTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [newProjectTarget, setNewProjectTarget] = useState(null)

  useEffect(() => {
    reload()
  }, [])

  function reload() {
    setLoading(true)
    listFiles()
      .then(setFiles)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadFile(file)
      reload()
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message))
    } finally {
      setUploading(false)
      // Reset the input so the same file can be re-uploaded later if needed.
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRename(newName) {
    await renameFile(renameTarget.id, newName)
    reload()
  }

  async function handleDelete() {
    // If the file is used in any project, deleteFile() will 409. We catch
    // that and re-throw with a friendlier message that the ConfirmModal
    // will display; the user can retry from the Files page manually or
    // we could surface a second confirm step (kept simple for now — the
    // server message + project names is enough).
    try {
      await deleteFile(deleteTarget.id)
    } catch (err) {
      if (err.response?.status === 409) {
        const names = (err.response.data.used_in_projects || [])
          .map((p) => p.name)
          .join(', ')
        // Re-throw with a human-readable message. ConfirmModal catches and
        // displays it inside the modal's error row.
        const wrapped = new Error(
          `This file is used in: ${names}. Delete those projects first, or use "Force delete" from the file's menu.`
        )
        throw wrapped
      }
      throw err
    }
    reload()
  }

  async function handleForceDelete() {
    await deleteFile(deleteTarget.id, { force: true })
    reload()
  }

  async function handleNewProject(name, description) {
    const project = await newProjectFromFile(newProjectTarget.id, name, description)
    navigate(`/project/${project.id}`)
  }

  const filtered = query.trim()
    ? files.filter((f) =>
        f.original_filename.toLowerCase().includes(query.trim().toLowerCase())
      )
    : files

  return (
    <div className="p-8 max-w-6xl mx-auto" onClick={() => setMenuOpenFor(null)}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Files
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </p>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex items-center gap-1 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-md px-4 py-2 cursor-pointer">
            {uploading ? 'Uploading...' : '+ Upload file'}
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".csv,.tsv,.xlsx,.xls,.json"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search files..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full sm:max-w-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500 mb-5"
      />

      {loading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {query
              ? 'No files match your search'
              : 'No files yet. Upload a CSV, TSV, Excel, or JSON file to get started.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-right px-4 py-2 font-medium">Rows</th>
                <th className="text-right px-4 py-2 font-medium">Columns</th>
                <th className="text-left px-4 py-2 font-medium">Used in</th>
                <th className="text-left px-4 py-2 font-medium">Uploaded</th>
                <th className="text-right px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr
                  key={f.id}
                  className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 truncate max-w-xs">
                    {f.original_filename}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                    {f.row_count}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                    {f.column_count}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                    {f.project_count === 0 ? (
                      <span className="text-gray-400 dark:text-gray-500">
                        Not used
                      </span>
                    ) : (
                      <span>
                        {f.project_count}{' '}
                        project{f.project_count === 1 ? '' : 's'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                    {new Date(f.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <RowActions
                      file={f}
                      menuOpen={menuOpenFor === f.id}
                      onMenuToggle={(e) => {
                        e.stopPropagation()
                        setMenuOpenFor(menuOpenFor === f.id ? null : f.id)
                      }}
                      onNewProject={() => {
                        setMenuOpenFor(null)
                        setNewProjectTarget(f)
                      }}
                      onRename={() => {
                        setMenuOpenFor(null)
                        setRenameTarget(f)
                      }}
                      onDelete={() => {
                        setMenuOpenFor(null)
                        setDeleteTarget(f)
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RenameModal
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="Rename file"
        initialValue={renameTarget?.original_filename || ''}
        onSubmit={handleRename}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete file?"
        message={
          deleteTarget?.project_count > 0 ? (
            <span>
              <strong>{deleteTarget?.original_filename}</strong> is used in{' '}
              {deleteTarget?.project_count}{' '}
              project{deleteTarget?.project_count === 1 ? '' : 's'}. Deleting
              it will break the datasets in those projects. Continue anyway?
            </span>
          ) : (
            <span>
              Delete <strong>{deleteTarget?.original_filename}</strong>? This
              removes the file from the server and cannot be undone.
            </span>
          )
        }
        confirmLabel={deleteTarget?.project_count > 0 ? 'Force delete' : 'Delete file'}
        danger
        onConfirm={
          deleteTarget?.project_count > 0 ? handleForceDelete : handleDelete
        }
      />

      <NewProjectModal
        open={newProjectTarget !== null}
        onClose={() => setNewProjectTarget(null)}
        onCreate={handleNewProject}
      />
    </div>
  )
}


// --------------------------------------------------------------------------
// Row-level action cluster: Export button + ⋯ menu.
// --------------------------------------------------------------------------

function RowActions({
  file,
  menuOpen,
  onMenuToggle,
  onNewProject,
  onRename,
  onDelete,
}) {
  return (
    <div className="flex justify-end gap-2 relative">
      {/* Plain anchor with `download` — lets the browser save the file. */}
      <a
        href={exportFileUrl(file.id)}
        download={file.original_filename}
        className="text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        Export
      </a>

      <button
        onClick={onMenuToggle}
        className="w-7 h-7 rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center"
        aria-label="File actions"
      >
        ⋯
      </button>

      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1 z-10 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg overflow-hidden"
        >
          <button
            onClick={onNewProject}
            className="w-full text-left text-sm px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            Use in new project
          </button>
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
