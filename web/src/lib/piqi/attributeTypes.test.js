import { describe, it, expect } from 'vitest'
import { codeableConcept, observationValue, rangeValue, displayText, isPopulated } from './attributeTypes'

// localStorage persistence round-trips every value through JSON.stringify/
// parse, which drops undefined-valued keys and any non-enumerable property
// -- including the $type tag these constructors attach. displayText must
// still work from the resulting plain object shape alone.
function roundTrip(value) {
  return JSON.parse(JSON.stringify(value))
}

describe('displayText', () => {
  it('returns a plain string as-is (Simple Attribute)', () => {
    expect(displayText('Oral')).toBe('Oral')
  })

  it('reads text or falls back to the first coding for a CodeableConcept', () => {
    expect(displayText(codeableConcept({ text: 'Oral' }))).toBe('Oral')
    expect(
      displayText(codeableConcept({ codings: [{ code: 'PO', display: 'Oral' }] })),
    ).toBe('Oral')
  })

  it('reads number, or number-number2, or text for an Observation Value', () => {
    expect(displayText(observationValue({ number: 7.2 }))).toBe('7.2')
    expect(displayText(observationValue({ number: 60, number2: 90 }))).toBe('60-90')
    expect(displayText(observationValue({ text: 'Former smoker' }))).toBe('Former smoker')
  })

  it('reads text or low-high for a Range Value', () => {
    expect(displayText(rangeValue({ text: '14-88' }))).toBe('14-88')
    expect(displayText(rangeValue({ lowValue: '4', highValue: '11' }))).toBe('4-11')
  })

  it('distinguishes a numeric Observation Value from a CodeableConcept even though both carry a codings array', () => {
    const obs = observationValue({ number: 7.2, codings: [] })
    expect(displayText(obs)).toBe('7.2')
  })

  it('survives a JSON round-trip (localStorage persistence) for every type', () => {
    expect(displayText(roundTrip(codeableConcept({ text: 'Oral' })))).toBe('Oral')
    expect(displayText(roundTrip(observationValue({ number: 7.2 })))).toBe('7.2')
    expect(displayText(roundTrip(observationValue({ number: 60, number2: 90 })))).toBe('60-90')
    expect(displayText(roundTrip(rangeValue({ text: '14-88' })))).toBe('14-88')
    expect(displayText(roundTrip(rangeValue({ lowValue: '4', highValue: '11' })))).toBe('4-11')
  })

  it('returns undefined for empty or missing values', () => {
    expect(displayText(undefined)).toBeUndefined()
    expect(displayText(null)).toBeUndefined()
    expect(displayText('')).toBeUndefined()
    expect(displayText(codeableConcept({}))).toBeUndefined()
  })
})

describe('isPopulated', () => {
  it('is false for an empty CodeableConcept and true once text is set', () => {
    expect(isPopulated(codeableConcept({}))).toBe(false)
    expect(isPopulated(codeableConcept({ text: 'Oral' }))).toBe(true)
  })

  it('is true for a numeric Observation Value even when text is absent', () => {
    expect(isPopulated(observationValue({ number: 0 }))).toBe(true)
  })
})
