import { displayText } from '../piqi/attributeTypes'
import { effectiveData } from '../piqi/engine'

// The parts of a patient's records that matter for choosing a plan: conditions,
// medicines (with RxNorm codes when present) and procedures. No name, birth date,
// address or identifiers are read here.
//
// A real record repeats things: a medicine appears once per prescription and
// again for each pharmacy claim, a diagnosis once on the problem list and again
// on every claim, and old prescriptions stay on file after they are stopped.
// For plan shopping only what is current counts, and each item counts once, so
// the yearly drug estimate and the drug check are not inflated.

const INACTIVE_MEDICATION = new Set(['stopped', 'completed', 'cancelled', 'entered-in-error', 'ended'])
const INACTIVE_CONDITION = new Set(['resolved', 'inactive', 'remission'])
const CLAIM_DIAGNOSIS = 'claim diagnosis'
const ICD10 = /icd-10/i
const CPT = /ama-assn|cpt/i

function rxnormCode(concept) {
  const codings = concept?.codings ?? []
  return codings.find((c) => /rxnorm/i.test(c.system ?? ''))?.code
}

const nameKey = (name) => name.trim().toLowerCase()
const codeKeys = (concept) => (concept?.codings ?? []).filter((c) => c.code).map((c) => `${c.system ?? ''}|${c.code}`)
// ICD-10 category (the first three characters), so E11.42 and E11.65 are both "E11".
const icdCategories = (concept) =>
  (concept?.codings ?? []).filter((c) => ICD10.test(c.system ?? '') && c.code).map((c) => c.code.slice(0, 3).toUpperCase())

const isInactiveMedication = (merged) => INACTIVE_MEDICATION.has((displayText(merged.requestStatus) ?? '').toLowerCase())

function summarizeMedications(items) {
  const medications = []
  const seen = new Set()
  // Prescriptions with an RxNorm code first, so a pharmacy claim for the same
  // medicine (NDC-coded, no status) folds into it by name; within those, active
  // before ended, so a drug that was stopped and later restarted still counts.
  const rank = ({ merged }) => (rxnormCode(merged.medication) ? 0 : 2) + (isInactiveMedication(merged) ? 1 : 0)
  const ordered = [...items].sort((a, b) => rank(a) - rank(b))
  for (const { record, merged } of ordered) {
    const name = displayText(merged.medication)
    if (!name) continue
    const rxcui = rxnormCode(merged.medication) ?? null
    const keys = [nameKey(name), rxcui && `rx:${rxcui}`].filter(Boolean)
    if (keys.some((k) => seen.has(k))) continue
    keys.forEach((k) => seen.add(k))
    // An ended prescription is remembered, so its claim copies don't revive it.
    if (isInactiveMedication(merged)) continue
    medications.push({ id: record.id, name, rxcui, asNeeded: displayText(merged.asNeeded) === 'Yes' })
  }
  return medications
}

function summarizeConditions(items) {
  const conditions = []
  const seenCodes = new Set()
  const seenCategories = new Set()
  const seenNames = new Set()
  const isClaim = (merged) => (displayText(merged.conditionCategory) ?? '').toLowerCase() === CLAIM_DIAGNOSIS
  // Problem-list conditions first; claim diagnoses only add what they lack.
  const ordered = [...items].sort((a, b) => Number(isClaim(a.merged)) - Number(isClaim(b.merged)))
  for (const { record, merged } of ordered) {
    const name = displayText(merged.condition)
    if (!name) continue
    const status = displayText(merged.clinicalStatus) ?? null
    const codes = codeKeys(merged.condition)
    const categories = icdCategories(merged.condition)
    if (INACTIVE_CONDITION.has((status ?? '').toLowerCase())) {
      // Not counted, but remembered, so its claim diagnoses don't bring it back.
      codes.forEach((k) => seenCodes.add(k))
      categories.forEach((c) => seenCategories.add(c))
      seenNames.add(nameKey(name))
      continue
    }
    if (isClaim(merged)) {
      // Encounter reasons ("routine exam", "screening") are Z codes, not health problems.
      if (categories.length && categories.every((c) => c.startsWith('Z'))) continue
      if (categories.some((c) => seenCategories.has(c))) continue
    }
    if (codes.some((k) => seenCodes.has(k)) || seenNames.has(nameKey(name))) continue
    codes.forEach((k) => seenCodes.add(k))
    categories.forEach((c) => seenCategories.add(c))
    seenNames.add(nameKey(name))
    conditions.push({ id: record.id, name, status })
  }
  return conditions
}

// Office and preventive visit codes (CPT 99202-99499) describe visits, which the
// estimate already counts as usage, not procedures.
function isVisitCode(concept) {
  return (concept?.codings ?? []).some((c) => CPT.test(c.system ?? '') && /^99[2-4]\d\d$/.test(c.code ?? ''))
}

function summarizeProcedures(items) {
  const procedures = []
  const seen = new Set()
  for (const { record, merged } of items) {
    const name = displayText(merged.procedure)
    if (!name || isVisitCode(merged.procedure)) continue
    const keys = [...codeKeys(merged.procedure), nameKey(name)]
    if (keys.some((k) => seen.has(k))) continue
    keys.forEach((k) => seen.add(k))
    procedures.push({ id: record.id, name })
  }
  return procedures
}

export function summarizePatient(sourceRecords, assertions) {
  const byDomain = { conditions: [], medications: [], procedures: [] }
  for (const record of sourceRecords) {
    if (!byDomain[record.domain]) continue
    byDomain[record.domain].push({ record, merged: effectiveData(record, assertions).merged })
  }
  return {
    conditions: summarizeConditions(byDomain.conditions),
    medications: summarizeMedications(byDomain.medications),
    procedures: summarizeProcedures(byDomain.procedures),
  }
}
