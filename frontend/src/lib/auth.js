/**
 * auth.js — authentication helpers for the V2 shell.
 *
 * Thin wrappers around localStorage so callers never hard-code the key names
 * and tests can assert storage state without touching the DOM.
 */

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

/** Return the JWT string, or null if not logged in. */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * Return the stored user object, or null if not logged in or storage is
 * corrupt.  Corrupt JSON is silently discarded rather than throwing.
 */
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

/** Persist a successful login/register response. */
export function setAuth({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

/** Clear all auth state (log out). */
export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/** True when a token is present in storage. */
export function isAuthenticated() {
  return Boolean(getToken())
}
