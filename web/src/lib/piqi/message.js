import { effectiveData } from './engine'
import { ATTRIBUTE_TYPES } from './rules'
import { codeableConcept, observationValue, rangeValue, toWireValue } from './attributeTypes'
import { isDisplayOnly } from '../domains'

// The 10 PIQI Clinical Data Model classes and their message field names --
// Coverage is an M5 Whole Health addition outside the model and is never included.
// https://github.com/piqiframework/reference_application/blob/main/PIQI_Engine.Server/ReferenceData/Models/PAT_CLINICAL_V1.json
export const PIQI_MESSAGE_DOMAINS = [
  'demographics',
  'allergies',
  'conditions',
  'immunizations',
  'labResults',
  'medications',
  'procedures',
  'vitalSigns',
  'medicalDevices',
  'healthAssessments',
]

function emptyWireValue(attributeType) {
  if (attributeType === 'cc') return toWireValue(codeableConcept({}))
  if (attributeType === 'obsval') return toWireValue(observationValue({}))
  if (attributeType === 'rangeval') return toWireValue(rangeValue({}))
  return null
}

// Real PIQI messages include every field the data class defines, even when
// unpopulated (as an explicit null or empty-codings object, never an omitted
// key) -- see the "category" attribute in
// https://github.com/piqiframework/reference_application/blob/main/PIQI.Service.Test/TestData/Input/Test5_PIQI.json
function wireRecord(domain, data) {
  const fieldTypes = ATTRIBUTE_TYPES[domain] ?? {}
  const result = {}
  for (const field of Object.keys(fieldTypes)) {
    result[field] =
      data[field] !== undefined ? toWireValue(data[field]) : emptyWireValue(fieldTypes[field])
  }
  return result
}

// Demographics has cardinality One in the model. A record pulled from several
// systems has several Patient resources, each often missing something, so the
// message takes each field from the first record that has it.
function mergedDemographics(records, assertions) {
  const merged = {}
  for (const record of records) {
    for (const [field, value] of Object.entries(effectiveData(record, assertions).merged)) {
      if (merged[field] === undefined && value !== undefined && value !== null && value !== '') merged[field] = value
    }
  }
  return merged
}

// The records of one domain that go into the message, in stored order. With
// `uniqueOnly`, exact copies (identical in every field PIQI scores) are sent
// once, so the score reflects distinct facts rather than how often a source
// repeated them. Gateway results are linked back with the same list.
export function messageRecords(sourceRecords, assertions, domain, { uniqueOnly = false } = {}) {
  const records = sourceRecords.filter((r) => r.domain === domain)
  if (!uniqueOnly || domain === 'demographics') return records
  const seen = new Set()
  return records.filter((record) => {
    const key = JSON.stringify(wireRecord(domain, effectiveData(record, assertions).merged))
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function buildPiqiMessage(sourceRecords, assertions, { domains = PIQI_MESSAGE_DOMAINS, uniqueOnly = false } = {}) {
  const patient = {}
  for (const domain of domains) {
    if (domain === 'coverage' || isDisplayOnly(domain)) continue
    const records = messageRecords(sourceRecords, assertions, domain, { uniqueOnly })
    if (records.length === 0) continue
    patient[domain] =
      domain === 'demographics'
        ? wireRecord(domain, mergedDemographics(records, assertions))
        : records.map((record) => wireRecord(domain, effectiveData(record, assertions).merged))
  }

  return {
    FormatID: 'M5 Whole Health JSON',
    MessageId: crypto.randomUUID(),
    model: 'PAT_CLINICAL_V1',
    patient,
  }
}
