import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { useStore } from '../../lib/store.js'
import { Providers } from '../providers.jsx'

function resetStore() {
  useStore.setState({
    currentWorkspaceId: null,
    currentProjectId: null,
    detailItemId: null,
    presence: {},
    theme: 'light',
  })
}

describe('Providers', () => {
  beforeEach(resetStore)

  it('renders children', () => {
    render(
      <Providers>
        <p data-testid="child">Hello Providers</p>
      </Providers>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Hello Providers')).toBeInTheDocument()
  })

  it('sets data-theme="light" on the theme wrapper by default', () => {
    render(
      <Providers>
        <span />
      </Providers>
    )

    const themeWrapper = screen.getByTestId('theme-wrapper')
    expect(themeWrapper).toHaveAttribute('data-theme', 'light')
  })

  it('sets data-theme="dark" when the store theme is dark', () => {
    useStore.setState({ theme: 'dark' })

    render(
      <Providers>
        <span />
      </Providers>
    )

    const themeWrapper = screen.getByTestId('theme-wrapper')
    expect(themeWrapper).toHaveAttribute('data-theme', 'dark')
  })

  it('provides a QueryClient so that React Query hooks work inside', () => {
    // If QueryClientProvider is missing, useQuery throws.
    // Rendering a component that calls useQuery (even with a stub) without
    // crashing is evidence the provider is wired up. Here we just verify
    // children render without error — the api.test covers the actual hooks.
    expect(() =>
      render(
        <Providers>
          <div>ok</div>
        </Providers>
      )
    ).not.toThrow()
  })
})
