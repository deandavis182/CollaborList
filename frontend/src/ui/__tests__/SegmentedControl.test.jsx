import { render, screen, fireEvent } from '@testing-library/react'
import { SegmentedControl } from '../SegmentedControl.jsx'

const OPTIONS = [
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
  { value: 'calendar', label: 'Calendar' },
]

describe('SegmentedControl', () => {
  test('renders all option labels', () => {
    render(<SegmentedControl options={OPTIONS} value="list" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'List' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Board' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calendar' })).toBeInTheDocument()
  })

  test('active segment has aria-pressed=true', () => {
    render(<SegmentedControl options={OPTIONS} value="board" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Board' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('inactive segments have aria-pressed=false', () => {
    render(<SegmentedControl options={OPTIONS} value="board" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('active segment applies highlighted class (bg-surface)', () => {
    render(<SegmentedControl options={OPTIONS} value="list" onChange={() => {}} />)
    const activeBtn = screen.getByRole('button', { name: 'List' })
    expect(activeBtn.className).toContain('bg-surface')
  })

  test('inactive segment does not apply bg-surface class directly', () => {
    render(<SegmentedControl options={OPTIONS} value="list" onChange={() => {}} />)
    const inactiveBtn = screen.getByRole('button', { name: 'Board' })
    // inactive uses bg-transparent, not the solid bg-surface
    expect(inactiveBtn.className).toContain('bg-transparent')
  })

  test('calls onChange with clicked segment value', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={OPTIONS} value="list" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Board' }))
    expect(onChange).toHaveBeenCalledWith('board')
  })

  test('calls onChange on every distinct segment click', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={OPTIONS} value="list" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Board' }))
    expect(onChange).toHaveBeenNthCalledWith(1, 'calendar')
    expect(onChange).toHaveBeenNthCalledWith(2, 'board')
  })

  test('renders group wrapper element', () => {
    render(<SegmentedControl options={OPTIONS} value="list" onChange={() => {}} />)
    expect(screen.getByRole('group')).toBeInTheDocument()
  })

  test('renders nothing extra when options is empty', () => {
    render(<SegmentedControl options={[]} value="" onChange={() => {}} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
