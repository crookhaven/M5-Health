// Reads a FHIR InsurancePlan (CARIN Digital Insurance Card SBC profile), on its
// own or inside a Bundle, into a plain model the plan screens can show:
// plan-level amounts, each benefit's cost by network, its limits and prior
// authorization, and the extra benefits the plan lists but the profile has no
// place to describe yet (Benefit Plan Standard's bps-unmapped-benefit).

const SBC_CATEGORY = 'http://hl7.org/fhir/us/insurance-card/CodeSystem/sbc-benefit-category'
const BPS = 'https://benefitplanstandard.org/fhir/StructureDefinition/'
const LIMITATION = 'http://hl7.org/fhir/us/insurance-card/StructureDefinition/benefit-limitation'
const EXCLUDED = 'http://hl7.org/fhir/us/insurance-card/StructureDefinition/excluded-services'
const DEDUCTIBLE_APPLIES = 'http://hl7.org/fhir/us/insurance-card/StructureDefinition/deductible-applies'
const ABSENT = 'http://hl7.org/fhir/StructureDefinition/data-absent-reason'

export class InsurancePlanError extends Error {}

export const MARKET_LABELS = {
  medicare_advantage: 'Medicare Advantage',
  individual: 'ACA individual market',
  small_group: 'Employer (small group)',
  large_group: 'Employer (large group)',
  self_funded: 'Employer (self-funded)',
}

function ext(el, url) {
  return (el?.extension ?? []).filter((e) => e.url === url)
}

function value(e) {
  if (!e) return undefined
  const key = Object.keys(e).find((k) => k.startsWith('value'))
  return key ? e[key] : undefined
}

// The sub-extensions of a complex extension, as { url: value }.
function fields(e) {
  const out = {}
  for (const sub of e?.extension ?? []) out[sub.url] = value(sub)
  return out
}

function conceptText(cc) {
  if (!cc) return undefined
  return cc.text ?? cc.coding?.[0]?.display ?? cc.coding?.[0]?.code
}

function categoryOf(cc) {
  const coding = cc?.coding?.find((c) => c.system === SBC_CATEGORY) ?? cc?.coding?.[0]
  return { code: coding?.code, display: coding?.display ?? cc?.text }
}

const NETWORK = { 'in-network': 'In network', 'out-of-network': 'Out of network', other: 'Other' }
const TIERS = { IN: 'In network', IN2: 'In network, tier 2', OUT: 'Out of network', POS: 'Point-of-service option' }

function networkLabel(cost, share) {
  const tier = share.tierId
  if (tier && TIERS[tier]) return TIERS[tier]
  const hospitalTier = tier?.match(/^IN.*TIER_(\d+)$/)
  if (hospitalTier) return `In network, hospital tier ${hospitalTier[1]}`
  if (tier?.startsWith('SITE_')) return tier.slice(5).toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  const code = cost.applicability?.coding?.[0]?.code
  return NETWORK[code] ?? conceptText(cost.applicability) ?? 'In network'
}

function costKind(type) {
  const code = type?.coding?.[0]?.code
  const text = (type?.text ?? type?.coding?.[0]?.display ?? '').toLowerCase()
  if (/not covered/.test(text)) return 'not-covered'
  if (/no charge/.test(text)) return 'no-charge'
  if (code === 'copaypct' || code === 'coinsurance' || /coinsurance/.test(text)) return 'coinsurance'
  if (code === 'copay' || /copay/.test(text)) return 'copay'
  if (code === 'deductible' || /deductible/.test(text)) return 'deductible'
  return 'other'
}

function parseCost(cost) {
  const share = fields(ext(cost, `${BPS}bps-cost-share`)[0])
  const absent = cost.value ? value(ext(cost.value, ABSENT)[0]) : undefined
  const kind = costKind(cost.type)
  return {
    network: networkLabel(cost, share),
    kind,
    label: cost.type?.text,
    amount: typeof cost.value?.value === 'number' ? cost.value.value : null,
    unit: cost.value?.unit === '%' || cost.value?.code === '%' ? '%' : cost.value?.value !== undefined ? 'USD' : null,
    absent: kind === 'not-covered' ? null : (absent ?? (cost.value?.value === undefined ? 'unknown' : null)),
    deductibleApplies: value(ext(cost, DEDUCTIBLE_APPLIES)[0]) ?? null,
    basis: share.basis ?? null,
    from: share.unitRangeFrom ?? null,
    to: share.unitRangeTo ?? null,
    qualifiers: (cost.qualifiers ?? []).map(conceptText).filter(Boolean),
  }
}

function parseLimit(e) {
  const f = fields(e)
  const qty = f.limitValue
  return {
    amount: qty?.value ?? null,
    unit: qty?.unit ?? null,
    type: conceptText(f.limitType) ?? null,
    period: conceptText(f.limitPeriod) ?? null,
    text: f.limitText ?? null,
  }
}

function benefitKey(category, b) {
  return `${category.code ?? ''}|${conceptText(b.type) ?? ''}`
}

export function findInsurancePlan(input) {
  let obj = input
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj.replace(/^﻿/, ''))
    } catch {
      throw new InsurancePlanError('That is not valid JSON.')
    }
  }
  if (obj?.resourceType === 'InsurancePlan') return { plan: obj, bundle: null }
  if (obj?.resourceType === 'Bundle') {
    const plan = (obj.entry ?? []).map((e) => e.resource).find((r) => r?.resourceType === 'InsurancePlan')
    if (plan) return { plan, bundle: obj }
  }
  throw new InsurancePlanError('No FHIR InsurancePlan found. Load an InsurancePlan or a Bundle that contains one.')
}

export function parseInsurancePlan(input) {
  const { plan, bundle } = findInsurancePlan(input)
  const meta = fields(ext(plan, `${BPS}bps-plan-metadata`)[0])
  const owner =
    plan.ownedBy?.display ??
    (bundle?.entry ?? [])
      .map((e) => e.resource)
      .find((r) => r?.resourceType === 'Organization' && plan.ownedBy?.reference?.endsWith(r.id))?.name

  const ids = {}
  for (const id of plan.identifier ?? []) {
    const name = id.system?.split('/').pop()
    if (name) ids[name] = id.value
  }

  // Coverage carries limits, prior authorization and whether Medicare covers
  // the service; plan.specificCost carries what the member pays. Join them on
  // category and benefit name.
  const byKey = new Map()
  const benefits = []
  const touch = (category, b) => {
    const key = benefitKey(category, b)
    if (!byKey.has(key)) {
      const entry = {
        category,
        name: conceptText(b.type) ?? category.display ?? 'Benefit',
        costs: [],
        limits: [],
        requirement: null,
        coverageBasis: null,
      }
      byKey.set(key, entry)
      benefits.push(entry)
    }
    return byKey.get(key)
  }

  for (const cov of plan.coverage ?? []) {
    const category = categoryOf(cov.type)
    for (const b of cov.benefit ?? []) {
      const entry = touch(category, b)
      entry.requirement = b.requirement ?? entry.requirement
      entry.coverageBasis = fields(ext(b, `${BPS}bps-benefit`)[0]).coverageBasis ?? entry.coverageBasis
      for (const l of ext(b, LIMITATION)) entry.limits.push(parseLimit(l))
      for (const l of b.limit ?? []) {
        entry.limits.push({ amount: l.value?.value ?? null, unit: l.value?.unit ?? null, type: null, period: null, text: conceptText(l.code) ?? null })
      }
    }
  }
  const general = []
  for (const p of plan.plan ?? []) {
    for (const g of p.generalCost ?? []) {
      const acc = fields(ext(g, `${BPS}bps-accumulator`)[0])
      general.push({
        label: conceptText(g.type) ?? 'Plan amount',
        network: TIERS[acc.networkTier] ?? null,
        amount: g.cost?.value ?? null,
        groupSize: g.groupSize ?? null,
      })
    }
    for (const sc of p.specificCost ?? []) {
      const category = categoryOf(sc.category)
      for (const b of sc.benefit ?? []) {
        const entry = touch(category, b)
        for (const c of b.cost ?? []) entry.costs.push(parseCost(c))
      }
    }
  }

  const extras = ext(plan, `${BPS}bps-unmapped-benefit`).map((e) => {
    const f = fields(e)
    return { key: f.canonicalKey ?? null, name: f.serviceName ?? f.benefitId ?? 'Benefit', category: f.category ?? null }
  })

  const excluded = []
  for (const e of ext(plan, EXCLUDED)) {
    for (const s of (e.extension ?? []).filter((x) => x.url === 'service')) {
      const f = fields(s)
      const name = conceptText(f.serviceType)
      if (name) excluded.push(name)
    }
  }

  const year = meta.planYear ?? (plan.period?.start ? Number(String(plan.period.start).slice(0, 4)) : null)
  return {
    id: plan.id ?? null,
    name: plan.name ?? 'Unnamed plan',
    issuer: owner ?? null,
    market: meta.market ?? null,
    marketLabel: MARKET_LABELS[meta.market] ?? null,
    planYear: year,
    period: plan.period ?? null,
    contractPlan: ids.cms_contract_plan_segment ?? null,
    general,
    benefits,
    extras,
    excluded,
  }
}

function money(n) {
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

const BASIS = {
  per_day: 'a day',
  per_stay: 'a stay',
  per_visit: 'a visit',
  per_one_way_trip: 'a one-way trip',
  per_prescription: 'a prescription',
  per_30_day_supply: 'a 30-day supply',
}

// One cost as the member would read it, e.g. "$375 a day, days 1–5".
export function formatCost(c) {
  if (c.kind === 'not-covered') return 'Not covered'
  if (c.absent) return 'Not in the plan data'
  if (c.kind === 'no-charge') return 'No charge'
  let text
  if (c.unit === '%') text = `${c.amount}% coinsurance`
  else if (c.amount === 0) text = '$0'
  else text = `${money(c.amount)} ${c.kind === 'coinsurance' ? 'coinsurance' : 'copay'}`
  if (c.unit !== '%' && BASIS[c.basis]) text += ` ${BASIS[c.basis]}`
  if (c.from !== null && c.to !== null) text += `, ${c.basis === 'per_day' ? 'days' : 'units'} ${c.from}–${c.to >= 999 ? 'on' : c.to}`
  if (c.deductibleApplies === true) text += ' after the deductible'
  return text
}

export function formatLimit(l) {
  if (l.text) return l.text
  let period = l.period ? l.period.replace(/_/g, ' ').toLowerCase() : ''
  if (period && !period.startsWith('per ')) period = `per ${period}`
  period = period ? ` ${period}` : ''
  if (l.amount === null) return (l.type ?? 'Limit') + period
  const unit = l.unit ?? l.type ?? ''
  return `${unit.toLowerCase().includes('usd') || unit === '$' ? money(l.amount) : `${l.amount} ${unit}`.trim()}${period}`
}

export function formatAmount(n) {
  return n === null || n === undefined ? 'Not in the plan data' : money(n)
}
