// ============================================================================
// api/synthetic.js
// ============================================================================
// Talks to backend/routes/synthetic.py.
// ============================================================================

import client from './client.js'

/** Generate synthetic data from a schema. */
export async function generateFromSchema(projectId, schema) {
  const { data } = await client.post(`/api/synthetic/${projectId}/schema`, schema)
  return data  // { dataset, step }
}

/** Ask Claude to generate synthetic data from a plain-English description. */
export async function generateWithAI(projectId, description, numRows = 50, filename = null) {
  const { data } = await client.post(`/api/synthetic/${projectId}/ai`, {
    description,
    num_rows: numRows,
    filename,
  })
  return data
}
