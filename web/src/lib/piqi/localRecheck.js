import { displayText, isPopulated } from './attributeTypes'

// Local re-check: after a patient adds a value, re-evaluate ONLY the two
// simplest kinds of check -- "is populated" and "is a valid number" -- so the
// screen can show the fix straight away. Everything else (code systems, UCUM
// units, date rules, plausibility) needs the real engine. Anything decided
// here is labelled as updated locally until the message is re-audited.

export const LOCAL_LABEL = 'Updated locally, re-audit to confirm'

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

const NUMBER = /^\s*-?\d+(\.\d+)?\s*$/

export function isLocallyRecheckable(check) {
  const kind = checkKind(check)
  return kind === 'populated' || kind === 'numeric'
}

// The patient value entered after the result was loaded, if any.
function newerAssertion(check, assertions, loadedAt) {
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

// Returns true when the check would now pass, false when the patient's value
// still fails it, null when it cannot be judged locally (or nothing new).
export function recheckLocally(check, assertions, loadedAt) {
  if (!isLocallyRecheckable(check)) return null
  const assertion = newerAssertion(check, assertions, loadedAt)
  if (!assertion) return null
  if (!isPopulated(assertion.value)) return false
  if (checkKind(check) === 'numeric') return NUMBER.test(displayText(assertion.value) ?? '')
  return true
}

// Approximate score if the locally-passing checks were confirmed by the
// engine. Ignores weights, and attributes that were skipped for being empty
// (they would add new checks), so it is labelled an estimate wherever shown.
export function estimateScore(parsed, assertions, loadedAt) {
  const flipped = parsed.checks.filter((c) => recheckLocally(c, assertions, loadedAt) === true)
  if (flipped.length === 0 || !parsed.denominator) return { flippedIds: new Set(), estimate: null }
  const estimate = Math.round((100 * (parsed.numerator + flipped.length)) / parsed.denominator)
  return { flippedIds: new Set(flipped.map((c) => c.id)), estimate: Math.min(estimate, 100) }
}
