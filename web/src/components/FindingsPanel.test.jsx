// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkspaceProvider } from '../state/WorkspaceContext'
import FindingsPanel from './FindingsPanel'

const STORAGE_KEY = 'm5-health-workspace-v1'

function workspaceState() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY))
}

function renderWithProvider(findings) {
  return render(
    <WorkspaceProvider>
      <FindingsPanel findings={findings} />
    </WorkspaceProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('FindingsPanel', () => {
  it('shows an empty state with no findings', () => {
    renderWithProvider([])
    expect(screen.getByText(/no findings/i)).toBeInTheDocument()
  })

  it('groups findings under their dimension heading', () => {
    const findings = [
      {
        id: 'f1',
        domain: 'medications',
        dimension: 'completeness',
        field: 'frequency',
        title: 'Atorvastatin: frequency missing',
        description: 'frequency was not present.',
        decision: null,
      },
      {
        id: 'f2',
        domain: 'labs',
        dimension: 'timeliness',
        field: null,
        title: 'Hemoglobin A1c: potentially stale',
        description: 'more than two years old.',
        decision: null,
      },
    ]
    renderWithProvider(findings)
    expect(screen.getByRole('heading', { name: 'Completeness' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Timeliness' })).toBeInTheDocument()
    expect(screen.getByText('Atorvastatin: frequency missing')).toBeInTheDocument()
    expect(screen.getByText('Hemoglobin A1c: potentially stale')).toBeInTheDocument()
  })

  it('records an ignore_for_now decision in the workspace', async () => {
    const user = userEvent.setup()
    const findings = [
      {
        id: 'f1',
        domain: 'labs',
        dimension: 'timeliness',
        field: null,
        title: 'Hemoglobin A1c: potentially stale',
        description: 'more than two years old.',
        decision: null,
      },
    ]
    renderWithProvider(findings)
    await user.click(screen.getByRole('button', { name: /ignore for now/i }))
    expect(workspaceState().findingDecisions.f1.status).toBe('ignore_for_now')
  })

  it('saves a patient assertion without touching the source record', async () => {
    const user = userEvent.setup()
    const findings = [
      {
        id: 'f1',
        domain: 'medications',
        dimension: 'completeness',
        field: 'frequency',
        recordIds: ['m1'],
        title: 'Atorvastatin: frequency missing',
        description: 'frequency was not present.',
        decision: null,
      },
    ]
    renderWithProvider(findings)
    await user.click(screen.getByRole('button', { name: /add info/i }))
    await user.type(screen.getByPlaceholderText('Enter frequency'), 'Once daily')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    const state = workspaceState()
    expect(state.assertions).toHaveLength(1)
    expect(state.assertions[0]).toMatchObject({
      kind: 'field',
      sourceRecordId: 'm1',
      field: 'frequency',
      value: 'Once daily',
    })
    expect(state.findingDecisions.f1.status).toBe('reviewed')
  })
})
