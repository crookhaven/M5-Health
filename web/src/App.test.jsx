// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

beforeEach(() => {
  localStorage.clear()
})

describe('App', () => {
  it('starts on the Import tab', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Import' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/no real data on hand yet/i)).toBeInTheDocument()
  })

  it('switches tabs on click', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: 'My data' }))
    expect(screen.getByRole('tab', { name: 'My data' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText(/no health information imported yet/i)).toBeInTheDocument()
  })

  it('loads the sample health record and shows it in My data', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Load sample health record' }))

    await user.click(screen.getByRole('tab', { name: 'My data' }))
    expect(screen.getByText('Atorvastatin')).toBeInTheDocument()
    expect(screen.getByText('Insulin pump')).toBeInTheDocument()
  })

  it('has no Findings tab, and What to do waits for a PIQI result', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Load sample health record' }))
    expect(screen.queryByRole('tab', { name: /findings/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'My data' }))
    await user.click(screen.getByRole('tab', { name: 'What to do' }))
    expect(screen.getByText(/run your piqi score first/i)).toBeInTheDocument()
  })

  it('keeps each patient records separate', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Load sample health record' }))
    await user.click(screen.getByRole('button', { name: 'Add patient' }))
    await user.type(screen.getByLabelText(/new patient name/i), 'Sam')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('tab', { name: 'My data' }))
    expect(screen.getByText(/no health information imported yet/i)).toBeInTheDocument()
    expect(screen.queryByText('Atorvastatin')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Family' }))
    expect(screen.getByRole('heading', { name: 'Sam' })).toBeInTheDocument()
  })
})
