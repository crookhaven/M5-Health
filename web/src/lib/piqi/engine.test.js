import { describe, it, expect } from 'vitest'
import { runPiqiAnalysis } from './engine'

function record(id, domain, data, overrides = {}) {
  return {
    id,
    domain,
    source: {
      type: 'sample',
      documentName: 'test.json',
      importedAt: new Date().toISOString(),
      ...overrides.source,
    },
    data,
    raw: null,
  }
}

function findingIds(findings, dimension) {
  return findings.filter((f) => f.dimension === dimension).map((f) => f.id)
}

describe('runPiqiAnalysis - completeness', () => {
  it('flags a medication missing frequency, matching the spec example', () => {
    const records = [
      record('m1', 'medications', {
        name: 'Atorvastatin',
        dosage: '40 mg',
        route: 'Oral',
        status: 'active',
      }),
    ]
    const findings = runPiqiAnalysis(records, [], {})
    const finding = findings.find((f) => f.id === 'completeness:medications:frequency:m1')
    expect(finding).toBeDefined()
    expect(finding.field).toBe('frequency')
    expect(finding.title).toContain('Atorvastatin')
    expect(finding.suggestedActions).toEqual(['review', 'ignore_for_now', 'remind_later'])
  })

  it('does not flag a fully complete medication', () => {
    const records = [
      record('m1', 'medications', {
        name: 'Lisinopril',
        dosage: '20 mg',
        frequency: 'Once daily',
        route: 'Oral',
        status: 'active',
      }),
    ]
    const findings = runPiqiAnalysis(records, [], {})
    expect(findingIds(findings, 'completeness')).toEqual([])
  })

  it('resolves a completeness finding once a patient assertion fills the field', () => {
    const records = [
      record('m1', 'medications', {
        name: 'Atorvastatin',
        dosage: '40 mg',
        route: 'Oral',
        status: 'active',
      }),
    ]
    const assertions = [
      {
        id: 'a1',
        kind: 'field',
        sourceRecordId: 'm1',
        domain: 'medications',
        field: 'frequency',
        value: 'Once daily',
        createdAt: new Date().toISOString(),
      },
    ]
    const findings = runPiqiAnalysis(records, assertions, {})
    expect(findingIds(findings, 'completeness')).toEqual([])
  })

  it('flags a coverage record missing deductible and out-of-pocket amounts', () => {
    const records = [record('c1', 'coverage', { plan_name: 'Bare Plan' })]
    const findings = runPiqiAnalysis(records, [], {})
    expect(findings).toHaveLength(1)
    expect(findings[0].dimension).toBe('completeness')
    expect(findings[0].domain).toBe('coverage')
  })
})

describe('runPiqiAnalysis - duplication and consistency', () => {
  it('flags exact duplicates when every field matches', () => {
    const data = { substance: 'Penicillin', reaction: 'Rash', severity: 'mild' }
    const records = [record('a1', 'allergies', data), record('a2', 'allergies', { ...data })]
    const findings = runPiqiAnalysis(records, [], {})
    expect(findingIds(findings, 'duplication')).toEqual(['duplication:allergies:exact:a1,a2'])
    expect(findingIds(findings, 'consistency')).toEqual([])
  })

  it('flags a consistency conflict when identity matches but other fields disagree', () => {
    const records = [
      record('a1', 'allergies', { substance: 'Penicillin', reaction: 'Rash', severity: 'mild' }),
      record('a2', 'allergies', { substance: 'Penicillin', reaction: 'Hives', severity: 'moderate' }),
    ]
    const findings = runPiqiAnalysis(records, [], {})
    expect(findingIds(findings, 'consistency')).toEqual(['consistency:allergies:conflict:a1,a2'])
    expect(findingIds(findings, 'duplication')).toEqual([])
  })

  it('does not flag unrelated records with different identities', () => {
    const records = [
      record('a1', 'allergies', { substance: 'Penicillin', reaction: 'Rash', severity: 'mild' }),
      record('a2', 'allergies', { substance: 'Latex', reaction: 'Hives', severity: 'moderate' }),
    ]
    const findings = runPiqiAnalysis(records, [], {})
    expect(findingIds(findings, 'duplication')).toEqual([])
    expect(findingIds(findings, 'consistency')).toEqual([])
  })
})

describe('runPiqiAnalysis - timeliness', () => {
  it('flags a lab result older than two years as potentially stale', () => {
    const records = [
      record('l1', 'labs', { test: 'Hemoglobin A1c', value: 7.2, unit: '%', date: '2020-01-01' }),
    ]
    const findings = runPiqiAnalysis(records, [], {})
    expect(findingIds(findings, 'timeliness')).toEqual(['timeliness:labs:l1'])
  })

  it('does not flag a recent lab result', () => {
    const records = [
      record('l1', 'labs', {
        test: 'Fasting Glucose',
        value: 95,
        unit: 'mg/dL',
        date: new Date().toISOString().slice(0, 10),
      }),
    ]
    const findings = runPiqiAnalysis(records, [], {})
    expect(findingIds(findings, 'timeliness')).toEqual([])
  })
})

describe('runPiqiAnalysis - provenance', () => {
  it('flags a record with no source type', () => {
    const records = [
      record('m1', 'medications', {
        name: 'Lisinopril',
        dosage: '20 mg',
        frequency: 'Once daily',
        route: 'Oral',
        status: 'active',
      }),
    ]
    records[0].source.type = undefined
    const findings = runPiqiAnalysis(records, [], {})
    expect(findingIds(findings, 'provenance')).toEqual(['provenance:medications:m1'])
  })

  it('does not flag a record with a known source', () => {
    const records = [
      record('m1', 'medications', {
        name: 'Lisinopril',
        dosage: '20 mg',
        frequency: 'Once daily',
        route: 'Oral',
        status: 'active',
      }),
    ]
    const findings = runPiqiAnalysis(records, [], {})
    expect(findingIds(findings, 'provenance')).toEqual([])
  })
})

describe('runPiqiAnalysis - decisions', () => {
  it('attaches the recorded decision for a finding', () => {
    const records = [
      record('m1', 'medications', {
        name: 'Atorvastatin',
        dosage: '40 mg',
        route: 'Oral',
        status: 'active',
      }),
    ]
    const decisions = {
      'completeness:medications:frequency:m1': { status: 'ignore_for_now', decidedAt: '2026-01-01T00:00:00.000Z' },
    }
    const findings = runPiqiAnalysis(records, [], decisions)
    const finding = findings.find((f) => f.id === 'completeness:medications:frequency:m1')
    expect(finding.decision).toEqual(decisions[finding.id])
  })
})
