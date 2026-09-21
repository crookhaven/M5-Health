// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Dashboard from './Dashboard'
import { codeableConcept } from '../lib/piqi/attributeTypes'

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
        medication: codeableConcept({ text: 'Lisinopril' }),
        doseAmount: '20',
        doseRoute: codeableConcept({ text: 'Oral' }),
        requestStatus: codeableConcept({ text: 'active' }),
      }),
    ]
    render(<Dashboard sourceRecords={records} assertions={[]} />)
    expect(screen.getByText('Lisinopril')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText(/Sample data/)).toBeInTheDocument()
  })

  it('flags a missing required field as not recorded', () => {
    const records = [
      record('m1', 'medications', {
        medication: codeableConcept({ text: 'Atorvastatin' }),
        doseAmount: '40',
        requestStatus: codeableConcept({ text: 'active' }),
      }),
    ]
    render(<Dashboard sourceRecords={records} assertions={[]} />)
    expect(screen.getByText('not recorded')).toBeInTheDocument()
  })

  it('shows a patient-added tag and Patient Confirmed status when an assertion fills a field', () => {
    const records = [
      record('m1', 'medications', {
        medication: codeableConcept({ text: 'Atorvastatin' }),
        doseAmount: '40',
        requestStatus: codeableConcept({ text: 'active' }),
      }),
    ]
    const assertions = [
      {
        id: 'a1',
        kind: 'field',
        sourceRecordId: 'm1',
        domain: 'medications',
        field: 'doseRoute',
        value: codeableConcept({ text: 'Oral' }),
        createdAt: new Date().toISOString(),
      },
      { id: 'a2', kind: 'confirm', sourceRecordId: 'm1', domain: 'medications', createdAt: new Date().toISOString() },
    ]
    render(<Dashboard sourceRecords={records} assertions={assertions} />)
    expect(screen.getByText('Oral')).toBeInTheDocument()
    expect(screen.getByText('patient-added')).toBeInTheDocument()
    expect(screen.getByText(/Patient Confirmed/)).toBeInTheDocument()
  })

  it('renders a demographics record using firstName + lastName as the title', () => {
    const records = [
      record('d1', 'demographics', {
        firstName: 'Jordan',
        lastName: 'Rivera',
        birthDate: '1985-04-12',
        birthSex: codeableConcept({ text: 'female' }),
      }),
    ]
    render(<Dashboard sourceRecords={records} assertions={[]} />)
    expect(screen.getByText('Jordan Rivera')).toBeInTheDocument()
    expect(screen.getByText('1985-04-12')).toBeInTheDocument()
  })

  it('renders a coverage record via the coverage screen', () => {
    const records = [record('c1', 'coverage', { plan_name: 'Simply Blue HSA PPO' })]
    render(<Dashboard sourceRecords={records} assertions={[]} />)
    expect(screen.getByText('Simply Blue HSA PPO')).toBeInTheDocument()
  })
})
