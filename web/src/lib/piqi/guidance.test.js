import { describe, it, expect } from 'vitest'
import { withGuidance, buildProviderNote, ROUTE_FIX, ROUTE_PROVIDER } from './guidance'

const base = { recordIds: ['r1'], description: 'x' }

describe('withGuidance', () => {
  it('lets the patient fix a missing medication dose', () => {
    const g = withGuidance({
      ...base, id: 'a', domain: 'medications', dimension: 'completeness',
      field: 'doseAmount', title: 'Atorvastatin: dose amount missing',
    })
    expect(g.route).toBe(ROUTE_FIX)
    expect(g.nextStep).toMatch(/pill bottle/i)
  })

  it('explains that a strength in the name is not the amount taken each time', () => {
    const g = withGuidance({
      ...base, id: 'a2', domain: 'medications', dimension: 'completeness',
      field: 'doseAmount', title: 'Lisinopril 10 MG Oral Tablet: dose amount missing',
    })
    expect(g.route).toBe(ROUTE_FIX)
    expect(g.explanation).toMatch(/strength \(10 MG\)/)
    expect(g.explanation).toMatch(/each time or how often/)
  })

  it('sends a missing lab value to the provider, never the patient', () => {
    const g = withGuidance({
      ...base, id: 'b', domain: 'labResults', dimension: 'completeness',
      field: 'resultValue', title: 'Hemoglobin A1c: result value missing',
    })
    expect(g.route).toBe(ROUTE_PROVIDER)
  })

  it('sends conflicting records to the provider', () => {
    const g = withGuidance({
      ...base, id: 'c', domain: 'medications', dimension: 'consistency',
      field: null, title: 'Lisinopril: conflicting details across sources',
    })
    expect(g.route).toBe(ROUTE_PROVIDER)
    expect(g.providerQuestion).toMatch(/Lisinopril/)
  })

  it('lets the patient resolve duplicates, but routes stale labs to the provider', () => {
    const dup = withGuidance({
      ...base, id: 'd', domain: 'medications', dimension: 'duplication',
      field: null, title: 'Lisinopril: appears 2 times from different sources',
    })
    const stale = withGuidance({
      ...base, id: 'e', domain: 'labResults', dimension: 'timeliness',
      field: null, title: 'Hemoglobin A1c: potentially stale',
    })
    expect(dup.route).toBe(ROUTE_FIX)
    expect(stale.route).toBe(ROUTE_PROVIDER)
  })
})

describe('buildProviderNote', () => {
  it('numbers one question per flagged finding', () => {
    const note = buildProviderNote([
      { ...base, id: 'c', domain: 'medications', dimension: 'consistency', field: null, title: 'Lisinopril: conflicting details across sources' },
    ])
    expect(note).toMatch(/1\. My records list "Lisinopril"/)
  })
})
