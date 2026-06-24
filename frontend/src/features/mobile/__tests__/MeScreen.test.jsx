import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../../../lib/api.js', () => ({ useMyTasks: () => ({ data: [{ id: 1, completed: false, due_date: null }] }) }))
const { logout } = vi.hoisted(() => ({ logout: vi.fn() }))
vi.mock('../../../lib/auth.js', () => ({ getUser: () => ({ email: 'me@example.com' }), logout }))
vi.mock('../../notifications/NotificationPrefs.jsx', () => ({ NotificationPrefs: () => <div data-testid="notif-prefs" /> }))
import { useStore } from '../../../lib/store.js'
import { MeScreen } from '../MeScreen.jsx'

describe('MeScreen', () => {
  beforeEach(() => {
    useStore.setState({ theme: 'light' })
    // jsdom does not implement navigation; stub assign so logout wiring stays pristine
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: vi.fn() },
    })
  })
  it('shows email and toggles theme via the segmented control', () => {
    render(<MeScreen />)
    expect(screen.getByText('me@example.com')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(useStore.getState().theme).toBe('dark')
    // open-tasks stat tile shows 1 for the single incomplete fixture task
    expect(screen.getByText('1')).toBeInTheDocument()
    // logout wiring
    fireEvent.click(screen.getByRole('button', { name: /log out/i }))
    expect(logout).toHaveBeenCalled()
  })
})
