import { codeableConcept, displayText, toWireValue } from '../piqi/attributeTypes'
import { CLAIMS_ATTRIBUTE_TYPES } from './model'

// Builds a PIQI message for the Patient EOB (claims) model, PAT_EOB_V1, in the
// layout of the reference application's sample claims messages: one member,
// coverage, and flat lists of medical claims, providers, diagnoses,
// procedures and service lines across all claims.
// https://github.com/piqiframework/reference_application/tree/main/PIQI_Engine.Server/ReferenceData/EOBPIQISamples

// Every field the class defines is present (null when empty), and values are
// coerced to the shape the model declares for that field.
function wireValue(type, value) {
  if (value === undefined || value === null) return type === 'cc' ? toWireValue(codeableConcept({})) : null
  if (type === 'cc') {
    if (typeof value === 'object') return toWireValue(value)
    return toWireValue(codeableConcept({ text: String(value) }))
  }
  if (typeof value === 'object') return displayText(value) ?? null
  return value
}

export function wireClaimsRecord(className, data) {
  const types = CLAIMS_ATTRIBUTE_TYPES[className] ?? {}
  const result = {}
  for (const [field, type] of Object.entries(types)) result[field] = wireValue(type, data?.[field])
  return result
}

function uniqueProviders(providers) {
  const seen = new Set()
  return providers.filter((p) => {
    const key = `${p.providerNpi ?? ''}|${p.careTeamRole?.codings?.[0]?.code ?? p.careTeamRole?.text ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function hasClaims(claimsData) {
  return Boolean(claimsData?.claims?.length)
}

export function buildClaimsPiqiMessage(claimsData) {
  const claims = claimsData?.claims ?? []
  const patient = {}
  if (claimsData?.member && Object.keys(claimsData.member).length > 0) {
    patient.member = wireClaimsRecord('member', claimsData.member)
  }
  if (claimsData?.coverage?.length) {
    patient.coverage = claimsData.coverage.map((c) => wireClaimsRecord('coverage', c))
  }
  const lists = [
    ['medicalClaim', (c) => [c.medicalClaim]],
    ['provider', (c) => c.providers],
    ['claimDiagnosis', (c) => c.diagnoses],
    ['claimProcedure', (c) => c.procedures],
    ['claimServiceLine', (c) => c.lines],
  ]
  for (const [className, pick] of lists) {
    let records = claims.flatMap((c) => pick(c) ?? [])
    // The same provider appears on many claims; the flat provider list keeps
    // each provider and role once.
    if (className === 'provider') records = uniqueProviders(records)
    if (records.length) patient[className] = records.map((r) => wireClaimsRecord(className, r))
  }
  return {
    FormatID: 'M5 Health JSON',
    MessageId: crypto.randomUUID(),
    model: 'PAT_EOB_V1',
    patient,
  }
}
