// ============================================================================
// api/whatif.js
// ============================================================================
// Talks to backend/routes/whatif.py.
// ============================================================================

import client from './client.js'

/** Run a single prediction for the given inputs. */
export async function predict(stepId, inputs) {
  const { data } = await client.post(`/api/whatif/${stepId}/predict`, { inputs })
  return data  // { prediction, inputs_used, target }
}

/** Sensitivity analysis — which features move the prediction most. */
export async function sensitivity(stepId, inputs) {
  const { data } = await client.post(`/api/whatif/${stepId}/sensitivity`, { inputs })
  return data  // { baseline_prediction, sensitivities: [{feature, impact, type}] }
}

export async function listScenarios(stepId) {
  const { data } = await client.get(`/api/whatif/${stepId}/scenarios`)
  return data.scenarios
}

export async function saveScenario(stepId, name, inputs, prediction) {
  const { data } = await client.post(`/api/whatif/${stepId}/scenarios`, {
    name, inputs, prediction,
  })
  return data.scenario
}

export async function deleteScenario(scenarioId) {
  await client.delete(`/api/whatif/scenarios/${scenarioId}`)
}
