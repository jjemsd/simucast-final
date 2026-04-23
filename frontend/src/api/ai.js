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

// Module-aware "what should I do next" panel. module is one of
// 'data' | 'clean' | 'expand' | 'stats' | 'tests' | 'model'.
// Returns { suggestions: [{ title, description, module, action?, params? }] }.
export async function getSuggestions(datasetId, module) {
  const { data } = await client.get('/api/ai/suggestions', {
    params: { dataset_id: datasetId, module },
  })
  return data
}

// AI-generated reasoning for a single Timeline step. Cached server-side
// so repeat calls are free. Pass force=true to regenerate.
export async function explainStep(stepId, force = false) {
  const { data } = await client.post('/api/ai/explain-step', {
    step_id: stepId,
    force,
  })
  return data  // { reasoning, cached }
}

// Ask Claude to pick a snake_case name for a derived column.
export async function suggestColumnName(sourceColumns, operation, description = null) {
  const { data } = await client.post('/api/ai/suggest-column-name', {
    source_columns: sourceColumns,
    operation,
    description,
  })
  return data.name
}

// Ask Claude to pick model features given a target column.
// Returns { features: [...], reasoning }.
export async function suggestModelFeatures(datasetId, target) {
  const { data } = await client.post('/api/ai/suggest-model-features', {
    dataset_id: datasetId,
    target,
  })
  return data
}
