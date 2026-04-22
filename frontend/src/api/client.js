// ============================================================================
// api/client.js
// ============================================================================
// A single pre-configured Axios instance that all our API calls use.
// ============================================================================

import axios from 'axios'

// In dev, baseURL is empty so requests go through Vite's /api proxy.
// In prod, set VITE_API_URL at build time to the backend's public URL
// (e.g. https://simucast-api.onrender.com). Render's blueprint exposes
// service hostnames without a scheme, so prepend https:// if missing.
const raw = import.meta.env.VITE_API_URL || ''
const baseURL = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw

const client = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30000,
})

export default client
