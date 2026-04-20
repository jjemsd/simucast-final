// ============================================================================
// api/tests.js
// ============================================================================
// Talks to backend/routes/tests.py. Every function returns just `result`
// (no dataset creation — tests don't modify data).
// ============================================================================

import client from './client.js'

// ----- T-tests -----

export async function tTestOneSample(datasetId, column, testValue) {
  const { data } = await client.post(`/api/tests/${datasetId}/t-test/one-sample`, {
    column,
    test_value: testValue,
  })
  return data.result
}

export async function tTestIndependent(datasetId, numericCol, groupCol) {
  const { data } = await client.post(`/api/tests/${datasetId}/t-test/independent`, {
    numeric_col: numericCol,
    group_col: groupCol,
  })
  return data.result
}

export async function tTestPaired(datasetId, colA, colB) {
  const { data } = await client.post(`/api/tests/${datasetId}/t-test/paired`, {
    col_a: colA,
    col_b: colB,
  })
  return data.result
}

// ----- ANOVA -----

export async function anovaOneWay(datasetId, numericCol, groupCol) {
  const { data } = await client.post(`/api/tests/${datasetId}/anova`, {
    numeric_col: numericCol,
    group_col: groupCol,
  })
  return data.result
}

// ----- Correlation -----

export async function correlation(datasetId, colA, colB, method = 'pearson') {
  const { data } = await client.post(`/api/tests/${datasetId}/correlation`, {
    col_a: colA,
    col_b: colB,
    method,
  })
  return data.result
}

// ----- Chi-square -----

export async function chiSquare(datasetId, colA, colB) {
  const { data } = await client.post(`/api/tests/${datasetId}/chi-square`, {
    col_a: colA,
    col_b: colB,
  })
  return data.result
}
