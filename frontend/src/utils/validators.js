// ============================================================================
// utils/validators.js
// ============================================================================
// Small validation helpers. Each returns either null (valid) or a string
// describing what's wrong (invalid). That way you can do:
//
//   const err = validateEmail(email)
//   if (err) setError(err)
// ============================================================================


/**
 * Check if a string looks like a valid email.
 * Returns null if valid, or an error message if not.
 */
export function validateEmail(value) {
  if (!value || !value.trim()) return 'Email is required'

  // A reasonable (not perfect) email regex. Full RFC compliance is overkill.
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  if (!looksLikeEmail) return 'Enter a valid email address'

  return null
}


/**
 * Check that a password is reasonably strong.
 */
export function validatePassword(value) {
  if (!value) return 'Password is required'
  if (value.length < 6) return 'Password must be at least 6 characters'
  return null
}


/**
 * Check that a project name isn't empty or too long.
 */
export function validateProjectName(value) {
  if (!value || !value.trim()) return 'Project name is required'
  if (value.length > 120) return 'Project name is too long (max 120 characters)'
  return null
}
