/**
 * RequireAuth — route guard for authenticated sections.
 *
 * If `isAuthenticated()` returns false → redirects to /login.
 * Otherwise renders children (or <Outlet /> if used as a layout route).
 */

import { Navigate, Outlet } from 'react-router-dom'
import { isAuthenticated } from '../../lib/auth.js'

export function RequireAuth({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return children ?? <Outlet />
}
