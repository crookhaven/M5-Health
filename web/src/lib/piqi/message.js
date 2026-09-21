import { effectiveData } from './engine'
import { ATTRIBUTE_TYPES } from './rules'
import { codeableConcept, observationValue, rangeValue, toWireValue } from './attributeTypes'

// The 10 PIQI Clinical Data Model classes and their message field names --
// Coverage is an M5 Health addition outside the model and is never included.
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

export function buildPiqiMessage(sourceRecords, assertions, { domains = PIQI_MESSAGE_DOMAINS } = {}) {
  const patient = {}
  for (const domain of domains) {
    if (domain === 'coverage') continue
    const records = sourceRecords.filter((r) => r.domain === domain)
    if (records.length === 0) continue
    const wired = records.map((record) => wireRecord(domain, effectiveData(record, assertions).merged))
    // Demographics has cardinality One in the model -- a single object, not
    // an array of one.
    patient[domain] = domain === 'demographics' ? wired[0] : wired
  }

  return {
    FormatID: 'M5 Health JSON',
    MessageId: crypto.randomUUID(),
    model: 'PAT_CLINICAL_V1',
    patient,
  }
}
