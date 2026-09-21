// A transparent yearly cost estimate for each plan, and a coverage score.
// Every number here is an assumption the patient can change; none of it is a
// quote. Prices are typical allowed charges, not what any plan will really bill.

export const SERVICES = [
  { key: 'primaryCare', label: 'Primary care visits', price: 150 },
  { key: 'specialist', label: 'Specialist visits', price: 250 },
  { key: 'urgentCare', label: 'Urgent care visits', price: 200 },
  { key: 'mentalHealth', label: 'Mental health visits', price: 150 },
  { key: 'emergency', label: 'Emergency room visits', price: 2500 },
  { key: 'genericDrugs', label: 'Generic drug fills (per year)', price: 20 },
]

export const DEFAULT_USAGE = {
  primaryCare: 3,
  specialist: 2,
  urgentCare: 1,
  mentalHealth: 0,
  emergency: 0,
  genericDrugs: 0,
}

// The most a person could pay in a year, medical and drugs together. Plans that keep
// drugs apart have two out-of-pocket maximums, so the two add up.
export function totalMoop(plan) {
  if (plan.moop === null || plan.moop === undefined) return null
  return plan.moop + (plan.drugMoop ?? 0)
}

// One year for one plan: premiums plus what the patient pays for the expected
// care, following the plan's deductible and capped at its out-of-pocket maximum.
// When a plan keeps drugs apart, drugs have their own deductible and their own maximum.
export function estimateYear(plan, usage) {
  const premiumYear = plan.premium === null ? null : Math.round(plan.premium * 12 * 100) / 100
  let medicalDeductibleLeft = plan.deductible ?? 0
  let drugDeductibleLeft = plan.drugDeductible ?? null
  let medicalPaid = 0
  let drugPaid = 0
  const notCovered = []
  const unknown = []

  for (const service of SERVICES) {
    const count = Number(usage[service.key]) || 0
    if (count <= 0) continue
    const rule = plan.rules?.[service.key]
    if (!rule) {
      unknown.push(service.label)
      continue
    }
    if (rule.notCovered) notCovered.push(service.label)
    const isDrug = service.key === 'genericDrugs'
    const ownDrugDeductible = isDrug && drugDeductibleLeft !== null
    for (let i = 0; i < count; i++) {
      const allowed = service.price
      let pay = 0
      if (rule.notCovered) {
        pay = allowed
      } else {
        let remaining = allowed
        if (rule.afterDeductible) {
          const left = ownDrugDeductible ? drugDeductibleLeft : medicalDeductibleLeft
          const toDeductible = Math.min(remaining, left)
          if (ownDrugDeductible) drugDeductibleLeft -= toDeductible
          else medicalDeductibleLeft -= toDeductible
          pay += toDeductible
          remaining -= toDeductible
          if (remaining > 0) pay += rule.copay > 0 ? rule.copay : rule.rate * remaining
        } else {
          pay = rule.copay > 0 ? rule.copay : rule.rate * remaining
        }
      }
      if (isDrug) drugPaid += pay
      else medicalPaid += pay
    }
  }

  let outOfPocket
  if (plan.drugMoop !== null && plan.drugMoop !== undefined) {
    outOfPocket =
      Math.min(medicalPaid, plan.moop ?? Infinity) + Math.min(drugPaid, plan.drugMoop)
  } else {
    outOfPocket = medicalPaid + drugPaid
    if (plan.moop !== null && plan.moop !== undefined) outOfPocket = Math.min(outOfPocket, plan.moop)
  }
  outOfPocket = Math.round(outOfPocket * 100) / 100
  return {
    premiumYear,
    outOfPocket,
    total: premiumYear === null ? null : Math.round((premiumYear + outOfPocket) * 100) / 100,
    notCovered,
    unknown,
  }
}

// Which of the patient's medicines a plan covers, from the saved drug check.
export function medicationCoverage(plan, medications, drugCoverage) {
  const withCode = medications.filter((m) => m.rxcui)
  const perPlan = drugCoverage?.[plan.id]
  if (!perPlan || withCode.length === 0) {
    return { checked: false, covered: 0, total: withCode.length, missing: [], unknown: [] }
  }
  const missing = []
  const unknown = []
  let covered = 0
  for (const m of withCode) {
    const status = perPlan[m.rxcui]
    if (status === 'covered') covered++
    else if (status === 'not-covered') missing.push(m.name)
    else unknown.push(m.name)
  }
  return { checked: true, covered, total: withCode.length, missing, unknown }
}

// Coverage score, 0 to 100, relative to the plans being compared:
// medicines 50, out-of-pocket maximum 20, deductible 15, star rating 15.
export function coverageScores(plans, meds) {
  const range = (values) => {
    const nums = values.filter((v) => v !== null)
    return nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : null
  }
  const moops = range(plans.map((p) => totalMoop(p.plan)))
  const deds = range(plans.map((p) => p.plan.deductible))
  const lowerIsBetter = (value, r) =>
    value === null || !r ? 0.5 : r.max === r.min ? 1 : 1 - (value - r.min) / (r.max - r.min)

  return plans.map(({ plan }, i) => {
    const med = meds[i]
    const medPart = med.checked && med.total > 0 ? med.covered / med.total : 0.5
    const parts = {
      medicines: 50 * medPart,
      outOfPocketMax: 20 * lowerIsBetter(totalMoop(plan), moops),
      deductible: 15 * lowerIsBetter(plan.deductible, deds),
      quality: 15 * ((plan.qualityRating ?? 2.5) / 5),
    }
    return { total: Math.round(Object.values(parts).reduce((a, b) => a + b, 0)), parts }
  })
}

// Two quick picks from rows of { plan, est, med, score }.
export function pickPlans(rows, budget) {
  const coversAll = (r) => !r.med.checked || (r.med.missing.length === 0 && r.med.unknown.length === 0)
  const priced = rows.filter((r) => r.est.total !== null)
  const lowest = priced
    .filter(coversAll)
    .sort((a, b) => a.est.total - b.est.total)[0] ?? null
  const bestCoverage = priced
    .filter((r) => budget === null || r.est.total <= budget)
    .sort((a, b) => b.score.total - a.score.total || a.est.total - b.est.total)[0] ?? null
  return { lowest, bestCoverage }
}
