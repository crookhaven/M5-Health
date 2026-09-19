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
