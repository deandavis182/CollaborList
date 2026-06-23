/**
 * LoginView — centered login / register card for the V2 shell.
 *
 * Modes: "login" (default) and "signup" — toggled via the auth-toggle-mode button.
 *
 * On success: calls setAuth(data) then window.location.assign('/') for a full
 * page reload so Providers re-initialise the socket with the new token.
 * Using window.location.assign (rather than a React Router navigate) is the
 * intentional design: it avoids the socket-reconnect-without-reload problem.
 *
 * Google OAuth: omitted — see TODO below. Email/password is the required path.
 *
 * TODO: add Google OAuth ("Continue with Google") when VITE_GOOGLE_CLIENT_ID
 * is available.  Mirror RealtimeApp.jsx's flow: render the Google Identity
 * Services script, call google.accounts.id.initialize + prompt, then POST to
 * /auth/google { credential }.
 */

import { useState } from 'react'
import { apiClient } from '../../lib/api.js'
import { setAuth } from '../../lib/auth.js'
import { getApiError } from '../../lib/apiError.js'
import { Field } from '../../ui/Field.jsx'
import { Button } from '../../ui/Button.jsx'
import { Card } from '../../ui/Card.jsx'

// ---------------------------------------------------------------------------
// Password hint shown in Sign up mode
// ---------------------------------------------------------------------------

const PASSWORD_HINT =
  'At least 8 characters with one uppercase, one lowercase, and one number.'

// ---------------------------------------------------------------------------
// LoginView
// ---------------------------------------------------------------------------

export function LoginView() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [isPending, setIsPending] = useState(false)

  const isSignup = mode === 'signup'

  function toggleMode() {
    setMode((m) => (m === 'login' ? 'signup' : 'login'))
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    try {
      const endpoint = isSignup ? '/auth/register' : '/auth/login'
      const { data } = await apiClient.post(endpoint, { email, password })
      setAuth(data)
      window.location.assign('/')
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div
      data-testid="login-view"
      className="min-h-screen flex items-center justify-center bg-bg p-4"
    >
      <Card className="w-full max-w-sm p-8">
        {/* Heading */}
        <h1 className="text-2xl font-semibold text-text mb-6 text-center">
          {isSignup ? 'Create account' : 'Log in'}
        </h1>

        {/* Error region */}
        {error && (
          <div
            data-testid="auth-error"
            role="alert"
            className="mb-4 rounded-md bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {/* Email */}
          <Field label="Email" htmlFor="auth-email-input">
            <input
              id="auth-email-input"
              data-testid="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>

          {/* Password */}
          <Field label="Password" htmlFor="auth-password-input">
            <input
              id="auth-password-input"
              data-testid="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {/* Password hint — shown in sign-up mode */}
            {isSignup && (
              <p className="mt-1 text-xs text-text-muted">{PASSWORD_HINT}</p>
            )}
          </Field>

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isPending}
            data-testid="auth-submit"
          >
            {isPending
              ? isSignup
                ? 'Creating account…'
                : 'Logging in…'
              : isSignup
                ? 'Sign up'
                : 'Log in'}
          </Button>
        </form>

        {/* Mode toggle */}
        <p className="mt-5 text-center text-sm text-text-muted">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}
          {' '}
          <button
            type="button"
            data-testid="auth-toggle-mode"
            onClick={toggleMode}
            className="text-primary hover:underline font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            {isSignup ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </Card>
    </div>
  )
}
