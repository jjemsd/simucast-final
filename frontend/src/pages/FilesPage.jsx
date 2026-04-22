// ============================================================================
// FilesPage.jsx
// ============================================================================
// Lists every file the current user has uploaded (across all their projects).
// Each row shows basic metadata and an Open / Export action.
//
// Phase A is read-only. Upload and delete from this page are Phase B and
// depend on making "File" a first-class resource in the backend (right
// now every file is tied to exactly one project).
// ============================================================================

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listAllDatasets, exportDatasetUrl } from '../api/data.js'

export default function FilesPage() {
  const navigate = useNavigate()

  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    listAllDatasets()
      .then(setFiles)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = query.trim()
    ? files.filter((f) =>
        f.original_filename.toLowerCase().includes(query.trim().toLowerCase())
      )
    : files

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Files
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {files.length} {files.length === 1 ? 'file' : 'files'} across all
            your projects
          </p>
        </div>
      </div>

      {/* Search box */}
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {query
              ? 'No files match your search'
              : 'No files yet. Open a project and upload a CSV on the Data tab.'}
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
                <th className="text-left px-4 py-2 font-medium">Project</th>
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
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => navigate(`/project/${f.project_id}`)}
                      className="text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      {f.project_name}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                    {new Date(f.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/project/${f.project_id}`)}
                        className="text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        Open
                      </button>
                      {/* Plain anchor with `download` — the browser handles the save. */}
                      <a
                        href={exportDatasetUrl(f.id)}
                        download={f.original_filename}
                        className="text-xs bg-brand-500 hover:bg-brand-600 text-white rounded px-2 py-1"
                      >
                        Export
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Phase B note — make it visible so the user remembers what's coming. */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
        Upload, rename, and delete from this page are coming soon. For now,
        upload files from inside a project's Data tab.
      </p>
    </div>
  )
}
