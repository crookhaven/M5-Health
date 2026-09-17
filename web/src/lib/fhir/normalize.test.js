import { describe, it, expect } from 'vitest'
import { normalizeFhirBundle } from './normalize'
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
    expect(normalizeFhirBundle(bundle)).toEqual([
      {
        domain: 'demographics',
        data: { name: 'Jordan Rivera', dob: '1985-04-12', sex: 'female' },
      },
    ])
  })

  it('maps a MedicationRequest to medications with dosage/frequency/route', () => {
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
                timing: { code: { text: 'Once daily' } },
                route: { text: 'Oral' },
              },
            ],
          },
        },
      ],
    }
    expect(normalizeFhirBundle(bundle)).toEqual([
      {
        domain: 'medications',
        data: {
          name: 'Lisinopril',
          dosage: '20 mg',
          frequency: 'Once daily',
          route: 'Oral',
          status: 'active',
        },
      },
    ])
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
    expect(normalizeFhirBundle(bundle)).toEqual([
      { domain: 'allergies', data: { substance: 'Penicillin', reaction: 'Rash', severity: 'mild' } },
    ])
  })

  it('skips non-laboratory Observations', () => {
    const bundle = {
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'Observation',
            category: [{ coding: [{ code: 'vital-signs' }] }],
            code: { text: 'Heart rate' },
            valueQuantity: { value: 72, unit: 'bpm' },
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
    const resource = { resourceType: 'Immunization', vaccineCode: { text: 'Influenza vaccine' }, occurrenceDateTime: '2026-08-20' }
    expect(normalizeFhirBundle(resource)).toEqual([
      { domain: 'immunizations', data: { vaccine: 'Influenza vaccine', date: '2026-08-20' } },
    ])
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
      labs: 2,
      immunizations: 2,
      coverage: 1,
    })
  })
})
