import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock ../../lib/api before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useAttachments: vi.fn(),
  useUploadAttachment: vi.fn(),
  useDeleteAttachment: vi.fn(),
}))

import { useAttachments, useUploadAttachment, useDeleteAttachment } from '../../../lib/api.js'
import { AttachmentList } from '../AttachmentList.jsx'

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

const IMAGE_ATTACHMENT = {
  id: 'att-1',
  filename: 'photo.jpg',
  mime_type: 'image/jpeg',
}

const PDF_ATTACHMENT = {
  id: 'att-2',
  filename: 'document.pdf',
  mime_type: 'application/pdf',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AttachmentList', () => {
  let mockUploadMutate
  let mockDeleteMutate

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock localStorage.getItem to return a token
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'token') return 'test-jwt-token'
      return null
    })

    mockUploadMutate = vi.fn()
    mockDeleteMutate = vi.fn()

    useUploadAttachment.mockReturnValue({ mutate: mockUploadMutate, isPending: false })
    useDeleteAttachment.mockReturnValue({ mutate: mockDeleteMutate, isPending: false })
  })

  // ── Empty state ─────────────────────────────────────────────────────────

  it('renders the attachment-list container', () => {
    useAttachments.mockReturnValue({ data: [] })

    render(<AttachmentList itemId="item-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('attachment-list')).toBeInTheDocument()
  })

  it('shows "No attachments" hint when there are no attachments', () => {
    useAttachments.mockReturnValue({ data: [] })

    render(<AttachmentList itemId="item-1" />, { wrapper: Wrapper })

    expect(screen.getByText('No attachments')).toBeInTheDocument()
  })

  // ── Image attachment ─────────────────────────────────────────────────────

  it('renders an <img> for an image attachment whose src contains the download URL', () => {
    useAttachments.mockReturnValue({ data: [IMAGE_ATTACHMENT] })

    render(<AttachmentList itemId="item-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('attachment-att-1')).toBeInTheDocument()
    const img = screen.getByRole('img', { name: 'photo.jpg' })
    expect(img).toBeInTheDocument()
    expect(img.src).toContain(`/api/attachments/att-1/download`)
  })

  it('image download URL includes the token from localStorage', () => {
    useAttachments.mockReturnValue({ data: [IMAGE_ATTACHMENT] })

    render(<AttachmentList itemId="item-1" />, { wrapper: Wrapper })

    const img = screen.getByRole('img', { name: 'photo.jpg' })
    expect(img.src).toContain('test-jwt-token')
  })

  // ── Non-image attachment ─────────────────────────────────────────────────

  it('renders a download link (not an img) for a non-image attachment showing the filename', () => {
    useAttachments.mockReturnValue({ data: [PDF_ATTACHMENT] })

    render(<AttachmentList itemId="item-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('attachment-att-2')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    const link = screen.getByText('document.pdf')
    expect(link.tagName).toBe('A')
    expect(link.href).toContain(`/api/attachments/att-2/download`)
  })

  // ── Delete ────────────────────────────────────────────────────────────────

  it('clicking the delete button calls useDeleteAttachment.mutate(id)', () => {
    useAttachments.mockReturnValue({ data: [IMAGE_ATTACHMENT] })

    render(<AttachmentList itemId="item-1" />, { wrapper: Wrapper })

    const deleteBtn = screen.getByTestId('delete-attachment-att-1')
    fireEvent.click(deleteBtn)

    expect(mockDeleteMutate).toHaveBeenCalledWith('att-1')
  })

  it('renders a delete button per attachment with correct testid', () => {
    useAttachments.mockReturnValue({ data: [IMAGE_ATTACHMENT, PDF_ATTACHMENT] })

    render(<AttachmentList itemId="item-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('delete-attachment-att-1')).toBeInTheDocument()
    expect(screen.getByTestId('delete-attachment-att-2')).toBeInTheDocument()
  })

  // ── Upload ────────────────────────────────────────────────────────────────

  it('renders the file upload input', () => {
    useAttachments.mockReturnValue({ data: [] })

    render(<AttachmentList itemId="item-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('attachment-upload-input')).toBeInTheDocument()
  })

  it('upload input onChange calls useUploadAttachment.mutate(file)', () => {
    useAttachments.mockReturnValue({ data: [] })

    render(<AttachmentList itemId="item-1" />, { wrapper: Wrapper })

    const input = screen.getByTestId('attachment-upload-input')
    const file = new File(['hello'], 'hello.png', { type: 'image/png' })

    fireEvent.change(input, { target: { files: [file] } })

    expect(mockUploadMutate).toHaveBeenCalledWith(file)
  })

  it('useUploadAttachment is called with itemId', () => {
    useAttachments.mockReturnValue({ data: [] })

    render(<AttachmentList itemId="item-42" />, { wrapper: Wrapper })

    expect(useUploadAttachment).toHaveBeenCalledWith('item-42')
  })

  it('useDeleteAttachment is called with itemId', () => {
    useAttachments.mockReturnValue({ data: [] })

    render(<AttachmentList itemId="item-42" />, { wrapper: Wrapper })

    expect(useDeleteAttachment).toHaveBeenCalledWith('item-42')
  })
})
