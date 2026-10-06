import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'
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

  it('skips Observations outside the known categories that carry no value', () => {
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
      entry: [{ resource: { resourceType: 'Location', name: 'Clinic' } }],
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

describe('normalizeFhirBundle - imaging, clinical notes and referrals', () => {
  const b64 = (text) => Buffer.from(text).toString('base64')
  const base = 'https://example.org/fhir'
  const entry = (resource) => ({ fullUrl: `${base}/${resource.resourceType}/${resource.id}`, resource })
  const bundle = {
    resourceType: 'Bundle',
    entry: [
      entry({ resourceType: 'Practitioner', id: 'rad', name: [{ given: ['Thomas'], family: 'Nguyen', suffix: ['MD'] }] }),
      entry({ resourceType: 'Condition', id: 'ckd', code: { text: 'Diabetic CKD' } }),
      entry({
        resourceType: 'ImagingStudy',
        id: 'us',
        status: 'available',
        started: '2018-08-28T10:15:00-05:00',
        description: 'US KIDNEYS BILATERAL',
        modality: [{ code: 'US', display: 'Ultrasound' }],
        numberOfSeries: 2,
        numberOfInstances: 7,
        series: [{ bodySite: { display: 'Right kidney structure' } }, { bodySite: { display: 'Left kidney structure' } }],
      }),
      entry({ resourceType: 'Binary', id: 'b1', contentType: 'text/plain', data: b64('FINDINGS: normal.') }),
      entry({
        resourceType: 'DiagnosticReport',
        id: 'r1',
        status: 'final',
        category: [{ coding: [{ system: 'http://loinc.org', code: 'LP29684-5' }] }],
        code: { text: 'US Kidneys' },
        imagingStudy: [{ reference: 'ImagingStudy/us' }],
        resultsInterpreter: [{ reference: 'Practitioner/rad' }],
        conclusion: 'No hydronephrosis.',
        presentedForm: [{ contentType: 'text/plain', url: `${base}/Binary/b1`, title: 'US report' }],
      }),
      // A DocumentReference copy of the same report.
      entry({
        resourceType: 'DocumentReference',
        id: 'twin',
        status: 'current',
        content: [{ attachment: { contentType: 'text/plain', url: `${base}/Binary/b1` } }],
        context: { related: [{ reference: 'DiagnosticReport/r1' }] },
      }),
      entry({
        resourceType: 'DocumentReference',
        id: 'n1',
        status: 'current',
        docStatus: 'final',
        type: { text: 'Consult note' },
        date: '2018-08-20T16:12:00-05:00',
        author: [{ reference: 'Practitioner/rad' }],
        content: [{ attachment: { contentType: 'text/html', data: b64('<p>Plan:&nbsp;renal US</p><p>Follow up</p>'), title: 'Nephrology Consultation' } }],
      }),
      entry({
        resourceType: 'DocumentReference',
        id: 'pdf',
        status: 'current',
        type: { text: 'Summary of episode note' },
        content: [{ attachment: { contentType: 'application/pdf', data: b64('%PDF-1.4') } }],
      }),
      entry({
        resourceType: 'DiagnosticReport',
        id: 'lab',
        category: [{ coding: [{ code: 'LAB' }] }],
        code: { text: 'Comprehensive metabolic panel' },
        result: [{ reference: 'Observation/x' }],
      }),
      // A results-only panel with no category or narrative, as converted C-CDA often has.
      entry({ resourceType: 'DiagnosticReport', id: 'panel', code: { text: 'CBC panel' }, result: [{ reference: 'Observation/y' }] }),
      entry({
        resourceType: 'ServiceRequest',
        id: 's1',
        status: 'completed',
        intent: 'order',
        category: [{ text: 'Patient referral' }],
        code: { text: 'Referral to nephrology' },
        authoredOn: '2018-07-14',
        requester: { display: 'Angela Morris, MD' },
        performer: [{ reference: 'Practitioner/rad' }],
        reasonReference: [{ reference: 'Condition/ckd' }],
        note: [{ text: 'Please co-manage.' }],
      }),
    ],
  }
  const results = normalizeFhirBundle(bundle)
  const dataFor = (domain) => results.filter((r) => r.domain === domain).map((r) => r.data)

  it('shows an imaging study with its report attached', () => {
    const imaging = dataFor('imaging')
    expect(imaging).toHaveLength(1)
    expect(imaging[0]).toMatchObject({
      title: 'US KIDNEYS BILATERAL',
      modality: 'Ultrasound',
      bodySite: 'Right kidney structure, Left kidney structure',
      series: '2',
      images: '7',
      interpreter: 'Thomas Nguyen, MD',
      conclusion: 'No hydronephrosis.',
      reportText: 'FINDINGS: normal.',
    })
  })

  it('turns DocumentReferences into notes, decoding text and skipping report copies', () => {
    const notes = dataFor('clinicalNotes')
    expect(notes.map((n) => n.title)).toEqual(['Nephrology Consultation', 'Summary of episode note'])
    expect(notes[0]).toMatchObject({ noteType: 'Consult note', author: 'Thomas Nguyen, MD', text: 'Plan: renal US\nFollow up' })
  })

  it('lists non-text documents without storing their content', () => {
    const pdf = dataFor('clinicalNotes')[1]
    expect(pdf.text).toBeUndefined()
    expect(pdf.omitted).toMatch(/application\/pdf/)
  })

  it('skips lab panels and results-only reports, whose results are already lab results', () => {
    const titles = results.map((r) => r.data.title)
    expect(titles).not.toContain('Comprehensive metabolic panel')
    expect(titles).not.toContain('CBC panel')
  })

  it('decompresses a gzipped C-CDA labeled text/plain and shows its narrative', () => {
    const cda =
      '<?xml version="1.0"?><ClinicalDocument><component><structuredBody><component><section>' +
      '<title>Allergies</title><text><table><tr><td>Penicillin</td> <td>Nausea</td></tr></table></text>' +
      '</section></component><component><section><title>Assessment</title>' +
      '<text>\n    <paragraph>Uncontrolled\n     diabetes.</paragraph>\n  </text></section></component>' +
      '</structuredBody></component></ClinicalDocument>'
    const [note] = normalizeFhirBundle({
      resourceType: 'Bundle',
      entry: [
        entry({
          resourceType: 'DocumentReference',
          id: 'gz',
          status: 'current',
          type: { text: 'Consultation Note' },
          content: [{ attachment: { contentType: 'text/plain', data: gzipSync(Buffer.from(cda)).toString('base64') } }],
        }),
      ],
    })
    expect(note.data.format).toMatch(/C-CDA/)
    expect(note.data.text).toBe('ALLERGIES\nPenicillin\tNausea\n\nASSESSMENT\nUncontrolled diabetes.')
  })

  it('keeps uncategorized Observations: measurements as labs, scores and findings as assessments', () => {
    const obs = (id, extra) => entry({ resourceType: 'Observation', id, status: 'final', code: { text: id }, ...extra })
    const mapped = normalizeFhirBundle({
      resourceType: 'Bundle',
      entry: [
        obs('eGFR', { valueQuantity: { value: 72, unit: 'mL/min', code: 'mL/min' } }),
        obs('GAD-7 total', { valueQuantity: { value: 3, unit: '{score}', code: '{score}' } }),
        obs('Nutrition status', { valueCodeableConcept: { text: 'well nourished' } }),
        obs('Exam finding', { category: [{ coding: [{ code: 'exam' }] }], valueString: 'normal gait' }),
      ],
    })
    expect(mapped.map((r) => [displayText(r.data.test ?? r.data.assessment), r.domain])).toEqual([
      ['eGFR', 'labResults'],
      ['GAD-7 total', 'healthAssessments'],
      ['Nutrition status', 'healthAssessments'],
      ['Exam finding', 'healthAssessments'],
    ])
  })

  it('captures details outside the PIQI model on devices, procedures and observations', () => {
    const mapped = normalizeFhirBundle({
      resourceType: 'Bundle',
      entry: [
        entry({ resourceType: 'Organization', id: 'org', name: 'Atlas Clinic' }),
        entry({ resourceType: 'Device', id: 'd1', type: { text: 'Insulin pump' }, manufacturer: 'Acme', version: [{ value: '2.1' }], owner: { reference: 'Organization/org' } }),
        entry({
          resourceType: 'Procedure',
          id: 'p1',
          status: 'completed',
          code: { text: 'Knee arthroscopy' },
          performedPeriod: { start: '2020-01-02T08:00:00Z', end: '2020-01-02T10:00:00Z' },
          bodySite: [{ text: 'Left knee' }],
          performer: [{ actor: { reference: 'Practitioner/rad' } }],
        }),
        entry({ resourceType: 'Practitioner', id: 'rad', name: [{ given: ['Thomas'], family: 'Nguyen' }] }),
        entry({
          resourceType: 'Observation',
          id: 'bp',
          status: 'final',
          category: [{ coding: [{ code: 'vital-signs' }] }],
          code: { text: 'Heart rate' },
          valueQuantity: { value: 70, unit: '/min' },
          bodySite: { text: 'Left arm' },
          performer: [{ reference: 'Organization/org' }],
        }),
      ],
    })
    const byDomain = (d) => mapped.find((r) => r.domain === d).data
    expect(byDomain('medicalDevices')).toMatchObject({ manufacturer: 'Acme', version: '2.1', owner: 'Atlas Clinic' })
    expect(byDomain('procedures')).toMatchObject({ endDateTime: '2020-01-02T10:00:00Z', bodySite: 'Left knee', performer: 'Thomas Nguyen' })
    expect(byDomain('vitalSigns')).toMatchObject({ bodySite: 'Left arm', performer: 'Atlas Clinic' })
  })

  it('maps encounters, care teams, related people and compositions', () => {
    const mapped = normalizeFhirBundle({
      resourceType: 'Bundle',
      entry: [
        entry({ resourceType: 'Location', id: 'loc', name: 'Atlas Main Campus' }),
        entry({ resourceType: 'Condition', id: 'dm', code: { text: 'Type 2 diabetes' } }),
        entry({
          resourceType: 'Encounter',
          id: 'e1',
          status: 'finished',
          class: { code: 'AMB', display: 'ambulatory' },
          type: [{ text: 'Office visit' }],
          period: { start: '2026-07-12T09:00:00Z', end: '2026-07-12T09:30:00Z' },
          participant: [{ individual: { reference: 'Practitioner/rad' } }],
          location: [{ location: { reference: 'Location/loc' } }],
          diagnosis: [{ condition: { reference: 'Condition/dm' } }],
        }),
        entry({
          resourceType: 'CareTeam',
          id: 'ct',
          status: 'active',
          name: 'Diabetes care team',
          managingOrganization: [{ display: 'Atlas Clinic' }],
          participant: [{ member: { reference: 'Practitioner/rad' }, role: [{ text: 'Primary care' }] }],
        }),
        entry({
          resourceType: 'RelatedPerson',
          id: 'rp',
          name: [{ given: ['Maria'], family: 'Gonzalez' }],
          relationship: [{ text: 'Daughter' }],
          telecom: [{ system: 'phone', value: '555-0100' }],
          address: [{ line: ['1 Main St'], city: 'Springfield', state: 'IL' }],
        }),
        entry({
          resourceType: 'Composition',
          id: 'c1',
          status: 'final',
          title: 'Continuity of Care Document',
          type: { text: 'Summary of episode note' },
          date: '2026-09-29',
          section: [
            { title: 'Problems', text: { div: '<div xmlns="http://www.w3.org/1999/xhtml"><ul><li>Type 2 diabetes</li></ul></div>' } },
            { title: 'Empty section' },
          ],
        }),
        entry({ resourceType: 'Practitioner', id: 'rad', name: [{ given: ['Thomas'], family: 'Nguyen' }] }),
      ],
    })
    const one = (d) => mapped.filter((r) => r.domain === d).map((r) => r.data)
    expect(one('encounters')).toEqual([
      expect.objectContaining({
        title: 'Office visit',
        date: '2026-07-12T09:00:00Z',
        endDate: '2026-07-12T09:30:00Z',
        encounterClass: 'ambulatory',
        provider: 'Thomas Nguyen',
        location: 'Atlas Main Campus',
        diagnosis: 'Type 2 diabetes',
      }),
    ])
    expect(one('careTeam')).toEqual([
      expect.objectContaining({ title: 'Diabetes care team', organization: 'Atlas Clinic', members: 'Thomas Nguyen (Primary care)' }),
    ])
    expect(one('contacts')).toEqual([
      expect.objectContaining({ title: 'Maria Gonzalez', relationship: 'Daughter', phone: '555-0100', address: '1 Main St, Springfield, IL' }),
    ])
    expect(one('clinicalNotes')).toEqual([
      expect.objectContaining({ title: 'Continuity of Care Document', noteType: 'Summary of episode note', text: 'PROBLEMS\nType 2 diabetes' }),
    ])
  })

  it('maps a ServiceRequest to a referral with resolved names', () => {
    expect(dataFor('referrals')).toEqual([
      expect.objectContaining({
        title: 'Referral to nephrology',
        status: 'completed',
        requester: 'Angela Morris, MD',
        performer: 'Thomas Nguyen, MD',
        reason: 'Diabetic CKD',
        summary: 'Please co-manage.',
      }),
    ])
  })
})
