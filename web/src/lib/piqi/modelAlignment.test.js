import { describe, expect, it } from 'vitest'
import { normalizeFhirBundle } from '../fhir/normalize'
import { createSourceRecord } from '../sourceRecord'
import { buildPiqiMessage } from './message'
import { parseGatewayResult } from './gatewayResult'
import { observationValue, toWireValue } from './attributeTypes'

const bundle = (...resources) => ({ resourceType: 'Bundle', entry: resources.map((resource) => ({ resource })) })
const records = (b) =>
  normalizeFhirBundle(b).map(({ domain, data }) => createSourceRecord({ sourceType: 'test', documentName: 'b.json', domain, data }))

describe('PIQI message matches the PAT_CLINICAL_V1 model', () => {
  it('sends a lab test as performedTest and its order as orderedTest', () => {
    const msg = buildPiqiMessage(
      records(
        bundle({
          resourceType: 'Observation',
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
          code: { coding: [{ system: 'http://loinc.org', code: '718-7', display: 'Hemoglobin' }], text: 'Hemoglobin' },
          valueQuantity: { value: 13.5, unit: 'g/dL' },
        }),
      ),
      [],
    )
    const lab = msg.patient.labResults[0]
    expect(lab.performedTest.text).toBe('Hemoglobin')
    expect('orderedTest' in lab).toBe(true)
    expect('test' in lab).toBe(false)
  })

  it('sends a numeric result value as text too, so the Gateway sees it populated', () => {
    expect(toWireValue(observationValue({ number: 162 })).text).toBe('162')
    expect(toWireValue(observationValue({ number: 60, number2: 90 })).text).toBe('60-90')
    expect(toWireValue(observationValue({ text: 'Positive' })).text).toBe('Positive')
  })

  it('links a Gateway finding on performedTest back to the lab test field', () => {
    const result = parseGatewayResult({
      scoringData: { messageResults: { numerator: 0, denominator: 1, piqiScore: 0 } },
      auditedMessage: {
        root: {
          classes: [
            {
              className: 'labResults',
              elements: [
                {
                  attributes: [
                    {
                      attributeName: 'performedTest',
                      data: { text: 'Hemoglobin', codings: [] },
                      attributeAudit: {
                        assessmentItems: [{ attributeMnemonic: 'LAB_TEST', assessment: 'Lab Test code is in LOINC', status: 'Failed', reason: 'x', effect: 'Scoring' }],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    })
    expect(result.checks[0].attribute).toBe('test')
    expect(result.checks[0].elementLabel).toBe('Hemoglobin')
  })
})

describe('source-system devices', () => {
  const devices = (b) => normalizeFhirBundle(b).filter((r) => r.domain === 'medicalDevices')

  it('leaves out the EHR that sent the record', () => {
    expect(devices(bundle({ resourceType: 'Device', id: 'd1', type: { text: 'athenahealth' } }))).toHaveLength(0)
    expect(devices(bundle({ resourceType: 'Device', id: 'd2', type: { text: 'Epic - Version 11.4' } }))).toHaveLength(0)
  })

  it('leaves out a device named as an author', () => {
    const b = bundle(
      { resourceType: 'Device', id: 'sys', deviceName: [{ name: 'Clinic system', type: 'user-friendly-name' }] },
      { resourceType: 'Composition', author: [{ reference: 'Device/sys' }] },
    )
    expect(devices(b)).toHaveLength(0)
  })

  it('keeps a patient device, even one named by text only', () => {
    expect(devices(bundle({ resourceType: 'Device', id: 'p', type: { text: 'Insulin pump' } }))).toHaveLength(1)
    expect(devices(bundle({ resourceType: 'Device', id: 'q', type: { text: 'Epic pump' }, patient: { reference: 'Patient/1' } }))).toHaveLength(1)
  })
})
