// PIQI Attribute Types, per the HL7 PIQI Framework IG:
// https://build.fhir.org/ig/HL7/piqiimplementation/piqi_framework.html
//
// Simple Attribute: a plain string.
// Codeable Concept:  { text, codings: [{ code, display, system }] }
// Observation Value: { text, type: CodeableConcept, number, number2, codings: [] }
// Range Value:       { text, lowValue, highValue }
//
// Each constructor tags its result with a non-enumerable $type so displayText
///isPopulated can dispatch reliably -- CodeableConcept and Observation Value
// both carry a `codings` array, so shape-only duck-typing can't tell them
// apart. $type is stripped before these values would ever be serialized as a
// real PIQI message (see lib/shl/buildPackage.js).

function tagged(type, value) {
  Object.defineProperty(value, '$type', { value: type, enumerable: false })
  return value
}

export function codeableConcept({ text, codings } = {}) {
  return tagged('cc', { text: text ?? undefined, codings: codings ?? [] })
}

export function coding({ code, display, system }) {
  return { code, display, system }
}

export function observationValue({ text, type, number, number2, codings } = {}) {
  return tagged('obsval', {
    text: text ?? undefined,
    type: type ?? undefined,
    number: number ?? undefined,
    number2: number2 ?? undefined,
    codings: codings ?? [],
  })
}

export function rangeValue({ text, lowValue, highValue } = {}) {
  return tagged('rangeval', {
    text: text ?? undefined,
    lowValue: lowValue ?? undefined,
    highValue: highValue ?? undefined,
  })
}

function guessType(value) {
  // RangeValue is the only constructed type with no `codings` key -- and
  // since a CC/ObsVal's `codings` array is never undefined, it always
  // survives a JSON round-trip (localStorage persistence strips undefined
  // keys, which is what strips the $type tag itself).
  if (!('codings' in value)) return 'rangeval'
  if ('number' in value || 'number2' in value || 'type' in value) return 'obsval'
  return 'cc'
}

export function displayText(value) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'string' || typeof value === 'number') return String(value)

  const type = value.$type ?? guessType(value)

  if (type === 'rangeval') {
    if (value.text) return value.text
    if (value.lowValue !== undefined || value.highValue !== undefined) {
      return `${value.lowValue ?? '?'}-${value.highValue ?? '?'}`
    }
    return undefined
  }
  if (type === 'obsval') {
    if (value.text) return value.text
    if (value.number !== undefined) {
      return value.number2 !== undefined ? `${value.number}-${value.number2}` : String(value.number)
    }
    if (value.type) return displayText(value.type)
    return value.codings?.[0]?.display ?? value.codings?.[0]?.code
  }
  if (type === 'cc') {
    return value.text || value.codings?.[0]?.display || value.codings?.[0]?.code
  }
  return undefined
}

export function isPopulated(value) {
  return displayText(value) !== undefined
}
