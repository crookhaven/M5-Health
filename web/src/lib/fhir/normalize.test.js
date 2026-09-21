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

  describe('IPS-style medications', () => {
    const bundle = {
      resourceType: 'Bundle',
      type: 'document',
      entry: [
        {
          fullUrl: 'urn:uuid:med-1',
          resource: { resourceType: 'Medication', id: 'm1', code: { text: 'Lisinopril 10 MG' } },
        },
        {
          fullUrl: 'urn:uuid:ms-1',
          resource: {
            resourceType: 'MedicationStatement',
            id: 'ms1',
            status: 'active',
            medicationReference: { reference: 'urn:uuid:med-1' },
            effectivePeriod: { start: '2020-01-05', end: '2021-01-05' },
            dosage: [
              {
                text: 'Once daily',
                route: { text: 'Oral' },
                doseAndRate: [{ doseQuantity: { value: 10, code: 'mg' } }],
              },
            ],
          },
        },
        {
          fullUrl: 'urn:uuid:ms-2',
          resource: {
            resourceType: 'MedicationStatement',
            id: 'ms2',
            status: 'active',
            medicationReference: { reference: 'Medication/absent', display: 'Aspirin' },
            dateAsserted: '2022-02-02',
          },
        },
      ],
    }

    it('resolves medicationReference to the Medication resource, with display fallback', () => {
      const meds = normalizeFhirBundle(bundle).filter((r) => r.domain === 'medications')
      expect(displayText(meds[0].data.medication)).toBe('Lisinopril 10 MG')
      expect(displayText(meds[1].data.medication)).toBe('Aspirin')
    })

    it('reads MedicationStatement.dosage, dose unit code and dates', () => {
      const [med] = normalizeFhirBundle(bundle).filter((r) => r.domain === 'medications')
      expect(med.data.doseAmount).toBeDefined()
      expect(displayText(med.data.doseAmountUnit)).toBe('mg')
      expect(displayText(med.data.doseRoute)).toBe('Oral')
      expect(med.data.startDate).toBe('2020-01-05')
      expect(med.data.endDate).toBe('2021-01-05')
    })

    it('uses dateAsserted as a start date fallback', () => {
      const meds = normalizeFhirBundle(bundle).filter((r) => r.domain === 'medications')
      expect(meds[1].data.startDate).toBe('2022-02-02')
    })
  })

  it('falls back to any non-email telecom for patient phone', () => {
    const [p] = normalizeFhirBundle({
      resourceType: 'Patient',
      name: [{ family: 'Doe', given: ['Jo'] }],
      telecom: [{ system: 'email', value: 'a@b.c' }, { system: 'other', value: '555-1212' }],
    })
    expect(p.data.telecom).toBeDefined()
  })

  describe('CMS Blue Button ExplanationOfBenefit', () => {
    const icd = (code) => ({ coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code }] })
    const eob = (id, start, extra) => ({
      resource: {
        resourceType: 'ExplanationOfBenefit',
        id,
        billablePeriod: { start, end: start },
        insurance: [{ focal: true, coverage: { display: 'Part A' } }],
        ...extra,
      },
    })
    const bundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      entry: [
        eob('late', '2024-05-01', {
          diagnosis: [{ sequence: 1, diagnosisCodeableConcept: icd('E11.9') }],
          item: [{ productOrService: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99213' }] } }],
        }),
        eob('early', '2021-02-03', {
          diagnosis: [
            { sequence: 1, diagnosisCodeableConcept: icd('E11.9') },
            { sequence: 2, diagnosisCodeableConcept: icd('I10') },
          ],
          procedure: [
            {
              date: '2021-02-04',
              procedureCodeableConcept: { coding: [{ system: 'http://www.cms.gov/Medicare/Coding/ICD10', code: '5A1D70Z' }] },
            },
          ],
        }),
        eob('rx', '2024-08-21', {
          item: [
            {
              servicedDate: '2024-08-21',
              quantity: { value: 6, unit: 'ML' },
              productOrService: { coding: [{ system: 'http://hl7.org/fhir/sid/ndc', code: '00264180032' }] },
            },
          ],
        }),
      ],
    }
    const byDomain = (d) => normalizeFhirBundle(bundle).filter((r) => r.domain === d)

    it('keeps each distinct diagnosis once, dated by the earliest claim', () => {
      const conditions = byDomain('conditions')
      expect(conditions).toHaveLength(2)
      const e11 = conditions.find((c) => displayText(c.data.condition) === 'E11.9')
      expect(e11.data.recordedDate).toBe('2021-02-03')
    })

    it('does not invent clinical status for claim diagnoses', () => {
      const [c] = byDomain('conditions')
      expect(c.data.clinicalStatus).toBe(undefined)
      expect(c.data.onsetDate).toBe(undefined)
    })

    it('maps claim procedures and CPT line items to procedures', () => {
      const codes = byDomain('procedures').map((p) => displayText(p.data.procedure))
      expect(codes.includes('5A1D70Z')).toBe(true)
      expect(codes.includes('99213')).toBe(true)
    })

    it('maps an NDC pharmacy fill to a medication without treating quantity as dose', () => {
      const [med] = byDomain('medications')
      expect(displayText(med.data.medication)).toBe('00264180032')
      expect(med.data.startDate).toBe('2024-08-21')
      expect(med.data.doseAmount).toBe(undefined)
    })

    it('adds one coverage record per distinct plan', () => {
      expect(byDomain('coverage')).toHaveLength(1)
    })
  })

  describe('sample bundle terminology', () => {
    const results = normalizeFhirBundle(sampleBundle)
    const systems = (concept) => (concept?.codings ?? []).map((c) => c.system)

    it('carries standard codes, not just text, for the main coded fields', () => {
      const med = results.find((r) => r.domain === 'medications')
      expect(systems(med.data.medication)).toEqual(['http://www.nlm.nih.gov/research/umls/rxnorm'])
      const allergy = results.find((r) => r.domain === 'allergies')
      expect(systems(allergy.data.substance)).toEqual(['http://snomed.info/sct'])
      const condition = results.find((r) => r.domain === 'conditions')
      expect(systems(condition.data.condition)).toEqual(['http://snomed.info/sct'])
      const vaccine = results.find((r) => r.domain === 'immunizations')
      expect(systems(vaccine.data.immunization)).toEqual(['http://hl7.org/fhir/sid/cvx'])
    })

    it('codes dose and result units in UCUM when the source gives a unit code', () => {
      const med = results.find((r) => r.domain === 'medications')
      expect(systems(med.data.doseAmountUnit)).toEqual(['http://unitsofmeasure.org'])
      expect(displayText(med.data.doseAmountUnit)).toBe('mg')
    })
  })
})
