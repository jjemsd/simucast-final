// ============================================================================
// api/stats.js
// ============================================================================
// Talks to backend/routes/stats.py.
// ============================================================================

import client from './client.js'

export async function computeDescriptives(datasetId, columns) {
  const { data } = await client.post(
    `/api/stats/${datasetId}/descriptives`,
    { columns }
  )
  return data.results
}

export async function computeFrequencies(datasetId, column) {
  const { data } = await client.post(
    `/api/stats/${datasetId}/frequencies`,
    { column }
  )
  return data
}

export async function computeNormality(datasetId, column) {
  const { data } = await client.post(
    `/api/stats/${datasetId}/normality`,
    { column }
  )
  return data
}
