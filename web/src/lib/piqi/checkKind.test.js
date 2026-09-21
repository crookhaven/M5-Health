import { describe, it, expect } from 'vitest'
import { checkKind, addedValueFor } from './checkKind'

const populated = { id: 'c1', recordId: 'r1', attribute: 'doseAmount', assessment: 'Medication Dose Amount is populated' }
const entry = (field, value, createdAt = '2026-02-01') => ({ kind: 'field', sourceRecordId: 'r1', field, value, createdAt })

describe('checkKind', () => {
  it('classifies checks by name', () => {
    expect(checkKind(populated)).toBe('populated')
    expect(checkKind({ assessment: 'Medication dose is a valid number' })).toBe('numeric')
    expect(checkKind({ assessment: 'Medication Dose Amount Unit is in UCUM' })).toBe('coded')
    expect(checkKind({ assessment: 'Condition Onset Date is valid past date' })).toBe('date')
    expect(checkKind({ assessment: 'Something else' })).toBe('other')
  })
})

describe('addedValueFor', () => {
  it('finds a value typed after the result was loaded', () => {
    expect(addedValueFor(populated, [entry('doseAmount', '10')], '2026-01-01').value).toBe('10')
  })

  it('ignores values entered before the result was loaded', () => {
    expect(addedValueFor(populated, [entry('doseAmount', '10', '2025-12-01')], '2026-01-01')).toBeNull()
  })

  it('ignores other fields, other records, and checks with no record', () => {
    expect(addedValueFor(populated, [entry('startDate', '10')], '2026-01-01')).toBeNull()
    expect(addedValueFor({ ...populated, recordId: 'r2' }, [entry('doseAmount', '10')], '2026-01-01')).toBeNull()
    expect(addedValueFor({ ...populated, recordId: null }, [entry('doseAmount', '10')], '2026-01-01')).toBeNull()
  })

  it('returns the latest value', () => {
    const list = [entry('doseAmount', '5', '2026-02-01'), entry('doseAmount', '7', '2026-03-01')]
    expect(addedValueFor(populated, list, '2026-01-01').value).toBe('7')
  })
})
