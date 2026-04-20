// ============================================================================
// api/auth.js
// ============================================================================
// Talks to backend/routes/auth.py.
// ============================================================================

import client from './client.js'

export async function register(email, password, name) {
  const { data } = await client.post('/api/auth/register', { email, password, name })
  return data.user
}

export async function login(email, password) {
  const { data } = await client.post('/api/auth/login', { email, password })
  return data.user
}

export async function logout() {
  await client.post('/api/auth/logout')
}

export async function getCurrentUser() {
  try {
    const { data } = await client.get('/api/auth/me')
    return data.user
  } catch (err) {
    if (err.response?.status === 401) return null
    throw err
  }
}
