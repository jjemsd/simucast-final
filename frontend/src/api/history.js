// ============================================================================
// api/history.js
// ============================================================================
// Talks to backend/routes/history.py.
// ============================================================================

import client from './client.js'

/**
 * Revert a step and everything after it.
 * Returns { reverted_count, current_dataset_id }.
 */
export async function rollbackToStep(projectId, stepId) {
  const { data } = await client.post(`/api/history/${projectId}/rollback/${stepId}`)
  return data
}

/** Get the full list of steps for a project, oldest first. */
export async function listSteps(projectId) {
  const { data } = await client.get(`/api/history/${projectId}/steps`)
  return data.steps
}
