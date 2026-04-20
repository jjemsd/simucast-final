// ============================================================================
// DataView.jsx  —  WEEK 5 VERSION
// ============================================================================
// Changes from Week 1:
//   - Added "Generate synthetic data" button next to the upload area
//   - Added SyntheticModal integration
//   - Button is always visible (even when no dataset yet) so users can start
//     with a synthetic dataset instead of uploading
// ============================================================================

import { useEffect, useState } from 'react'
import { uploadFile, previewDataset } from '../api/data.js'
import DataTable from '../components/DataTable.jsx'
import SyntheticModal from '../components/SyntheticModal.jsx'


export default function DataView({ project, currentDataset, onUpload }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [page, setPage] = useState(1)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // --- NEW in Week 5: synthetic data modal state ---
  const [syntheticOpen, setSyntheticOpen] = useState(false)

  useEffect(() => {
    if (!currentDataset) {
      setPreview(null)
      return
    }
    setLoadingPreview(true)
    previewDataset(currentDataset.id, page, 50)
      .then(setPreview)
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoadingPreview(false))
  }, [currentDataset, page])

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      await uploadFile(project.id, file)
      onUpload()
      setPage(1)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function handleSyntheticGenerated() {
    onUpload()     // same refresh flow as after a file upload
    setPage(1)
  }

  // --- No dataset yet — show upload prompt + synthetic option ---
  if (!currentDataset) {
    return (
      <>
        <div>
          <h1 className="text-base font-medium mb-1">Data</h1>
          <p className="text-xs text-gray-500 mb-6">
            Upload a dataset to get started, or generate one with AI.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className="bg-white border border-dashed border-gray-300 hover:border-brand-400 rounded-lg p-8 text-center cursor-pointer transition-colors">
              <div className="text-2xl text-gray-400 mb-2">↑</div>
              <div className="text-sm text-gray-600 mb-1">
                {uploading ? 'Uploading...' : 'Upload a file'}
              </div>
              <div className="text-xs text-gray-400">CSV, XLSX, JSON, TSV</div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.json,.tsv"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
            </label>

            <button
              onClick={() => setSyntheticOpen(true)}
              className="bg-white border border-dashed border-gray-300 hover:border-brand-400 rounded-lg p-8 text-center transition-colors"
            >
              <div className="text-2xl text-brand-500 mb-2">✦</div>
              <div className="text-sm text-gray-600 mb-1">Generate synthetic data</div>
              <div className="text-xs text-gray-400">Schema or AI-powered</div>
            </button>
          </div>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <SyntheticModal
          open={syntheticOpen}
          onClose={() => setSyntheticOpen(false)}
          projectId={project.id}
          onGenerated={handleSyntheticGenerated}
        />
      </>
    )
  }

  // --- Dataset exists — show details + preview ---
  return (
    <>
      <div>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-base font-medium">Data</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {currentDataset.original_filename} · {currentDataset.row_count} rows · {currentDataset.column_count} columns
            </p>
          </div>

          {/* --- NEW in Week 5: Action buttons --- */}
          <div className="flex gap-2">
            <button
              onClick={() => setSyntheticOpen(true)}
              className="bg-white border border-gray-200 hover:border-brand-400 rounded-md px-3 py-1.5 text-xs text-brand-700 font-medium"
            >
              ✦ Generate synthetic
            </button>
            <label className="bg-white border border-gray-200 hover:border-brand-400 rounded-md px-3 py-1.5 text-xs text-gray-700 cursor-pointer">
              {uploading ? 'Uploading...' : 'Replace file'}
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.json,.tsv"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-md p-3.5 mb-4">
          <div className="text-xs font-medium mb-2">Columns</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(currentDataset.columns_info).map(([col, dtype]) => (
              <div
                key={col}
                className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-md px-2 py-1"
              >
                <span className="text-xs font-medium text-gray-800">{col}</span>
                <span className="text-[10px] text-gray-500">{dtype}</span>
              </div>
            ))}
          </div>
        </div>

        {loadingPreview ? (
          <div className="text-sm text-gray-400 py-4">Loading preview...</div>
        ) : preview ? (
          <div>
            <DataTable columns={preview.columns} rows={preview.rows} />
            <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
              <div>
                Page {preview.page} of {preview.total_pages} · {preview.total_rows} rows total
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50 disabled:opacity-40"
                >Previous</button>
                <button
                  onClick={() => setPage((p) => Math.min(preview.total_pages, p + 1))}
                  disabled={page === preview.total_pages}
                  className="border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50 disabled:opacity-40"
                >Next</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <SyntheticModal
        open={syntheticOpen}
        onClose={() => setSyntheticOpen(false)}
        projectId={project.id}
        onGenerated={handleSyntheticGenerated}
      />
    </>
  )
}
