// Turns plans returned by the CMS Marketplace API (POST /plans/search) into a
// flat shape the comparison screen can show. Every field is optional in the
// API response, so anything missing becomes null and is shown as "Not listed".

// The benefits a patient most often compares, matched by the API's benefit names.
export const COMPARE_BENEFITS = [
  { key: 'primaryCare', label: 'Primary care visit', match: /primary care visit/i },
  { key: 'specialist', label: 'Specialist visit', match: /specialist visit/i },
  { key: 'emergency', label: 'Emergency room', match: /emergency room/i },
  { key: 'urgentCare', label: 'Urgent care', match: /urgent care/i },
  { key: 'genericDrugs', label: 'Generic drugs', match: /^generic drugs/i },
  { key: 'mentalHealth', label: 'Mental health visit (outpatient)', match: /mental\/behavioral health outpatient/i },
]

const IN_NETWORK = /in-?network|tier 1/i

// Windows PowerShell can decode the API's UTF-8 text as Latin-1, turning "®" into
// "Â®". Undo that when the text looks like it went through it.
export function fixMojibake(text) {
  if (typeof text !== 'string' || !/[\u00C2\u00C3]/.test(text)) return text
  try {
    const bytes = Uint8Array.from(text, (c) => {
      const code = c.charCodeAt(0)
      if (code > 255) throw new Error('not latin1')
      return code
    })
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return text
  }
}

function percent(rate) {
  if (typeof rate !== 'number') return null
  const value = rate <= 1 ? rate * 100 : rate
  return `${Math.round(value * 100) / 100}%`
}

// One cost-sharing entry as words, e.g. "$30 copay" or "20% coinsurance after deductible".
export function costText(cs) {
  if (!cs) return null
  if (typeof cs.display_string === 'string' && cs.display_string.trim()) return cs.display_string.trim()
  const parts = []
  if (typeof cs.copay_amount === 'number') {
    parts.push(cs.copay_amount === 0 ? 'No charge' : `$${cs.copay_amount} copay`)
    if (cs.copay_options) parts.push(String(cs.copay_options).toLowerCase())
  }
  if (typeof cs.coinsurance_rate === 'number') {
    parts.push(`${percent(cs.coinsurance_rate)} coinsurance`)
    if (cs.coinsurance_options) parts.push(String(cs.coinsurance_options).toLowerCase())
  }
  return parts.length ? parts.join(' ') : null
}

function inNetwork(benefit) {
  const sharings = benefit.cost_sharings ?? []
  return sharings.find((c) => IN_NETWORK.test(c.network_tier ?? '')) ?? sharings[0]
}

// The in-network cost of a benefit as numbers, for the yearly cost estimate:
// { copay, rate, afterDeductible, notCovered }. Null when the plan lists nothing.
export function costRule(benefit) {
  if (!benefit) return null
  if (benefit.covered === false) return { copay: 0, rate: 0, afterDeductible: false, notCovered: true }
  const cs = inNetwork(benefit)
  if (!cs) return null
  const text = [cs.display_string, cs.copay_options, cs.coinsurance_options].filter(Boolean).join(' ')
  const rate = typeof cs.coinsurance_rate === 'number' ? (cs.coinsurance_rate <= 1 ? cs.coinsurance_rate : cs.coinsurance_rate / 100) : 0
  return {
    copay: typeof cs.copay_amount === 'number' ? cs.copay_amount : 0,
    rate,
    afterDeductible: /after deductible/i.test(text),
    notCovered: /not covered/i.test(cs.display_string ?? ''),
  }
}

function benefitText(plan, matcher) {
  const benefit = (plan.benefits ?? []).find((b) => matcher.test(b.name ?? ''))
  if (!benefit) return null
  if (benefit.covered === false) return 'Not covered'
  const sharings = benefit.cost_sharings ?? []
  const pick = sharings.find((c) => IN_NETWORK.test(c.network_tier ?? '')) ?? sharings[0]
  return costText(pick) ?? (benefit.covered ? 'Covered' : null)
}

// The individual, in-network amount from a deductibles[] or moops[] list.
function amountFrom(list, preferType) {
  const items = (list ?? []).filter((d) => typeof d.amount === 'number')
  const score = (d) =>
    (IN_NETWORK.test(d.network_tier ?? '') ? 4 : 0) +
    (/individual/i.test(d.family_cost ?? '') || d.individual === true ? 2 : 0) +
    (preferType && preferType.test(d.type ?? '') ? 1 : 0)
  items.sort((a, b) => score(b) - score(a))
  return items.length ? items[0].amount : null
}

export function normalizePlan(plan) {
  const benefits = {}
  const rules = {}
  for (const b of COMPARE_BENEFITS) {
    benefits[b.key] = benefitText(plan, b.match)
    rules[b.key] = costRule((plan.benefits ?? []).find((x) => b.match.test(x.name ?? '')))
  }
  return {
    id: plan.id ?? plan.name,
    name: fixMojibake(plan.name) ?? 'Unnamed plan',
    issuer: fixMojibake(plan.issuer?.name) ?? null,
    metalLevel: plan.metal_level ?? null,
    type: plan.type ?? null,
    premium: typeof plan.premium === 'number' ? plan.premium : null,
    premiumWithCredit: typeof plan.premium_w_credit === 'number' ? plan.premium_w_credit : null,
    deductible: amountFrom(plan.deductibles, /combined|medical/i),
    moop: amountFrom(plan.moops, /combined|medical/i),
    hsaEligible: typeof plan.hsa_eligible === 'boolean' ? plan.hsa_eligible : null,
    qualityRating: typeof plan.quality_rating?.global_rating === 'number' ? plan.quality_rating.global_rating : null,
    hasNationalNetwork: typeof plan.has_national_network === 'boolean' ? plan.has_national_network : null,
    benefits,
    rules,
    links: {
      brochure: plan.brochure_url || null,
      benefits: plan.benefits_url || null,
      formulary: plan.formulary_url || null,
      network: plan.network_url || null,
    },
  }
}

// The API's /drugs/covered answer, saved by the fetch script as _drug_coverage.
// Returns { [planId]: { [rxcui]: 'covered' | 'not-covered' | 'unknown' } }.
export function parseDrugCoverage(raw) {
  if (!raw) return null
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw.coverage) ? raw.coverage : Array.isArray(raw.drugs) ? raw.drugs : []
  const out = {}
  for (const row of rows) {
    if (!row || row.plan_id == null || row.rxcui == null) continue
    const status = /^(covered|genericcovered)$/i.test(String(row.coverage))
      ? 'covered'
      : /^notcovered$/i.test(String(row.coverage))
        ? 'not-covered'
        : 'unknown'
    out[row.plan_id] = { ...(out[row.plan_id] ?? {}), [String(row.rxcui)]: status }
  }
  return Object.keys(out).length ? out : null
}

// Accepts the API response ({ plans: [...] }) or a bare array of plans.
export function parsePlansFile(text) {
  let data
  try {
    // Windows PowerShell saves a byte-order mark at the start of the file.
    data = JSON.parse(String(text).replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const list = Array.isArray(data) ? data : data?.plans
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('No plans found. Expect a Marketplace API result with a "plans" list.')
  }
  return {
    note: typeof data?._note === 'string' ? data._note : null,
    household: data?._household ?? null,
    drugCoverage: parseDrugCoverage(data?._drug_coverage),
    plans: list.map(normalizePlan),
  }
}
