// The app never decides whether a PIQI check passes -- only the PIQI Gateway
// does. This module only (1) sorts a failed check into a rough kind, by its
// name, so guidance can be worded sensibly, and (2) notices when the patient
// has typed a value for a check since the result was loaded, so the screen can
// say "re-run PIQI to see if it passes".

export const ADDED_LABEL = 'You added a value. Re-run PIQI to see if it passes.'

// What kind of test a check is, judged from its name ("Medication Dose Amount
// is populated"). The Gateway result does not include the rule's mnemonic.
export function checkKind(check) {
  const text = `${check.assessment ?? ''}`.toLowerCase()
  if (/\bpopulated\b/.test(text)) return 'populated'
  if (/valid number|numeric/.test(text)) return 'numeric'
  if (/date/.test(text)) return 'date'
  if (/ucum|code system|snomed|rxnorm|loinc|cvx|\bicd|valid concept|external list|code is|coded|in list|bcp-47|is valid$/.test(text)) {
    return 'coded'
  }
  return 'other'
}

// The patient value entered after the result was loaded, if any. This says a
// value was typed, nothing about whether it would pass.
export function addedValueFor(check, assertions, loadedAt) {
  if (!check.recordId) return null
  const matches = assertions.filter(
    (a) =>
      a.kind === 'field' &&
      a.sourceRecordId === check.recordId &&
      a.field === check.attribute &&
      (!loadedAt || a.createdAt > loadedAt),
  )
  return matches.length ? matches[matches.length - 1] : null
}
