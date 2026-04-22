// ============================================================================
// api/projects.js
// ============================================================================
// Talks to backend/routes/projects.py.
// ============================================================================

import client from './client.js'

export async function listProjects() {
  const { data } = await client.get('/api/projects/')
  return data.projects
}

export async function createProject(name, description = '') {
  const { data } = await client.post('/api/projects/', { name, description })
  return data.project
}

export async function getProject(projectId) {
  const { data } = await client.get(`/api/projects/${projectId}`)
  return data
}

export async function updateProject(projectId, patch) {
  // patch is an object like { name: "New name" } or { description: "..." }.
  // The backend ignores fields we don't send.
  const { data } = await client.patch(`/api/projects/${projectId}`, patch)
  return data.project
}

export async function deleteProject(projectId) {
  await client.delete(`/api/projects/${projectId}`)
}
