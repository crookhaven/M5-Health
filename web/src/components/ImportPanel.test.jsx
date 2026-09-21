// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkspaceProvider } from '../state/WorkspaceContext'
import ImportPanel from './ImportPanel'

const STORAGE_KEY = 'm5-health-workspace-v1'

function workspaceState() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
  return saved.data[saved.activeId]
}

beforeEach(() => {
  localStorage.clear()
})

describe('FHIR Bundle import', () => {
  it('imports records from an uploaded FHIR Bundle', async () => {
    const user = userEvent.setup()
    render(
      <WorkspaceProvider>
        <ImportPanel />
      </WorkspaceProvider>,
    )

    const bundle = {
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'Condition',
            code: { text: 'Seasonal allergies' },
            clinicalStatus: { coding: [{ code: 'active' }] },
          },
        },
      ],
    }
    const file = new File([JSON.stringify(bundle)], 'patient.json', { type: 'application/json' })

    const input = screen.getByLabelText('Choose FHIR Bundle JSON file')
    await user.upload(input, file)

    expect(await screen.findByText('Imported 1 records from patient.json.')).toBeInTheDocument()
    const state = workspaceState()
    expect(state.sourceRecords).toHaveLength(1)
    expect(state.sourceRecords[0].domain).toBe('conditions')
    expect(state.sourceRecords[0].source.type).toBe('fhir-bundle-upload')
    expect(state.sourceRecords[0].source.documentName).toBe('patient.json')
  })

  it('shows an error for a file with no recognizable FHIR resources', async () => {
    const user = userEvent.setup()
    render(
      <WorkspaceProvider>
        <ImportPanel />
      </WorkspaceProvider>,
    )

    const file = new File([JSON.stringify({ foo: 'bar' })], 'not-fhir.json', {
      type: 'application/json',
    })
    const input = screen.getByLabelText('Choose FHIR Bundle JSON file')
    await user.upload(input, file)

    expect(await screen.findByText(/no recognized fhir resources/i)).toBeInTheDocument()
    expect(workspaceState().sourceRecords).toHaveLength(0)
  })
})

describe('Import panel notice', () => {
  it('tells people not to import real health information', () => {
    render(
      <WorkspaceProvider>
        <ImportPanel />
      </WorkspaceProvider>,
    )
    expect(screen.getByText(/Do not import real health information/)).toBeInTheDocument()
  })
})
