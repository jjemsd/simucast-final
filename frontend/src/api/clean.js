// ============================================================================
// api/clean.js
// ============================================================================
// Talks to backend/routes/clean.py.
//
// Every function returns { dataset, step } where:
//   - dataset = the NEW dataset (post-cleaning) — use this as the current one
//   - step    = the new timeline step
// ============================================================================

import client from './client.js'

/**
 * Fill missing values in a column.
 *
 * strategy: 'drop' | 'mean' | 'median' | 'mode' | 'value' | 'ffill' | 'bfill'
 * fillValue: only needed when strategy === 'value'
 */
export async function fillMissing(datasetId, column, strategy, fillValue = null) {
  const { data } = await client.post(`/api/clean/${datasetId}/missing`, {
    column,
    strategy,
    fill_value: fillValue,
  })
  return data  // { dataset, step }
}

/**
 * Remove outlier rows based on a numeric column.
 *
 * method: 'iqr' (default, threshold 1.5) | 'zscore' (threshold 3)
 */
export async function removeOutliers(datasetId, column, method = 'iqr', threshold = 1.5) {
  const { data } = await client.post(`/api/clean/${datasetId}/outliers`, {
    column,
    method,
    threshold,
  })
  return data
}

/** Delete one or more columns from the dataset. */
export async function deleteColumns(datasetId, columns) {
  const { data } = await client.post(`/api/clean/${datasetId}/delete-columns`, {
    columns,
  })
  return data
}

/**
 * Remove exact duplicate rows.
 * subset: optional array of columns to check for duplicates. Omit for "all columns".
 */
export async function deduplicate(datasetId, subset = null) {
  const { data } = await client.post(`/api/clean/${datasetId}/deduplicate`, {
    subset,
  })
  return data
}
