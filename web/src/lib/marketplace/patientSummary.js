import { displayText } from '../piqi/attributeTypes'
import { effectiveData } from '../piqi/engine'

// The parts of a patient's records that matter for choosing a plan: conditions,
// medicines (with RxNorm codes when present) and procedures. No name, birth date,
// address or identifiers are read here.

function rxnormCode(concept) {
  const codings = concept?.codings ?? []
  return codings.find((c) => /rxnorm/i.test(c.system ?? ''))?.code
}

export function summarizePatient(sourceRecords, assertions) {
  const conditions = []
  const medications = []
  const procedures = []
  for (const record of sourceRecords) {
    const { merged } = effectiveData(record, assertions)
    if (record.domain === 'conditions') {
      const name = displayText(merged.condition)
      if (name) conditions.push({ id: record.id, name, status: displayText(merged.clinicalStatus) ?? null })
    } else if (record.domain === 'medications') {
      const name = displayText(merged.medication)
      if (name) medications.push({ id: record.id, name, rxcui: rxnormCode(merged.medication) ?? null })
    } else if (record.domain === 'procedures') {
      const name = displayText(merged.procedure)
      if (name) procedures.push({ id: record.id, name })
    }
  }
  return { conditions, medications, procedures }
}
