// ============================================================================
// ReportView.jsx
// ============================================================================
// The Report module. Shows:
//   - List of everything currently included (saved items from Stats/Tests +
//     auto-included models/scenarios/cleaning log)
//   - Export buttons (PDF, DOCX)
//   - Hint box explaining how to add more items
// ============================================================================

import { useEffect, useState } from 'react'
import { listReportItems, deleteReportItem, downloadReportPdf, downloadReportDocx } from '../api/reports.js'
import { listModels } from '../api/models.js'


// Labels for the "kind" field — makes the UI readable
const KIND_LABELS = {
  descriptives: 'Descriptive statistics',
  frequencies:  'Frequency table',
  normality:    'Normality test',
  t_test:       'T-test',
  anova:        'ANOVA',
  correlation:  'Correlation',
  chi_square:   'Chi-square test',
}


export default function ReportView({ project }) {
  const [items, setItems] = useState([])
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(null)  // 'pdf' | 'docx' | null
  const [error, setError] = useState('')

  useEffect(() => {
    if (!project) return
    Promise.all([
      listReportItems(project.id),
      listModels(project.id),
    ])
      .then(([itemsList, modelsList]) => {
        setItems(itemsList)
        setModels(modelsList)
      })
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false))
  }, [project])

  async function handleDelete(stepId) {
    if (!window.confirm('Remove this item from the report?')) return
    try {
      await deleteReportItem(stepId)
      setItems(items.filter((i) => i.id !== stepId))
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.error || err.message))
    }
  }

  async function handleExport(format) {
    setExporting(format)
    setError('')
    try {
      const filename = `${project.name.replace(/[^a-z0-9]/gi, '_')}_report.${format}`
      if (format === 'pdf') {
        await downloadReportPdf(project.id, filename)
      } else {
        await downloadReportDocx(project.id, filename)
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setExporting(null)
    }
  }

  if (loading) return <div className="text-sm text-gray-400">Loading report contents...</div>

  const hasContent = items.length > 0 || models.length > 0

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-base font-medium">Report</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Generate a thesis-ready summary of your analyses
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleExport('docx')}
            disabled={!hasContent || exporting !== null}
            className="text-xs border border-gray-200 bg-white hover:border-brand-400 rounded-md px-3 py-1.5 disabled:opacity-40 flex items-center gap-1.5"
          >
            {exporting === 'docx' ? 'Generating...' : 'Export as Word'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={!hasContent || exporting !== null}
            className="text-xs bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 disabled:opacity-50 flex items-center gap-1.5"
          >
            {exporting === 'pdf' ? 'Generating...' : 'Export as PDF'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* How-it-works hint box */}
      <div className="bg-brand-50 border border-brand-200 rounded-md p-4 mb-4">
        <div className="flex items-start gap-2">
          <span className="text-brand-600 text-xs mt-0.5">✦</span>
          <div className="flex-1 text-xs text-brand-900 leading-relaxed">
            <div className="font-medium mb-1">What the report includes</div>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Cover page with project info and dataset summary</li>
              <li>Data preparation log (cleaning + expansion + synthetic generation) — auto-included</li>
              <li>Statistical analyses you've saved (see below) — <span className="font-medium">use "Save to report" in Stats and Tests</span></li>
              <li>Every trained model and its metrics — auto-included</li>
              <li>Every saved What-If scenario — auto-included</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Preview of contents */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left column: saved items */}
        <section>
          <h2 className="text-xs font-medium mb-2">
            Saved analyses ({items.length})
          </h2>
          <div className="bg-white border border-gray-200 rounded-md">
            {items.length === 0 ? (
              <div className="p-4 text-xs text-gray-500 italic">
                None yet. Run a test or compute descriptives, then click "Save to report" on the result.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((item) => {
                  const kind = item.details?.kind
                  return (
                    <li key={item.id} className="p-3 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] rounded bg-brand-100 text-brand-700 px-1.5 py-0.5">
                            {KIND_LABELS[kind] || kind}
                          </span>
                        </div>
                        <div className="text-xs font-medium truncate">
                          {item.details?.title}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {new Date(item.created_at).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-gray-400 hover:text-red-600 text-sm shrink-0"
                        title="Remove from report"
                      >×</button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Right column: auto-included sections */}
        <section>
          <h2 className="text-xs font-medium mb-2">Auto-included ({models.length} model{models.length !== 1 ? 's' : ''})</h2>
          <div className="bg-white border border-gray-200 rounded-md">
            {models.length === 0 ? (
              <div className="p-4 text-xs text-gray-500 italic">
                No trained models yet. Train one in the Model module and it'll appear here.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {models.map((model) => (
                  <li key={model.id} className="p-3">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] rounded bg-brand-100 text-brand-700 px-1.5 py-0.5">
                        {model.details?.model_type?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs font-medium truncate">{model.title}</div>
                    <div className="text-[10px] text-gray-400">
                      Target: {model.details?.target} · {model.details?.features_original?.length} features
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
