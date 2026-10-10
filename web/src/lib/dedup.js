// Many real-world imports (a SMART Health Link that aggregates several
// provider/payer systems, in particular) hand back the same clinical fact
// more than once -- the same condition, allergy, or care team entry pulled
// independently from two or more source systems. That is useful for PIQI
// auditing (duplication/consistency findings use every copy), but it makes
// the patient-facing card grid unreadable: a dozen identical "Product
// containing penicillin" cards in a row says nothing a single card doesn't.
//
// On top of that, a lot of what looks like duplication in real data isn't a
// data-quality problem at all: it's the same ongoing fact -- a chronic
// condition, a tobacco-use status, a known allergy -- being reaffirmed at
// nearly every visit, each time as its own fully-formed, non-identical
// record (different onset/asserted/encounter timestamps). Collapsing exact
// duplicates doesn't touch that; a patient-facing summary needs to group
// those down to "what's true right now," while the detailed/comparison view
// still shows every instance for a provider to review.
//
// This only changes what the Dashboard and the import summary show --
// source records themselves are untouched, so counts used elsewhere (PIQI
// audits, the findings engine, Clinical view) are unaffected.

import { normalizeText } from './piqi/rules'

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const v = canonicalize(value[key])
        if (v !== undefined) acc[key] = v
        return acc
      }, {})
  }
  return value
}

function recordSignature(record) {
  return JSON.stringify(canonicalize(record.data ?? {}))
}

function populatedFieldCount(record) {
  const data = record.data ?? {}
  return Object.values(data).filter((v) => v !== undefined && v !== null && v !== '').length
}

// Picks the most complete record out of a group of equivalent ones (more
// populated fields wins; ties keep the first-seen one, for stable output).
function richestOf(group) {
  return group.reduce((best, r) => (populatedFieldCount(r) > populatedFieldCount(best) ? r : best), group[0])
}

// Collapses records that are exact duplicates of each other (identical
// content, differing at most in id/source) down to one representative each,
// preserving first-seen order. `demographics` is a special case: there is
// only ever one patient, so multiple Patient resources -- even when they
// disagree on an address or an identifier -- collapse to a single card, the
// most complete one, rather than one per source system.
export function collapseDuplicateRecords(domain, records) {
  if (records.length <= 1) return records

  if (domain === 'demographics') return [richestOf(records)]

  const order = []
  const groups = new Map()
  for (const record of records) {
    const key = recordSignature(record)
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key).push(record)
  }
  return order.map((key) => richestOf(groups.get(key)))
}

function parseDateValue(value) {
  if (typeof value !== 'string' || !value) return undefined
  const t = Date.parse(value)
  return Number.isNaN(t) ? undefined : t
}

// Collapses every instance of the same real-world item down to a single
// card -- the most recent one, since that's what matters most (is this
// still active, what's the latest status) -- noting how far back it goes
// and how many times it's been recorded so that history isn't silently
// lost. `entries` is [{ record, merged }], where `merged` is whatever data
// identity/date fields should be read from (patient assertions applied, or
// just record.data when none apply yet).
function summarizeRecurringRecords(domain, entries, identityField, dateField) {
  if (!identityField || entries.length <= 1) return entries.map((e) => e.record)

  const order = []
  const groups = new Map()
  for (const entry of entries) {
    const key = normalizeText(entry.merged[identityField])
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key).push(entry)
  }

  return order.map((key) => {
    const group = groups.get(key)
    if (group.length === 1) return group[0].record

    const dated = group
      .map((entry) => ({ entry, time: dateField ? parseDateValue(entry.merged[dateField]) : undefined }))
      .sort((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity))
    const latest = dated[0].entry
    const times = dated.map((d) => d.time).filter((t) => t !== undefined)

    return {
      ...latest.record,
      _recurrence: {
        count: group.length,
        firstDate: times.length ? new Date(Math.min(...times)).toISOString() : undefined,
      },
    }
  })
}

// Which measurements within vitalSigns are worth seeing as a full history
// (a trend -- heart rate, blood pressure, weight, BMI) versus which are
// re-taken out of habit but essentially static in an adult and just clutter
// the summary with repeats (height). Add to this list if another static
// measurement shows up in real data.
const STATIC_VITAL_SIGNS = ['height', 'body height', 'head circumference']

function isStaticVitalSign(identityText) {
  return STATIC_VITAL_SIGNS.some((term) => identityText.includes(term))
}

const ALWAYS_GROUP = () => true

// Per domain, which records should be grouped down to "the latest" versus
// kept as a full, exact-duplicate-collapsed history. Conditions, health
// assessments (tobacco status and the like), allergies, immunizations,
// procedures and medical devices are reaffirmed at nearly every visit as the
// same fact, not re-measured -- group those. Lab results and medications are
// left alone entirely: repeated entries there are real, separate things (a
// new test, a new fill). vitalSigns is mixed: most of it is trend data
// (kept), but a handful of measurements are effectively static (grouped).
const GROUP_RULES = {
  conditions: ALWAYS_GROUP,
  healthAssessments: ALWAYS_GROUP,
  allergies: ALWAYS_GROUP,
  immunizations: ALWAYS_GROUP,
  procedures: ALWAYS_GROUP,
  medicalDevices: ALWAYS_GROUP,
  vitalSigns: isStaticVitalSign,
}

// The one entry point the Dashboard and the import summary both use.
// `getMerged(record)` reads whatever data identity/date fields should come
// from (effectiveData's merged result on the Dashboard, where patient
// assertions can override a field; plain record.data right after import,
// before any assertions exist).
export function summarizeForDisplay(domain, records, getMerged, identityField, dateField) {
  if (records.length <= 1) return records
  if (domain === 'demographics') return collapseDuplicateRecords(domain, records)

  const rule = GROUP_RULES[domain]
  if (!rule || !identityField) return collapseDuplicateRecords(domain, records)

  const toGroup = []
  const toKeep = []
  for (const record of records) {
    const merged = getMerged(record)
    const identityText = normalizeText(merged[identityField])
    if (rule(identityText)) toGroup.push({ record, merged })
    else toKeep.push(record)
  }

  const grouped = summarizeRecurringRecords(domain, toGroup, identityField, dateField)
  const kept = collapseDuplicateRecords(domain, toKeep)
  return [...grouped, ...kept]
}
