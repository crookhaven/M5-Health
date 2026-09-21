import { describe, it, expect } from 'vitest'
import {
  codeableConcept,
  observationValue,
  rangeValue,
  displayText,
  isPopulated,
  toWireValue,
} from './attributeTypes'

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

describe('toWireValue', () => {
  it('never emits a literal null for an Observation Value\'s type -- the real', () => {
    // PIQI reference engine's ScoreMessage endpoint throws "Sequence
    // contains no elements" on `resultValue.type: null` (confirmed against
    // the live Connectathon USCDI v3.1 channel); an empty CodeableConcept
    // shape is required instead, even when `type` was never set.
    const wire = toWireValue(observationValue({ number: 7.2 }))
    expect(wire.type).toEqual({ text: null, codings: [] })
    expect(wire.type).not.toBeNull()
  })

  it('serializes a populated Observation Value type as a wire CodeableConcept', () => {
    const wire = toWireValue(observationValue({ text: 'ST', type: codeableConcept({ text: 'ST' }) }))
    expect(wire.type).toEqual({ text: 'ST', codings: [] })
  })

  it('serializes null/empty codings and text for an unset CodeableConcept', () => {
    expect(toWireValue(codeableConcept({}))).toEqual({ text: null, codings: [] })
  })

  it('serializes a Simple Attribute value as-is, and an unset one as null', () => {
    expect(toWireValue('Oral')).toBe('Oral')
    expect(toWireValue(undefined)).toBeNull()
  })
})
