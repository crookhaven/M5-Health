import { describe, expect, it } from 'vitest'
import { normalizeFhirBundle } from './fhir/normalize'
import { createSourceRecord } from './sourceRecord'
import { buildPiqiMessage } from './piqi/message'
import { linkChecksToRecords, parseGatewayResult } from './piqi/gatewayResult'
import { displayOnlyFields } from './displayOnly'

const bundle = (...resources) => ({ resourceType: 'Bundle', entry: resources.map((resource) => ({ resource })) })
const only = (b, domain) => normalizeFhirBundle(b).filter((r) => r.domain === domain)
const toRecords = (b) =>
  normalizeFhirBundle(b).map(({ domain, data }) => createSourceRecord({ sourceType: 'test', documentName: 'b.json', domain, data }))

describe('reading more of what real sources send', () => {
  it('reads a drug from a contained Medication', () => {
    const [med] = only(
      bundle({
        resourceType: 'MedicationRequest',
        contained: [{ resourceType: 'Medication', id: 'm1', code: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '197361' }], text: 'Amlodipine 5 MG' } }],
        medicationReference: { reference: '#m1' },
      }),
      'medications',
    )
    expect(med.data.medication.text).toBe('Amlodipine 5 MG')
    expect(med.data.medication.codings[0].code).toBe('197361')
  })

  it('reads integer and boolean values and a period date', () => {
    const [score] = only(
      bundle({
        resourceType: 'Observation',
        category: [{ coding: [{ code: 'survey' }] }],
        code: { text: 'PHQ-2 total score' },
        valueInteger: 0,
        effectivePeriod: { start: '2026-04-08' },
      }),
      'healthAssessments',
    )
    expect(score.data.resultValue.number).toBe(0)
    expect(score.data.effectiveDate).toBe('2026-04-08')
    const [flag] = only(
      bundle({ resourceType: 'Observation', category: [{ coding: [{ code: 'social-history' }] }], code: { text: 'Smoker' }, valueBoolean: false }),
      'healthAssessments',
    )
    expect(flag.data.resultValue.text).toBe('No')
  })

  it('reads immunization, procedure and condition dates in their other forms', () => {
    expect(only(bundle({ resourceType: 'Immunization', vaccineCode: { text: 'Flu' }, occurrenceString: 'Fall 2019' }), 'immunizations')[0].data.administrationDate).toBe('Fall 2019')
    expect(only(bundle({ resourceType: 'Procedure', code: { text: 'Colonoscopy' }, performedPeriod: { end: '2024-01-02' } }), 'procedures')[0].data.procedureDateTime).toBe('2024-01-02')
    expect(only(bundle({ resourceType: 'Condition', code: { text: 'Asthma' }, onsetPeriod: { start: '2001-05-01' } }), 'conditions')[0].data.onsetDate).toBe('2001-05-01')
  })

  it('takes the first patient identifier that has a value', () => {
    const [p] = only(bundle({ resourceType: 'Patient', identifier: [{ system: 'x' }, { value: 'MRN-1' }] }), 'demographics')
    expect(p.data.patientIdentifier).toBe('MRN-1')
  })

  it('dates and names an encounter written the R5 way', () => {
    const [e] = only(
      bundle({ resourceType: 'Encounter', status: 'unknown', class: [{ coding: [{ code: 'AMB', display: 'ambulatory' }] }], actualPeriod: { start: '2026-04-08T09:45:00Z' } }),
      'encounters',
    )
    expect(e.data.date).toBe('2026-04-08T09:45:00Z')
    expect(e.data.title).toBe('ambulatory')
  })

  it('explains an unknown status instead of showing "unknown"', () => {
    expect(displayOnlyFields('encounters', { status: 'unknown' })).toEqual([['Status', 'not recorded by the source']])
  })
})

describe('PIQI message clean-up', () => {
  it('fills demographics from every Patient record, not just the first', () => {
    const msg = buildPiqiMessage(
      toRecords(bundle({ resourceType: 'Patient', name: [{ family: 'Doe', given: ['Ann'] }] }, { resourceType: 'Patient', identifier: [{ value: 'MRN-2' }], telecom: [{ system: 'phone', value: '555-0100' }] })),
      [],
    )
    expect(msg.patient.demographics.lastName).toBe('Doe')
    expect(msg.patient.demographics.patientIdentifier).toBe('MRN-2')
    expect(msg.patient.demographics.telecom).toBe('555-0100')
  })

  const allergy = { resourceType: 'AllergyIntolerance', code: { text: 'Penicillin' } }
  const other = { resourceType: 'AllergyIntolerance', code: { text: 'Latex' } }
  const records = toRecords(bundle(allergy, allergy, allergy, other))

  it('can leave out exact copies', () => {
    expect(buildPiqiMessage(records, []).patient.allergies).toHaveLength(4)
    expect(buildPiqiMessage(records, [], { uniqueOnly: true }).patient.allergies).toHaveLength(2)
  })

  it('links a result from a distinct-only message to the right records', () => {
    const element = (name) => ({
      attributes: [
        {
          attributeName: 'substance',
          data: { text: name, codings: [] },
          attributeAudit: { assessmentItems: [{ attributeMnemonic: 'ALG_SUB', assessment: 'coded', status: 'Failed', reason: 'x', effect: 'Scoring' }] },
        },
      ],
    })
    const parsed = parseGatewayResult({
      scoringData: { messageResults: {} },
      auditedMessage: { root: { classes: [{ className: 'allergies', elements: [element('Penicillin'), element('Latex')] }] } },
    })
    const linked = linkChecksToRecords(parsed, records, [])
    expect(linked.checks[1].recordId).toBe(records[3].id)
  })
})
