// ============================================================================
// api/files.js
// ============================================================================
// Talks to backend/routes/files.py. Phase B: Files are user-owned and
// independent from projects, so all file CRUD lives here.
// ============================================================================

import client from './client.js'

// List every file the current user owns. Each includes project_count.
export async function listFiles() {
  const { data } = await client.get('/api/files/')
  return data.files
}

// Upload a new file (standalone — does NOT create a project).
export async function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post('/api/files/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.file
}

export async function getFile(fileId) {
  const { data } = await client.get(`/api/files/${fileId}`)
  return data.file
}

export async function renameFile(fileId, newName) {
  const { data } = await client.patch(`/api/files/${fileId}`, {
    original_filename: newName,
  })
  return data.file
}

// Delete a file. If it's attached to any projects, the server returns
// 409 with { used_in_projects: [...] }. Caller can retry with force=true
// after confirming with the user.
export async function deleteFile(fileId, { force = false } = {}) {
  const qs = force ? '?force=1' : ''
  await client.delete(`/api/files/${fileId}${qs}`)
}

// Create a fresh project seeded from an existing file.
export async function newProjectFromFile(fileId, name, description = '') {
  const { data } = await client.post(`/api/files/${fileId}/new-project`, {
    name,
    description,
  })
  return data.project
}

// Download URL for the raw file — use directly as an <a href>.
export function exportFileUrl(fileId) {
  const base = client.defaults.baseURL || ''
  return `${base}/api/files/${fileId}/export`
}
