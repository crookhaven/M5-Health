import { describe, it, expect } from 'vitest'
import { checkKind, recheckLocally, estimateScore } from './localRecheck'

const populated = { id: 'c1', recordId: 'r1', attribute: 'doseAmount', assessment: 'Medication Dose Amount is populated' }
const numeric = { id: 'c2', recordId: 'r1', attribute: 'doseAmount', assessment: 'Medication dose is a valid number' }
const coded = { id: 'c3', recordId: 'r1', attribute: 'doseAmountUnit', assessment: 'Medication Dose Amount Unit is in UCUM' }
const entry = (field, value, createdAt = '2026-02-01') => ({ kind: 'field', sourceRecordId: 'r1', field, value, createdAt })

describe('checkKind', () => {
  it('classifies checks by name', () => {
    expect(checkKind(populated)).toBe('populated')
    expect(checkKind(numeric)).toBe('numeric')
    expect(checkKind(coded)).toBe('coded')
    expect(checkKind({ assessment: 'Condition Onset Date is valid past date' })).toBe('date')
  })
})

describe('recheckLocally', () => {
  it('passes a populated check once the patient adds a value after the result was loaded', () => {
    expect(recheckLocally(populated, [entry('doseAmount', '10')], '2026-01-01')).toBe(true)
  })

  it('ignores values entered before the result was loaded', () => {
    expect(recheckLocally(populated, [entry('doseAmount', '10', '2025-12-01')], '2026-01-01')).toBeNull()
  })

  it('requires a plain number for a numeric check', () => {
    expect(recheckLocally(numeric, [entry('doseAmount', '10')], '2026-01-01')).toBe(true)
    expect(recheckLocally(numeric, [entry('doseAmount', '1 tablet')], '2026-01-01')).toBe(false)
  })

  it('never judges checks that need the real engine', () => {
    expect(recheckLocally(coded, [entry('doseAmountUnit', 'mg')], '2026-01-01')).toBeNull()
  })
})

describe('estimateScore', () => {
  it('adds locally-passing checks to the official numerator', () => {
    const parsed = { numerator: 3, denominator: 5, checks: [populated, coded] }
    const { estimate, flippedIds } = estimateScore(parsed, [entry('doseAmount', '10')], '2026-01-01')
    expect(estimate).toBe(80)
    expect([...flippedIds]).toEqual(['c1'])
  })

  it('gives no estimate when nothing changed', () => {
    expect(estimateScore({ numerator: 3, denominator: 5, checks: [populated] }, [], '2026-01-01').estimate).toBeNull()
  })
})
