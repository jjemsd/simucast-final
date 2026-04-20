// ============================================================================
// api/models.js
// ============================================================================
// Talks to backend/routes/models.py. Train models + list trained ones.
// ============================================================================

import client from './client.js'

export async function trainLinear(datasetId, target, features) {
  const { data } = await client.post(`/api/models/${datasetId}/linear`, { target, features })
  return data.step
}

export async function trainLogistic(datasetId, target, features) {
  const { data } = await client.post(`/api/models/${datasetId}/logistic`, { target, features })
  return data.step
}

export async function trainTree(datasetId, target, features, maxDepth = 5) {
  const { data } = await client.post(`/api/models/${datasetId}/tree`, {
    target, features, max_depth: maxDepth,
  })
  return data.step
}

/** List all trained models for a project, newest first. */
export async function listModels(projectId) {
  const { data } = await client.get(`/api/models/${projectId}/list`)
  return data.models
}
