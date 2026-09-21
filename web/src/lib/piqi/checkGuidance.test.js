import { describe, it, expect } from 'vitest'
import { guidanceForCheck, buildCheckProviderNote } from './checkGuidance'

const base = { recordId: 'r1', reason: '' }

describe('guidanceForCheck', () => {
  it('lets the patient fix a missing medication dose, mentioning the strength in the name', () => {
    const g = guidanceForCheck({ ...base, domain: 'medications', attribute: 'doseAmount', elementLabel: 'Lisinopril 10 MG Oral Tablet', assessment: 'Medication Dose Amount is populated' })
    expect(g.route).toBe('fix')
    expect(g.explanation).toMatch(/strength \(10 MG\)/)
  })

  it('treats code-list failures as technical, not something the patient types in', () => {
    const g = guidanceForCheck({ ...base, domain: 'medications', attribute: 'doseAmountUnit', assessment: 'Medication Dose Amount Unit is in UCUM' })
    expect(g.route).toBe('provider')
    expect(g.technical).toBe(true)
  })

  it('sends missing lab values to the provider', () => {
    const g = guidanceForCheck({ ...base, domain: 'labResults', attribute: 'resultValue', assessment: 'Lab Result Value is populated' })
    expect(g.route).toBe('provider')
    expect(g.technical).toBe(false)
  })
})

describe('buildCheckProviderNote', () => {
  it('numbers one question per flagged check', () => {
    const note = buildCheckProviderNote([{ ...base, domain: 'medications', attribute: 'doseAmount', elementLabel: 'Lisinopril', assessment: 'Medication Dose Amount is populated' }])
    expect(note).toMatch(/1\. A data-quality check/)
  })
})

describe('IPS rubric checks', () => {
  const base = { recordId: 'r1', reason: '' }

  it('lets the patient add contact details and language', () => {
    for (const attribute of ['telecom', 'currentAddress', 'primaryLanguage']) {
      const g = guidanceForCheck({ ...base, domain: 'demographics', attribute, assessment: `patient ${attribute} is populated` })
      expect(g.route).toBe('fix')
    }
  })

  it('lets the patient add a dose unit and a condition or allergy status', () => {
    expect(guidanceForCheck({ ...base, domain: 'medications', attribute: 'doseAmountUnit', assessment: 'medication dose unit is populated' }).route).toBe('fix')
    expect(guidanceForCheck({ ...base, domain: 'conditions', attribute: 'clinicalStatus', assessment: 'condition clinical status is populated' }).route).toBe('fix')
    expect(guidanceForCheck({ ...base, domain: 'allergies', attribute: 'clinicalStatus', assessment: 'allergy clinical status is populated' }).explanation).toMatch(/allergy/)
  })

  it('names the expected code systems on a coded check and keeps it technical', () => {
    const g = guidanceForCheck({ ...base, critical: true, domain: 'allergies', attribute: 'substance', assessment: 'allergy substance is SNOMED CT or RxNorm' })
    expect(g.technical).toBe(true)
    expect(g.explanation).toMatch(/SNOMED CT or RxNorm/)
  })

  it('lets the patient fix a start date that is not a valid date', () => {
    const g = guidanceForCheck({ ...base, domain: 'medications', attribute: 'startDate', assessment: 'medication start date is a valid date' })
    expect(g.route).toBe('fix')
  })
})
