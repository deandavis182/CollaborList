import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileTabBar } from '../MobileTabBar.jsx'

describe('MobileTabBar', () => {
  it('renders four tabs + FAB and marks the active tab', () => {
    render(<MobileTabBar activeTab="lists" onSelect={() => {}} onAdd={() => {}} />)
    expect(screen.getByTestId('mobile-tab-bar')).toBeInTheDocument()
    expect(screen.getByTestId('mtab-add')).toBeInTheDocument()
    expect(screen.getByTestId('mtab-lists')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('mtab-today')).not.toHaveAttribute('aria-current')
  })
  it('calls onSelect with the tab id and onAdd for the FAB', () => {
    const onSelect = vi.fn(); const onAdd = vi.fn()
    render(<MobileTabBar activeTab="today" onSelect={onSelect} onAdd={onAdd} />)
    fireEvent.click(screen.getByTestId('mtab-activity'))
    expect(onSelect).toHaveBeenCalledWith('activity')
    fireEvent.click(screen.getByTestId('mtab-add'))
    expect(onAdd).toHaveBeenCalled()
  })
  it('shows the unread dot when activityUnread', () => {
    render(<MobileTabBar activeTab="today" onSelect={() => {}} onAdd={() => {}} activityUnread />)
    expect(screen.getByTestId('mtab-activity-unread')).toBeInTheDocument()
  })
  it('hides the unread dot when activityUnread is false', () => {
    render(<MobileTabBar activeTab="today" onSelect={() => {}} onAdd={() => {}} activityUnread={false} />)
    expect(screen.queryByTestId('mtab-activity-unread')).toBeNull()
  })
})
