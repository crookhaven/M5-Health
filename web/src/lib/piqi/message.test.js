import { describe, it, expect } from 'vitest'
import { buildPiqiMessage, PIQI_MESSAGE_DOMAINS } from './message'
import { codeableConcept, observationValue } from './attributeTypes'

function record(id, domain, data) {
  return {
    id,
    domain,
    data,
    source: { type: 'sample', documentName: 'test.json', importedAt: new Date().toISOString() },
    raw: null,
  }
}

describe('buildPiqiMessage', () => {
  it('nests records under patient, keyed by PIQI data class field name', () => {
    const records = [
      record('m1', 'medications', {
        medication: codeableConcept({ text: 'Lisinopril' }),
        doseAmount: '20',
        doseRoute: codeableConcept({ text: 'Oral' }),
      }),
    ]
    const message = buildPiqiMessage(records, [])
    expect(message.model).toBe('PAT_CLINICAL_V1')
    expect(message.patient.medications[0]).toMatchObject({
      medication: { text: 'Lisinopril', codings: [] },
      doseAmount: '20',
      doseRoute: { text: 'Oral', codings: [] },
    })
  })

  it('collapses demographics to a single object, not an array (cardinality One)', () => {
    const records = [record('d1', 'demographics', { firstName: 'Jordan', lastName: 'Rivera' })]
    const message = buildPiqiMessage(records, [])
    expect(Array.isArray(message.patient.demographics)).toBe(false)
    expect(message.patient.demographics).toMatchObject({ firstName: 'Jordan', lastName: 'Rivera' })
  })

  it('includes every field the data class defines, not just the populated ones', () => {
    const records = [record('a1', 'allergies', { substance: codeableConcept({ text: 'Penicillin' }) })]
    const message = buildPiqiMessage(records, [])
    const allergy = message.patient.allergies[0]
    expect(allergy.substance).toEqual({ text: 'Penicillin', codings: [] })
    // category was never set on the source record, but the model defines it
    // for the Allergies class, so it must still appear -- as an explicit
    // empty CodeableConcept, never an omitted key.
    expect(allergy).toHaveProperty('category', { text: null, codings: [] })
    expect(allergy).toHaveProperty('effectiveDate', null)
  })

  it('serializes an Observation Value with its nested type as a wire CodeableConcept', () => {
    const records = [
      record('ha1', 'healthAssessments', {
        assessment: codeableConcept({ text: 'Depression screening' }),
        resultValue: observationValue({ text: 'true', type: codeableConcept({ text: 'ST' }) }),
      }),
    ]
    const message = buildPiqiMessage(records, [])
    expect(message.patient.healthAssessments[0].resultValue).toEqual({
      text: 'true',
      type: { text: 'ST', codings: [] },
      number: null,
      number2: null,
      codings: [],
    })
  })

  it('never includes coverage, since it is outside the PIQI Clinical Data Model', () => {
    const records = [record('c1', 'coverage', { plan_name: 'Plan' })]
    const message = buildPiqiMessage(records, [])
    expect(message.patient.coverage).toBeUndefined()
    expect(PIQI_MESSAGE_DOMAINS).not.toContain('coverage')
  })

  it('applies patient assertions before serializing', () => {
    const records = [
      record('m1', 'medications', { medication: codeableConcept({ text: 'Atorvastatin' }) }),
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
    ]
    const message = buildPiqiMessage(records, assertions)
    expect(message.patient.medications[0].doseRoute).toEqual({ text: 'Oral', codings: [] })
  })

  it('only includes the requested domains', () => {
    const records = [
      record('m1', 'medications', { medication: codeableConcept({ text: 'Lisinopril' }) }),
      record('a1', 'allergies', { substance: codeableConcept({ text: 'Penicillin' }) }),
    ]
    const message = buildPiqiMessage(records, [], { domains: ['medications'] })
    expect(message.patient.medications).toBeDefined()
    expect(message.patient.allergies).toBeUndefined()
  })
})
