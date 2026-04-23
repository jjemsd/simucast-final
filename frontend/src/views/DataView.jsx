// ============================================================================
// DataView.jsx
// ============================================================================
// The Data tab inside the project workspace. Shows:
//   - AI-generated Overview at the top (replaces the old "Columns" chip bar)
//   - the data table with sticky header / sticky first column
//   - column hover tooltips (type + stats) and a per-column action menu
//     for rename / change type / delete
//   - pagination controls below the table
//
// When no dataset exists yet, shows the upload / synthetic-data prompt.
// ============================================================================

import { useEffect, useState } from 'react'
import { uploadFile, previewDataset, getProfile } from '../api/data.js'
import {
  renameColumn,
  convertColumnType,
  deleteColumns,
} from '../api/clean.js'

import DataTable from '../components/DataTable.jsx'
import SyntheticModal from '../components/SyntheticModal.jsx'
import RenameModal from '../components/RenameModal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import TypeConvertModal from '../components/TypeConvertModal.jsx'
import AIOverview from '../components/AIOverview.jsx'


export default function DataView({ project, currentDataset, onUpload }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [profile, setProfile] = useState(null)
  const [page, setPage] = useState(1)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const [syntheticOpen, setSyntheticOpen] = useState(false)

  // Which per-column modal is open (null = none). Each holds the column name.
  const [renameCol, setRenameCol] = useState(null)
  const [convertCol, setConvertCol] = useState(null)
  const [deleteCol, setDeleteCol] = useState(null)

  // --- Load preview + profile whenever the dataset or page changes ---
  useEffect(() => {
    if (!currentDataset) {
      setPreview(null)
      setProfile(null)
      return
    }
    setLoadingPreview(true)
    previewDataset(currentDataset.id, page, 50)
      .then(setPreview)
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoadingPreview(false))
  }, [currentDataset, page])

  // Profile refetches on dataset change only (not on page change — it's
  // the same across pages).
  useEffect(() => {
    if (!currentDataset) return
    getProfile(currentDataset.id)
      .then((p) => setProfile(p.columns || {}))
      .catch(() => setProfile(null))
  }, [currentDataset])

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
    onUpload()
    setPage(1)
  }

  // --- Column-action dispatcher passed into DataTable ---
  function handleColumnAction(colName, action) {
    if (action === 'rename') setRenameCol(colName)
    else if (action === 'convertType') setConvertCol(colName)
    else if (action === 'delete') setDeleteCol(colName)
  }

  async function submitRename(newName) {
    await renameColumn(currentDataset.id, renameCol, newName)
    onUpload()
  }

  async function submitConvert({ targetType, dateFormat }) {
    await convertColumnType(currentDataset.id, convertCol, targetType, dateFormat)
    onUpload()
  }

  async function submitDelete() {
    await deleteColumns(currentDataset.id, [deleteCol])
    onUpload()
  }

  // --- No dataset yet — show upload prompt ---
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

  // --- Dataset exists — full UI ---
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h1 className="text-base font-medium">Data</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {currentDataset.original_filename} · {currentDataset.row_count} rows · {currentDataset.column_count} columns
          </p>
        </div>

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

      {/* AI Overview replaces the old "Columns" chip bar */}
      <AIOverview datasetId={currentDataset.id} />

      {/* Table area — takes remaining vertical space and scrolls on its own */}
      <div className="flex-1 min-h-0 flex flex-col">
        {loadingPreview && !preview ? (
          <div className="text-sm text-gray-400 py-4">Loading preview...</div>
        ) : preview ? (
          <>
            <DataTable
              columns={preview.columns}
              rows={preview.rows}
              profile={profile}
              onColumnAction={handleColumnAction}
              maxHeight="calc(100vh - 280px)"
            />
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
          </>
        ) : null}
      </div>

      {/* Modals */}
      <SyntheticModal
        open={syntheticOpen}
        onClose={() => setSyntheticOpen(false)}
        projectId={project.id}
        onGenerated={handleSyntheticGenerated}
      />

      <RenameModal
        open={renameCol !== null}
        onClose={() => setRenameCol(null)}
        title={`Rename column — ${renameCol || ''}`}
        initialValue={renameCol || ''}
        onSubmit={submitRename}
      />

      <TypeConvertModal
        open={convertCol !== null}
        onClose={() => setConvertCol(null)}
        column={convertCol}
        currentType={convertCol && profile ? profile[convertCol]?.dtype : ''}
        onSubmit={submitConvert}
      />

      <ConfirmModal
        open={deleteCol !== null}
        onClose={() => setDeleteCol(null)}
        title="Delete column?"
        message={
          <span>
            This removes the column <strong>{deleteCol}</strong> from the
            current dataset. The step is logged in the timeline so you
            can roll it back.
          </span>
        }
        confirmLabel="Delete column"
        danger
        onConfirm={submitDelete}
      />
    </div>
  )
}
