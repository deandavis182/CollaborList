import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Countdown } from '../Countdown.jsx'

// Fixed reference points — deterministic regardless of machine timezone.
// "now" = 2026-06-15 local midnight; weddingDate as a local-midnight Date.
const NOW = new Date(2026, 5, 15)            // month is 0-indexed → June 15 2026
const FUTURE = new Date(2026, 5, 25)         // June 25 2026 — 10 days away
const TODAY  = new Date(2026, 5, 15)         // same as NOW — 0 days
const PAST   = new Date(2026, 5,  5)         // June 5 2026 — 10 days ago

describe('Countdown', () => {
  it('renders nothing when weddingDate is falsy', () => {
    const { container } = render(<Countdown weddingDate={null} now={NOW} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when weddingDate is undefined', () => {
    const { container } = render(<Countdown now={NOW} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows "N days until the big day" when days > 0', () => {
    render(<Countdown weddingDate={FUTURE} now={NOW} />)
    const banner = screen.getByTestId('countdown')
    expect(banner).toBeInTheDocument()
    expect(banner.textContent).toMatch(/10/)
    expect(banner.textContent).toMatch(/days until the big day/i)
  })

  it('shows the actual date in the banner when days > 0', () => {
    render(<Countdown weddingDate={FUTURE} now={NOW} />)
    const banner = screen.getByTestId('countdown')
    // should contain a human-readable date string for June 25
    // toLocaleDateString() format varies by locale but always includes the day number
    expect(banner.textContent).toMatch(/25/)
  })

  it('shows "The big day is today!" when days === 0', () => {
    render(<Countdown weddingDate={TODAY} now={NOW} />)
    const banner = screen.getByTestId('countdown')
    expect(banner.textContent).toMatch(/today/i)
  })

  it('shows a "passed" message when days < 0', () => {
    render(<Countdown weddingDate={PAST} now={NOW} />)
    const banner = screen.getByTestId('countdown')
    expect(banner.textContent).toMatch(/passed/i)
  })

  it('has data-testid="countdown"', () => {
    render(<Countdown weddingDate={FUTURE} now={NOW} />)
    expect(screen.getByTestId('countdown')).toBeInTheDocument()
  })
})
