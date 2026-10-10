// Many real-world imports (a SMART Health Link that aggregates several
// provider/payer systems, in particular) hand back the same clinical fact
// more than once -- the same condition, allergy, or care team entry pulled
// independently from two or more source systems. That is useful for PIQI
// auditing (duplication/consistency findings use every copy), but it makes
// the patient-facing card grid unreadable: a dozen identical "Product
// containing penicillin" cards in a row says nothing a single card doesn't.
//
// This only collapses what is genuinely the same information shown twice --
// the source records themselves are untouched, so counts used elsewhere
// (PIQI audits, the findings engine) are unaffected.

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
