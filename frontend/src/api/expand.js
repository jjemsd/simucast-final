// ============================================================================
// api/expand.js
// ============================================================================
// Talks to backend/routes/expand.py. Feature engineering functions.
// ============================================================================

import client from './client.js'

/**
 * Apply a math transform (log, sqrt, z-score, etc.) to a column.
 * transform: 'log' | 'log10' | 'sqrt' | 'square' | 'reciprocal' | 'zscore' | 'minmax' | 'abs'
 */
export async function applyMathTransform(datasetId, column, transform, newColumnName = null) {
  const { data } = await client.post(`/api/expand/${datasetId}/math`, {
    column,
    transform,
    new_column_name: newColumnName,
  })
  return data  // { dataset, step }
}

/**
 * Create a new column from two columns combined.
 * operation: 'add' | 'subtract' | 'multiply' | 'divide'
 */
export async function createInteraction(datasetId, colA, colB, operation, newColumnName = null) {
  const { data } = await client.post(`/api/expand/${datasetId}/interaction`, {
    col_a: colA,
    col_b: colB,
    operation,
    new_column_name: newColumnName,
  })
  return data
}

/**
 * Bin a continuous column into categories.
 * method: 'equal_width' | 'quantile'
 */
export async function createBins(datasetId, column, numBins, method = 'equal_width', newColumnName = null, labels = null) {
  const { data } = await client.post(`/api/expand/${datasetId}/bins`, {
    column,
    num_bins: numBins,
    method,
    new_column_name: newColumnName,
    labels,
  })
  return data
}

/**
 * Ask Claude to suggest useful derived features for this dataset.
 * Returns an array: [{ name, description, formula, source_columns }, ...]
 */
export async function suggestFeatures(datasetId) {
  const { data } = await client.post(`/api/expand/${datasetId}/suggest`)
  return data.suggestions
}

/**
 * Apply an AI-suggested feature.
 */
export async function applySuggestion(datasetId, name, formula, sourceColumns) {
  const { data } = await client.post(`/api/expand/${datasetId}/apply-suggestion`, {
    name,
    formula,
    source_columns: sourceColumns,
  })
  return data
}
