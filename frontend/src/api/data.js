// ============================================================================
// api/data.js
// ============================================================================
// Talks to backend/routes/data.py.
// ============================================================================

import client from './client.js'

export async function uploadFile(projectId, file) {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await client.post(
    `/api/data/${projectId}/upload`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return data.dataset
}

export async function previewDataset(datasetId, page = 1, perPage = 50) {
  const { data } = await client.get(`/api/data/${datasetId}/preview`, {
    params: { page, per_page: perPage },
  })
  return data
}

// Every dataset the current user owns (across all their projects).
// Used by the Files page.
export async function listAllDatasets() {
  const { data } = await client.get('/api/data/')
  return data.datasets
}

// Trigger a browser download of a dataset's underlying file.
// Uses an anchor element so the browser handles the save dialog — we
// don't try to pull the bytes into JS memory.
export function exportDatasetUrl(datasetId) {
  // Returns the absolute URL so <a download> works cross-origin.
  // When the backend and frontend share an origin (dev), baseURL is ''.
  const base = client.defaults.baseURL || ''
  return `${base}/api/data/${datasetId}/export`
}
