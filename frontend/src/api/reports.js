// ============================================================================
// api/reports.js
// ============================================================================
// Talks to backend/routes/reports.py. Note the export functions use
// responseType: 'blob' because we're downloading binary files, not JSON.
// ============================================================================

import client from './client.js'

/** Save a stats/test result to the report. */
export async function saveReportItem(projectId, kind, title, data) {
  const { data: response } = await client.post(`/api/reports/${projectId}/items`, {
    kind, title, data,
  })
  return response.step
}

/** List all saved report items. */
export async function listReportItems(projectId) {
  const { data } = await client.get(`/api/reports/${projectId}/items`)
  return data.items
}

/** Remove a saved item from the report. */
export async function deleteReportItem(stepId) {
  await client.delete(`/api/reports/items/${stepId}`)
}

/**
 * Download the PDF report — triggers a browser download via blob URL.
 * We can't just hit a URL directly because we need to send auth cookies.
 */
export async function downloadReportPdf(projectId, filename = 'report.pdf') {
  const res = await client.get(`/api/reports/${projectId}/export/pdf`, {
    responseType: 'blob',
  })
  _triggerDownload(res.data, filename, 'application/pdf')
}

/** Download the DOCX report. */
export async function downloadReportDocx(projectId, filename = 'report.docx') {
  const res = await client.get(`/api/reports/${projectId}/export/docx`, {
    responseType: 'blob',
  })
  _triggerDownload(
    res.data, filename,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
}

/**
 * Helper: turn a Blob into a browser download.
 * Creates a temporary <a> tag, clicks it, cleans up the object URL.
 */
function _triggerDownload(blobData, filename, mimeType) {
  const blob = new Blob([blobData], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke URL after a brief delay so the download has time to start
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
