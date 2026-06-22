import { render, screen } from '@testing-library/react'
import { Field } from '../Field.jsx'

describe('Field', () => {
  test('renders label text', () => {
    render(
      <Field label="Email" htmlFor="email-input">
        <input id="email-input" />
      </Field>
    )
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  test('associates label with control via htmlFor', () => {
    render(
      <Field label="Username" htmlFor="username">
        <input id="username" />
      </Field>
    )
    const label = screen.getByText('Username')
    expect(label).toHaveAttribute('for', 'username')
  })

  test('label element has correct for attribute to associate with input', () => {
    render(
      <Field label="Name" htmlFor="name-field">
        <input id="name-field" />
      </Field>
    )
    const label = screen.getByText('Name')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('for', 'name-field')
    // Verify the input with the matching id is present (semantic association)
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'name-field')
  })

  test('renders children (the input control)', () => {
    render(
      <Field label="Password" htmlFor="pwd">
        <input id="pwd" type="password" placeholder="Enter password" />
      </Field>
    )
    expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument()
  })

  test('shows error message when error prop is provided', () => {
    render(
      <Field label="Email" htmlFor="email" error="Invalid email address">
        <input id="email" />
      </Field>
    )
    expect(screen.getByText('Invalid email address')).toBeInTheDocument()
  })

  test('error message has role=alert', () => {
    render(
      <Field label="Email" htmlFor="email" error="Required field">
        <input id="email" />
      </Field>
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Required field')
  })

  test('error message uses danger text color class', () => {
    render(
      <Field label="Email" htmlFor="email" error="Something went wrong">
        <input id="email" />
      </Field>
    )
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('text-danger')
  })

  test('does not render error element when error is undefined', () => {
    render(
      <Field label="Email" htmlFor="email">
        <input id="email" />
      </Field>
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('renders without label when label prop is omitted', () => {
    const { container } = render(
      <Field htmlFor="no-label">
        <input id="no-label" />
      </Field>
    )
    expect(container.querySelector('label')).toBeNull()
  })
})
