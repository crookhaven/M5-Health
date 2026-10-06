// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClinicalView from './ClinicalView'
import { codeableConcept, coding } from '../lib/piqi/attributeTypes'

function record(id, domain, data) {
  return { id, domain, data, source: { type: 'smart-health-link', documentName: 'x', importedAt: new Date().toISOString() }, raw: null }
}

const records = [
  record('c1', 'conditions', {
    condition: codeableConcept({
      text: 'Type 2 diabetes with CKD',
      codings: [
        coding({ system: 'http://snomed.info/sct', code: '127013003', display: 'Diabetic renal disease' }),
        coding({ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'E11.22', display: 'Type 2 diabetes with CKD' }),
      ],
    }),
    conditionStatus: codeableConcept({ text: 'Active' }),
    onsetDate: '2018-07-14',
  }),
  record('d1', 'medicalDevices', { deviceType: codeableConcept({ text: 'Hearing aid, both ears' }), deviceStatus: codeableConcept({ text: 'active' }) }),
  record('n1', 'clinicalNotes', { title: 'Endocrinology Consultation', noteType: 'Consult note', date: '2026-08-18T16:30:00-05:00', text: 'PLAN: start empagliflozin' }),
]

describe('ClinicalView', () => {
  it('shows each section as a table with codes, dates and details', () => {
    render(<ClinicalView sourceRecords={records} assertions={[]} />)
    const conditions = screen.getByRole('heading', { name: /Conditions/ }).closest('section')
    const row = within(conditions).getByRole('row', { name: /Type 2 diabetes with CKD/ })
    expect(within(row).getByText('E11.22')).toBeInTheDocument()
    expect(within(row).getByText('ICD-10-CM')).toBeInTheDocument()
    expect(within(row).getByText('127013003')).toBeInTheDocument()
    expect(within(row).getByText('2018-07-14')).toBeInTheDocument()
    expect(within(row).getByText('Active')).toBeInTheDocument()
  })

  it('shows notes with their full text available', () => {
    render(<ClinicalView sourceRecords={records} assertions={[]} />)
    expect(screen.getByText('Endocrinology Consultation')).toBeInTheDocument()
    expect(screen.getByText('Full note')).toBeInTheDocument()
    expect(screen.getByText('PLAN: start empagliflozin')).toBeInTheDocument()
  })

  it('filters by specialty', async () => {
    const user = userEvent.setup()
    render(<ClinicalView sourceRecords={records} assertions={[]} />)
    await user.click(screen.getByRole('button', { name: 'Hearing (1)' }))
    expect(screen.getByText('Hearing aid, both ears')).toBeInTheDocument()
    expect(screen.queryByText('Type 2 diabetes with CKD')).not.toBeInTheDocument()
    expect(screen.queryByText('Endocrinology Consultation')).not.toBeInTheDocument()
  })
})
