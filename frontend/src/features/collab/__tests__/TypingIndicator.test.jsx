import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { useStore } from '../../../lib/store.js'
import { TypingIndicator } from '../TypingIndicator.jsx'

function resetStore() {
  useStore.setState({ typing: {} })
}

describe('TypingIndicator', () => {
  beforeEach(resetStore)

  it('renders the typing-indicator testid', () => {
    render(<TypingIndicator listId={5} />)
    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
  })

  it('renders nothing when no one is typing in that list', () => {
    useStore.setState({ typing: {} })
    render(<TypingIndicator listId={5} />)
    expect(screen.getByTestId('typing-indicator')).toBeEmptyDOMElement()
  })

  it('shows the email when one user is typing', () => {
    useStore.setState({ typing: { 5: { 1: 'a@x.com' } } })
    render(<TypingIndicator listId={5} />)
    expect(screen.getByTestId('typing-indicator')).toHaveTextContent('a@x.com is typing')
  })

  it('shows "Several people are typing…" when multiple users are typing', () => {
    useStore.setState({ typing: { 5: { 1: 'a@x.com', 2: 'b@x.com' } } })
    render(<TypingIndicator listId={5} />)
    expect(screen.getByTestId('typing-indicator')).toHaveTextContent('Several people are typing')
  })

  it('does not show typing from a different listId', () => {
    useStore.setState({ typing: { 99: { 1: 'a@x.com' } } })
    render(<TypingIndicator listId={5} />)
    expect(screen.getByTestId('typing-indicator')).toBeEmptyDOMElement()
  })
})
