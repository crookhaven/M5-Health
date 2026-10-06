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

  it('shows populated optional and extra fields, without repeating a value', () => {
    const records = [
      record('c1', 'conditions', {
        condition: codeableConcept({ text: 'Type 2 diabetes' }),
        conditionStatus: codeableConcept({ text: 'Active' }),
        clinicalStatus: codeableConcept({ text: 'Active' }),
        onsetDate: '2008-07-16',
        encounter: 'Office visit 2008-07-16',
      }),
    ]
    render(<Dashboard sourceRecords={records} assertions={[]} />)
    expect(screen.getByText('onset date')).toBeInTheDocument()
    expect(screen.getByText('encounter')).toBeInTheDocument()
    expect(screen.getByText('Office visit 2008-07-16')).toBeInTheDocument()
    // Clinical status has the same value as condition status, so it is shown once.
    expect(screen.getAllByText('Active')).toHaveLength(1)
    expect(screen.queryByText('clinical status')).not.toBeInTheDocument()
  })

  it('renders imaging with its report, newest first, and no missing-field flags', () => {
    const records = [
      record('i1', 'imaging', { title: 'US Kidneys', date: '2018-08-28T10:15:00-05:00', modality: 'Ultrasound', conclusion: 'No hydronephrosis.', reportText: 'FINDINGS: normal.' }),
      record('i2', 'imaging', { title: 'OCT Macula', date: '2026-08-03', modality: 'Ophthalmic Tomography' }),
    ]
    render(<Dashboard sourceRecords={records} assertions={[]} />)
    expect(screen.getByRole('heading', { name: 'Imaging' })).toBeInTheDocument()
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['OCT Macula', 'US Kidneys'])
    // Shown as the card badge and the Date field, trimmed to the day.
    expect(screen.getAllByText('2018-08-28')).toHaveLength(2)
    expect(screen.getByText('No hydronephrosis.')).toBeInTheDocument()
    expect(screen.getByText('Show full report')).toBeInTheDocument()
    expect(screen.getByText('FINDINGS: normal.')).toBeInTheDocument()
    expect(screen.queryByText('not recorded')).not.toBeInTheDocument()
  })

  it('renders a clinical note and says when its content is not shown', () => {
    const records = [
      record('n1', 'clinicalNotes', { title: 'Summary of episode note', noteType: 'Summary', omitted: 'application/xml document, not shown here' }),
    ]
    render(<Dashboard sourceRecords={records} assertions={[]} />)
    expect(screen.getByRole('heading', { name: 'Clinical Notes & Reports' })).toBeInTheDocument()
    expect(screen.getByText('application/xml document, not shown here')).toBeInTheDocument()
  })
})
