// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkspaceProvider } from '../state/WorkspaceContext'
import { STORAGE_KEY, emptySlice } from '../state/workspaceState'
import { ADDED_LABEL } from '../lib/piqi/checkKind'
import WhatToDo from './WhatToDo'

const check = {
  id: 'medications:0:doseAmount:m1',
  domain: 'medications',
  claims: false,
  elementIndex: 0,
  elementLabel: 'Aspirin 81 MG',
  attribute: 'doseAmount',
  mnemonic: 'm1',
  assessment: 'Medication Dose Amount is populated',
  reason: 'empty',
  critical: false,
  recordId: 'r1',
}

function seed(gatewayResults) {
  const slice = { ...emptySlice(), gatewayResults }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 2,
      patients: [{ id: 'p1', name: 'Patient 1' }],
      activeId: 'p1',
      data: { p1: slice },
    }),
  )
}

const result = {
  profileName: 'Test Rubric',
  score: 50,
  numerator: 1,
  denominator: 2,
  criticalFailureCount: 0,
  checks: [check],
  loadedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  localStorage.clear()
})

describe('WhatToDo', () => {
  it('asks for a PIQI result first and shows no checks of its own', () => {
    render(
      <WorkspaceProvider>
        <WhatToDo dataset="clinical" />
      </WorkspaceProvider>,
    )
    expect(screen.getByText(/run your piqi score first/i)).toBeInTheDocument()
  })

  it('marks an added value for re-audit without changing the official score', async () => {
    seed({ clinical: result })
    const user = userEvent.setup()
    render(
      <WorkspaceProvider>
        <WhatToDo dataset="clinical" />
      </WorkspaceProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Add info' }))
    await user.type(screen.getByPlaceholderText(/^Enter /), '10')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText(ADDED_LABEL)).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('lets a check be ignored for now and put back', async () => {
    seed({ clinical: result })
    const user = userEvent.setup()
    render(
      <WorkspaceProvider>
        <WhatToDo dataset="clinical" />
      </WorkspaceProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Ignore for now' }))
    expect(screen.getByText(/ignored for now \(1\)/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Put back' }))
    expect(screen.queryByText(/ignored for now \(1\)/i)).not.toBeInTheDocument()
  })
})
