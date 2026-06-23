import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { useStore } from '../../../lib/store.js'
import { PresenceBar } from '../PresenceBar.jsx'

function resetStore() {
  useStore.setState({ presence: {} })
}

describe('PresenceBar', () => {
  beforeEach(resetStore)

  it('renders the presence-bar testid', () => {
    render(<PresenceBar />)
    expect(screen.getByTestId('presence-bar')).toBeInTheDocument()
  })

  it('renders nothing (no avatars) when presence is empty', () => {
    useStore.setState({ presence: {} })
    render(<PresenceBar />)
    // no presence-N testid should exist
    expect(screen.queryByTestId('presence-1')).not.toBeInTheDocument()
  })

  it('renders an avatar per present user', () => {
    useStore.setState({
      presence: {
        1: { userId: 1, email: 'a@x.com' },
        2: { userId: 2, email: 'b@x.com' },
      },
    })
    render(<PresenceBar />)
    expect(screen.getByTestId('presence-1')).toBeInTheDocument()
    expect(screen.getByTestId('presence-2')).toBeInTheDocument()
  })

  it('each avatar has correct aria-label from email', () => {
    useStore.setState({
      presence: {
        7: { userId: 7, email: 'carol@example.com' },
      },
    })
    render(<PresenceBar />)
    expect(screen.getByLabelText('carol@example.com')).toBeInTheDocument()
  })
})
