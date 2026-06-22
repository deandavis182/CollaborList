import { render, screen } from '@testing-library/react'

function Hello() {
  return <p>CollaborList V2 test runner is working</p>
}

test('smoke: renders a component into jsdom and jest-dom matchers work', () => {
  render(<Hello />)
  expect(screen.getByText('CollaborList V2 test runner is working')).toBeInTheDocument()
})
