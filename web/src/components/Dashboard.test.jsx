// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Dashboard from './Dashboard'

function record(id, domain, data, source = {}) {
  return {
    id,
    domain,
    data,
    source: { type: 'sample', documentName: 'test.json', importedAt: new Date().toISOString(), ...source },
    raw: null,
  }
}

describe('Dashboard', () => {
  it('shows an empty state with no records', () => {
    render(<Dashboard sourceRecords={[]} assertions={[]} />)
    expect(screen.getByText(/no health information imported yet/i)).toBeInTheDocument()
  })

  it('renders a medication record with its fields and source', () => {
    const records = [
      record('m1', 'medications', {
        name: 'Lisinopril',
        dosage: '20 mg',
        frequency: 'Once daily',
        route: 'Oral',
        status: 'active',
      }),
    ]
    render(<Dashboard sourceRecords={records} assertions={[]} />)
    expect(screen.getByText('Lisinopril')).toBeInTheDocument()
    expect(screen.getByText('20 mg')).toBeInTheDocument()
    expect(screen.getByText(/Sample data/)).toBeInTheDocument()
  })

  it('flags a missing required field as not recorded', () => {
    const records = [
      record('m1', 'medications', {
        name: 'Atorvastatin',
        dosage: '40 mg',
        route: 'Oral',
        status: 'active',
      }),
    ]
    render(<Dashboard sourceRecords={records} assertions={[]} />)
    expect(screen.getByText('not recorded')).toBeInTheDocument()
  })

  it('shows a patient-added tag and Patient Confirmed status when an assertion fills a field', () => {
    const records = [
      record('m1', 'medications', {
        name: 'Atorvastatin',
        dosage: '40 mg',
        route: 'Oral',
        status: 'active',
      }),
    ]
    const assertions = [
      {
        id: 'a1',
        kind: 'field',
        sourceRecordId: 'm1',
        domain: 'medications',
        field: 'frequency',
        value: 'Once daily',
        createdAt: new Date().toISOString(),
      },
      { id: 'a2', kind: 'confirm', sourceRecordId: 'm1', domain: 'medications', createdAt: new Date().toISOString() },
    ]
    render(<Dashboard sourceRecords={records} assertions={assertions} />)
    expect(screen.getByText('Once daily')).toBeInTheDocument()
    expect(screen.getByText('patient-added')).toBeInTheDocument()
    expect(screen.getByText(/Patient Confirmed/)).toBeInTheDocument()
  })

  it('renders a coverage record via the coverage screen', () => {
    const records = [record('c1', 'coverage', { plan_name: 'Simply Blue HSA PPO' })]
    render(<Dashboard sourceRecords={records} assertions={[]} />)
    expect(screen.getByText('Simply Blue HSA PPO')).toBeInTheDocument()
  })
})
