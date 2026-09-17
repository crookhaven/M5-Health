// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
    await user.click(screen.getByRole('tab', { name: 'Health Record' }))
    expect(screen.getByRole('tab', { name: 'Health Record' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText(/no health information imported yet/i)).toBeInTheDocument()
  })

  it('loads the sample health record and surfaces it across Dashboard, Findings, and Scorecard', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Load sample health record' }))

    await user.click(screen.getByRole('tab', { name: 'Health Record' }))
    expect(screen.getByText('Atorvastatin')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^Findings/ }))
    expect(screen.getByText('Atorvastatin: frequency missing')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Scorecard' }))
    expect(
      screen.getByText('This is NOT a health score. This is a data quality score.'),
    ).toBeInTheDocument()
  })

  it('shows an open findings count badge on the Findings tab after loading data', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Load sample health record' }))
    const findingsTab = screen.getByRole('tab', { name: /Findings/ })
    expect(within(findingsTab).getByText('8')).toHaveAttribute(
      'aria-label',
      '8 open findings',
    )
  })

  it('lets a patient resolve a finding, which then disappears from the Findings tab', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Load sample health record' }))
    await user.click(screen.getByRole('tab', { name: /^Findings/ }))

    expect(screen.getByText('Atorvastatin: frequency missing')).toBeInTheDocument()

    const findingRow = screen.getByText('Atorvastatin: frequency missing').closest('.finding-row')
    await user.click(within(findingRow).getByRole('button', { name: /add info/i }))
    await user.type(within(findingRow).getByPlaceholderText('Enter frequency'), 'Once daily')
    await user.click(within(findingRow).getByRole('button', { name: /^save$/i }))

    expect(screen.queryByText('Atorvastatin: frequency missing')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Health Record' }))
    const atorvastatinCard = screen.getByText('Atorvastatin').closest('.record-card')
    expect(within(atorvastatinCard).getByText('Once daily')).toBeInTheDocument()
    expect(within(atorvastatinCard).getByText('patient-added')).toBeInTheDocument()
  })
})
