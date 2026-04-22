// ============================================================================
// api/client.js
// ============================================================================
// A single pre-configured Axios instance that all our API calls use.
// ============================================================================

import axios from 'axios'

// In dev, baseURL is empty so requests go through Vite's /api proxy.
// In prod, set VITE_API_URL at build time to the backend's public URL,
// e.g. https://simucast-api.onrender.com.
//
// A bare hostname without a dot (e.g. "simucast-api") is almost certainly
// a misconfigured Render fromService value — that won't resolve in DNS,
// so we fall back to same-origin and log a warning instead of producing
// ERR_NAME_NOT_RESOLVED.
function resolveBaseURL(raw) {
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (!raw.includes('.')) {
    console.warn(
      `[simucast] VITE_API_URL="${raw}" looks like a bare service name. ` +
      `Set it to the full https://...onrender.com URL. Falling back to same-origin.`
    )
    return ''
  }
  return `https://${raw}`
}

const baseURL = resolveBaseURL(import.meta.env.VITE_API_URL)

const client = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30000,
})

export default client
