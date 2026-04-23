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

// Per-column stats used by the hover popover and the AI Overview.
// Computes nulls, numeric summary, categorical frequencies, error counts.
export async function getProfile(datasetId) {
  const { data } = await client.get(`/api/data/${datasetId}/profile`)
  return data
}

// (Phase B removed the legacy listAllDatasets / exportDatasetUrl helpers.
// The Files page now talks to api/files.js instead.)
