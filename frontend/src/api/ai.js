// ============================================================================
// api/ai.js
// ============================================================================
// Talks to backend/routes/ai.py. All Claude interactions go through here.
// ============================================================================

import client from './client.js'

export async function chat(message, history = [], datasetId = null) {
  const { data } = await client.post('/api/ai/chat', {
    message,
    history,
    dataset_id: datasetId,
  })
  return data.response
}

export async function interpret(analysisType, result) {
  const { data } = await client.post('/api/ai/interpret', {
    analysis_type: analysisType,
    result,
  })
  return data.interpretation
}

export async function recommendTest(datasetId, question) {
  const { data } = await client.post('/api/ai/recommend_test', {
    dataset_id: datasetId,
    question,
  })
  return data
}

// Dataset-level summary used by the Overview panel in DataView.
// Returns { summary, issues: [...], suggestions: [...] }.
export async function getOverview(datasetId) {
  const { data } = await client.get('/api/ai/overview', {
    params: { dataset_id: datasetId },
  })
  return data
}
