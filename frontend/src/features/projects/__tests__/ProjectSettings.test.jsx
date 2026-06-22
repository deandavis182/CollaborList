import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api hooks before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useUpdateProject: vi.fn(),
  useDeleteProject: vi.fn(),
}))

// Mock store — setCurrentProject and currentProjectId
vi.mock('../../../lib/store.js', () => ({
  useStore: vi.fn(),
}))

import { useUpdateProject, useDeleteProject } from '../../../lib/api.js'
import { useStore } from '../../../lib/store.js'
import { ProjectSettings } from '../ProjectSettings.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ children }) {
  return (
    <QueryClientProvider client={makeQC()}>
      {children}
    </QueryClientProvider>
  )
}

const PROJECT = {
  id: 42,
  name: 'Summer Wedding',
  color: '#7C6FF7',
  wedding_date: '2026-08-15',
  archived: false,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ProjectSettings', () => {
  let mockUpdate
  let mockDelete

  beforeEach(() => {
    mockUpdate = vi.fn()
    mockDelete = vi.fn()

    useUpdateProject.mockReturnValue({
      mutate: mockUpdate,
      isPending: false,
      isError: false,
      error: null,
    })

    useDeleteProject.mockReturnValue({
      mutate: mockDelete,
      isPending: false,
      isError: false,
      error: null,
    })

    useStore.mockReturnValue({
      currentProjectId: 42,
      setCurrentProject: vi.fn(),
    })
  })

  it('renders nothing when open is false', () => {
    render(
      <ProjectSettings
        project={PROJECT}
        workspaceId={1}
        open={false}
        onClose={vi.fn()}
      />,
      { wrapper: Wrapper }
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders a dialog when open is true', () => {
    render(
      <ProjectSettings
        project={PROJECT}
        workspaceId={1}
        open={true}
        onClose={vi.fn()}
      />,
      { wrapper: Wrapper }
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('rename: calls useUpdateProject with {id, name} when Save is clicked', () => {
    render(
      <ProjectSettings
        project={PROJECT}
        workspaceId={1}
        open={true}
        onClose={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    const nameInput = screen.getByLabelText(/name/i)
    fireEvent.change(nameInput, { target: { value: 'Autumn Wedding' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, name: 'Autumn Wedding' }),
      expect.any(Object)
    )
  })

  it('color: selecting a color swatch calls useUpdateProject with {id, color}', () => {
    render(
      <ProjectSettings
        project={PROJECT}
        workspaceId={1}
        open={true}
        onClose={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    // Find any color swatch button (aria-label contains "color")
    const swatches = screen.getAllByRole('button', { name: /color/i })
    fireEvent.click(swatches[0])

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, color: expect.any(String) })
    )
  })

  it('date: setting the wedding_date calls useUpdateProject with {id, wedding_date}', () => {
    render(
      <ProjectSettings
        project={PROJECT}
        workspaceId={1}
        open={true}
        onClose={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    const dateInput = screen.getByLabelText(/target|event date/i)
    fireEvent.change(dateInput, { target: { value: '2027-06-01' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, wedding_date: '2027-06-01' }),
      expect.any(Object)
    )
  })

  it('archive: toggling archive calls useUpdateProject with {id, archived: true}', () => {
    render(
      <ProjectSettings
        project={PROJECT}
        workspaceId={1}
        open={true}
        onClose={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    const archiveCheckbox = screen.getByRole('checkbox', { name: /archive/i })
    fireEvent.click(archiveCheckbox)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, archived: true }),
      expect.any(Object)
    )
  })

  it('archive: un-archiving calls useUpdateProject with {id, archived: false}', () => {
    render(
      <ProjectSettings
        project={{ ...PROJECT, archived: true }}
        workspaceId={1}
        open={true}
        onClose={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    const archiveCheckbox = screen.getByRole('checkbox', { name: /archive/i })
    fireEvent.click(archiveCheckbox)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, archived: false }),
      expect.any(Object)
    )
  })

  it('delete: calls useDeleteProject with project id after confirm', () => {
    render(
      <ProjectSettings
        project={PROJECT}
        workspaceId={1}
        open={true}
        onClose={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    // First click: enters confirm state
    const deleteBtn = screen.getByRole('button', { name: /delete/i })
    fireEvent.click(deleteBtn)

    // Second click: confirms deletion
    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    fireEvent.click(confirmBtn)

    expect(mockDelete).toHaveBeenCalledWith(42, expect.any(Object))
  })

  it('delete: clears currentProjectId and closes when deleted project is current', () => {
    const mockSetCurrentProject = vi.fn()
    useStore.mockReturnValue({
      currentProjectId: 42,
      setCurrentProject: mockSetCurrentProject,
    })

    const onClose = vi.fn()
    mockDelete.mockImplementation((_id, options) => {
      options?.onSuccess?.()
    })

    render(
      <ProjectSettings
        project={PROJECT}
        workspaceId={1}
        open={true}
        onClose={onClose}
      />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    expect(mockSetCurrentProject).toHaveBeenCalledWith(null)
    expect(onClose).toHaveBeenCalled()
  })

  it('shows error toast when update fails', () => {
    useUpdateProject.mockReturnValue({
      mutate: mockUpdate,
      isPending: false,
      isError: true,
      error: { message: 'Failed to update' },
    })

    render(
      <ProjectSettings
        project={PROJECT}
        workspaceId={1}
        open={true}
        onClose={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    // Error shown (Toast role="status" or alert)
    expect(screen.getByText(/failed to update/i)).toBeInTheDocument()
  })
})
