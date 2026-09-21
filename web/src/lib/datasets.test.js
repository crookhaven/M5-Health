import { describe, it, expect } from 'vitest'
import { buildDatasetMessage, datasetHasData, IPS_DOMAINS } from './datasets'
import { extractClaims } from './claims/extract'

const record = (id, domain, data) => ({ id, domain, data, source: {} })
const records = [
  record('d1', 'demographics', { lastName: 'Doe', firstName: 'Jo' }),
  record('m1', 'medications', { medication: 'Aspirin' }),
  record('l1', 'labResults', { test: 'A1c' }),
]

describe('datasets', () => {
  it('builds an IPS message with only the IPS classes', () => {
    const msg = buildDatasetMessage('ips', { sourceRecords: records, assertions: [], claimsData: null })
    expect(Object.keys(msg.patient).every((k) => IPS_DOMAINS.includes(k))).toBe(true)
    expect(msg.patient.medications).toHaveLength(1)
    expect(msg.patient.labResults).toBe(undefined)
  })

  it('builds the clinical message from all clinical classes', () => {
    const msg = buildDatasetMessage('clinical', { sourceRecords: records, assertions: [], claimsData: null })
    expect(msg.model).toBe('PAT_CLINICAL_V1')
    expect(msg.patient.labResults).toHaveLength(1)
  })

  it('builds the claims message from the claims data', () => {
    const claimsData = extractClaims({
      resourceType: 'ExplanationOfBenefit',
      id: 'c1',
      patient: { reference: 'Patient/1' },
      billablePeriod: { start: '2024-01-01' },
    })
    const msg = buildDatasetMessage('claims', { sourceRecords: [], assertions: [], claimsData })
    expect(msg.model).toBe('PAT_EOB_V1')
    expect(msg.patient.medicalClaim).toHaveLength(1)
  })

  it('reports whether each data set has anything to score', () => {
    expect(datasetHasData('ips', { sourceRecords: [record('l1', 'labResults', {})], claimsData: null })).toBe(false)
    expect(datasetHasData('ips', { sourceRecords: records, claimsData: null })).toBe(true)
    expect(datasetHasData('claims', { sourceRecords: records, claimsData: null })).toBe(false)
    expect(datasetHasData('clinical', { sourceRecords: records, claimsData: null })).toBe(true)
  })
})
