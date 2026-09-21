// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkspaceProvider } from '../state/WorkspaceContext'
import ComparePlans from './ComparePlans'

function renderCompare() {
  return render(
    <WorkspaceProvider>
      <ComparePlans />
    </WorkspaceProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('ComparePlans', () => {
  it('starts with clearly labelled invented sample plans side by side', () => {
    renderCompare()
    expect(screen.getByRole('note')).toHaveTextContent(/invented sample plans/i)
    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Sample Bronze Saver' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Sample Platinum Plus' })).toBeInTheDocument()
    expect(within(table).getByRole('rowheader', { name: 'Monthly premium' })).toBeInTheDocument()
    expect(
      within(table).getByRole('rowheader', { name: /Estimated total for the year/ }),
    ).toBeInTheDocument()
  })

  it('lets a plan be removed, and all plans be cleared and selected again', async () => {
    const user = userEvent.setup()
    renderCompare()
    await user.click(screen.getByRole('checkbox', { name: /Sample Bronze Saver/ }))
    expect(
      within(screen.getByRole('table')).queryByRole('columnheader', { name: 'Sample Bronze Saver' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Select all shown' }))
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(5)
  })

  it('filters the plan list by metal level', async () => {
    const user = userEvent.setup()
    renderCompare()
    await user.click(screen.getByRole('checkbox', { name: 'Gold' }))
    expect(screen.getByRole('checkbox', { name: /Sample Gold HSA/ })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Sample Bronze Saver/ })).not.toBeInTheDocument()
  })

  it('shows quick picks and an opt-in Claude summary that includes no name', async () => {
    const user = userEvent.setup()
    renderCompare()
    expect(screen.getByLabelText('Quick picks')).toHaveTextContent(/Lowest estimated cost/)
    await user.click(screen.getByRole('button', { name: /Prepare my summary for Claude/ }))
    expect(screen.getByText(/Never included:/)).toBeInTheDocument()
    const text = screen.getByLabelText(/What will be copied/).value
    expect(text).toMatch(/Plan 1: Sample Bronze Saver/)
    expect(text).toMatch(/Possible future needs/)
  })

  it('shows an error for a file with no plans', async () => {
    const user = userEvent.setup()
    renderCompare()
    const file = new File(['{"plans": []}'], 'empty.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText(/load plans file/i), file)
    expect(await screen.findByRole('alert')).toHaveTextContent(/no plans found/i)
  })
})
