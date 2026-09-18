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
    expect(screen.getByText('Insulin pump')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^Findings/ }))
    expect(screen.getByText('COVID-19 vaccine: administration date missing')).toBeInTheDocument()

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
    const badge = within(findingsTab).getByText(/^\d+$/)
    expect(badge.getAttribute('aria-label')).toMatch(/open findings/)
  })

  it('lets a patient resolve a finding, which then disappears from the Findings tab', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Load sample health record' }))
    await user.click(screen.getByRole('tab', { name: /^Findings/ }))

    expect(screen.getByText('COVID-19 vaccine: administration date missing')).toBeInTheDocument()

    const findingRow = screen
      .getByText('COVID-19 vaccine: administration date missing')
      .closest('.finding-row')
    await user.click(within(findingRow).getByRole('button', { name: /add info/i }))
    await user.type(within(findingRow).getByPlaceholderText('Enter administration date'), '2026-09-01')
    await user.click(within(findingRow).getByRole('button', { name: /^save$/i }))

    expect(
      screen.queryByText('COVID-19 vaccine: administration date missing'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Health Record' }))
    const covidCard = screen.getByText('COVID-19 vaccine').closest('.record-card')
    expect(within(covidCard).getByText('2026-09-01')).toBeInTheDocument()
    expect(within(covidCard).getByText('patient-added')).toBeInTheDocument()
  })
})
