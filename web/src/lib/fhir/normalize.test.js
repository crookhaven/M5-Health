import { describe, it, expect } from 'vitest'
import { normalizeFhirBundle } from './normalize'
import { displayText } from '../piqi/attributeTypes'
import sampleBundle from '../../data/sample_fhir_bundle.json'

describe('normalizeFhirBundle', () => {
  it('maps a Patient resource to demographics', () => {
    const bundle = {
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            name: [{ given: ['Jordan'], family: 'Rivera' }],
            birthDate: '1985-04-12',
            gender: 'female',
          },
        },
      ],
    }
    const [result] = normalizeFhirBundle(bundle)
    expect(result.domain).toBe('demographics')
    expect(result.data.firstName).toBe('Jordan')
    expect(result.data.lastName).toBe('Rivera')
    expect(result.data.birthDate).toBe('1985-04-12')
    expect(displayText(result.data.birthSex)).toBe('female')
  })

  it('parses US Core race, ethnicity, and birth sex extensions', () => {
    const bundle = {
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            name: [{ given: ['Jessica'], family: 'Martin' }],
            gender: 'female',
            extension: [
              {
                url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race',
                extension: [
                  {
                    url: 'ombCategory',
                    valueCoding: { system: 'urn:oid:2.16.840.1.113883.6.238', code: '2106-3', display: 'White' },
                  },
                  { url: 'text', valueString: 'White' },
                ],
              },
              {
                url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity',
                extension: [
                  {
                    url: 'ombCategory',
                    valueCoding: {
                      system: 'urn:oid:2.16.840.1.113883.6.238',
                      code: '2186-5',
                      display: 'Not Hispanic or Latino',
                    },
                  },
                  { url: 'text', valueString: 'Not Hispanic or Latino' },
                ],
              },
              {
                url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex',
                valueCode: 'F',
              },
            ],
          },
        },
      ],
    }
    const [result] = normalizeFhirBundle(bundle)
    expect(displayText(result.data.race)).toBe('White')
    expect(displayText(result.data.ethnicity)).toBe('Not Hispanic or Latino')
    expect(displayText(result.data.birthSex)).toBe('Female')
  })

  it('maps a MedicationRequest to medications with typed attributes', () => {
    const bundle = {
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'MedicationRequest',
            status: 'active',
            medicationCodeableConcept: { text: 'Lisinopril' },
            dosageInstruction: [
              {
                doseAndRate: [{ doseQuantity: { value: 20, unit: 'mg' } }],
                route: { text: 'Oral' },
              },
            ],
          },
        },
      ],
    }
    const [result] = normalizeFhirBundle(bundle)
    expect(result.domain).toBe('medications')
    expect(displayText(result.data.medication)).toBe('Lisinopril')
    expect(result.data.doseAmount).toBe('20')
    expect(displayText(result.data.doseAmountUnit)).toBe('mg')
    expect(displayText(result.data.doseRoute)).toBe('Oral')
    expect(displayText(result.data.requestStatus)).toBe('active')
  })

  it('maps AllergyIntolerance to allergies', () => {
    const bundle = {
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'AllergyIntolerance',
            code: { text: 'Penicillin' },
            reaction: [{ manifestation: [{ text: 'Rash' }], severity: 'mild' }],
          },
        },
      ],
    }
    const [result] = normalizeFhirBundle(bundle)
    expect(result.domain).toBe('allergies')
    expect(displayText(result.data.substance)).toBe('Penicillin')
    expect(displayText(result.data.reaction)).toBe('Rash')
    expect(displayText(result.data.severity)).toBe('mild')
  })

  it('classifies Observations into labResults, vitalSigns, or healthAssessments by category', () => {
    const lab = normalizeFhirBundle({
      resourceType: 'Observation',
      category: [{ coding: [{ code: 'laboratory' }] }],
      code: { text: 'Hemoglobin A1c' },
      valueQuantity: { value: 7.2, unit: '%' },
    })
    expect(lab[0].domain).toBe('labResults')

    const vital = normalizeFhirBundle({
      resourceType: 'Observation',
      category: [{ coding: [{ code: 'vital-signs' }] }],
      code: { text: 'Blood Pressure' },
      valueQuantity: { value: 120 },
    })
    expect(vital[0].domain).toBe('vitalSigns')

    const social = normalizeFhirBundle({
      resourceType: 'Observation',
      category: [{ coding: [{ code: 'social-history' }] }],
      code: { text: 'Tobacco smoking status' },
      valueCodeableConcept: { text: 'Former smoker' },
    })
    expect(social[0].domain).toBe('healthAssessments')
  })

  it('skips Observations with no recognized category', () => {
    const bundle = {
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'Observation',
            category: [{ coding: [{ code: 'imaging' }] }],
            code: { text: 'Chest X-ray' },
          },
        },
      ],
    }
    expect(normalizeFhirBundle(bundle)).toEqual([])
  })

  it('ignores resource types it does not know how to normalize', () => {
    const bundle = {
      resourceType: 'Bundle',
      entry: [{ resource: { resourceType: 'Encounter', status: 'finished' } }],
    }
    expect(normalizeFhirBundle(bundle)).toEqual([])
  })

  it('accepts a single resource without a Bundle wrapper', () => {
    const resource = {
      resourceType: 'Immunization',
      vaccineCode: { text: 'Influenza vaccine' },
      occurrenceDateTime: '2026-08-20',
    }
    const [result] = normalizeFhirBundle(resource)
    expect(result.domain).toBe('immunizations')
    expect(displayText(result.data.immunization)).toBe('Influenza vaccine')
    expect(result.data.administrationDate).toBe('2026-08-20')
  })

  it('maps a Device resource to medicalDevices', () => {
    const resource = {
      resourceType: 'Device',
      status: 'active',
      type: { text: 'Insulin pump' },
      udiCarrier: [{ deviceIdentifier: '00844588003288' }],
    }
    const [result] = normalizeFhirBundle(resource)
    expect(result.domain).toBe('medicalDevices')
    expect(displayText(result.data.deviceType)).toBe('Insulin pump')
    expect(result.data.deviceID).toBe('00844588003288')
  })

  it('maps a Procedure resource to procedures', () => {
    const resource = {
      resourceType: 'Procedure',
      status: 'completed',
      code: { text: 'Appendectomy' },
      performedDateTime: '2019-03-02',
    }
    const [result] = normalizeFhirBundle(resource)
    expect(result.domain).toBe('procedures')
    expect(displayText(result.data.procedure)).toBe('Appendectomy')
    expect(result.data.procedureDateTime).toBe('2019-03-02')
  })

  it('normalizes the full sample bundle into the expected domain counts', () => {
    const results = normalizeFhirBundle(sampleBundle)
    const counts = results.reduce((acc, r) => {
      acc[r.domain] = (acc[r.domain] ?? 0) + 1
      return acc
    }, {})
    expect(counts).toEqual({
      demographics: 1,
      medications: 3,
      allergies: 2,
      conditions: 2,
      labResults: 2,
      immunizations: 2,
      procedures: 2,
      medicalDevices: 1,
      healthAssessments: 1,
      coverage: 1,
    })
  })
})
