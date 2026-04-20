// ============================================================================
// api/client.js
// ============================================================================
// A single pre-configured Axios instance that all our API calls use.
// ============================================================================

import axios from 'axios'

const client = axios.create({
  baseURL: '',
  withCredentials: true,
  timeout: 30000,
})

export default client
