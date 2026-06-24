import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
const { logout, navigate } = vi.hoisted(() => ({ logout: vi.fn(), navigate: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../../../lib/api.js', () => ({
  useMyTasks: () => ({ data: [{ id: 1, completed: false, due_date: null }] }),
  useWorkspaces: () => ({ data: [{ id: 7, name: 'WS' }] }),
}))
vi.mock('../../../lib/auth.js', () => ({ getUser: () => ({ email: 'me@example.com' }), logout }))
vi.mock('../../notifications/NotificationPrefs.jsx', () => ({ NotificationPrefs: () => <div data-testid="notif-prefs" /> }))
import { useStore } from '../../../lib/store.js'
import { MeScreen } from '../MeScreen.jsx'

describe('MeScreen', () => {
  beforeEach(() => {
    useStore.setState({ theme: 'light', currentWorkspaceId: null, socketConnected: false })
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

  it('clicking Workspace row navigates to /w/7 when currentWorkspaceId is null but first workspace id is 7', () => {
    navigate.mockClear()
    render(<MeScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }))
    // Falls back to the first workspace's id (7) since currentWorkspaceId is null
    expect(navigate).toHaveBeenCalledWith('/w/7')
  })

  it('clicking Members row navigates to the workspace', () => {
    navigate.mockClear()
    render(<MeScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Members' }))
    expect(navigate).toHaveBeenCalledWith('/w/7')
  })

  it('Live sync row shows Offline when socketConnected is false', () => {
    render(<MeScreen />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('Live sync row shows Connected when socketConnected is true', () => {
    useStore.setState({ socketConnected: true })
    render(<MeScreen />)
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })
})
