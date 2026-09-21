import { describe, it, expect } from 'vitest'
import sample from '../../data/sample_marketplace_plans.json'
import { normalizePlan, parseDrugCoverage } from './normalize'
import { DEFAULT_USAGE, coverageScores, estimateYear, medicationCoverage, pickPlans, totalMoop } from './estimate'
import { buildAdvisorPrompt } from './advisorPrompt'
import { summarizePatient } from './patientSummary'

const plans = sample.plans.map(normalizePlan)
const [bronze, silver, gold, platinum] = plans
const usage = { ...DEFAULT_USAGE, primaryCare: 2, specialist: 1, urgentCare: 0, genericDrugs: 0 }

describe('estimateYear', () => {
  it('adds twelve premiums to what the patient pays for care', () => {
    // Silver: copays $30 primary care x2 and $70 specialist, no deductible for those
    const e = estimateYear(silver, usage)
    expect(e.premiumYear).toBeCloseTo(428.9 * 12, 2)
    expect(e.outOfPocket).toBe(30 * 2 + 70)
    expect(e.total).toBeCloseTo(428.9 * 12 + 130, 2)
  })

  it('makes the patient pay full price until an "after deductible" benefit kicks in', () => {
    // Bronze: $0 copay after a $7,500 deductible, so all three visits cost full price
    const e = estimateYear(bronze, usage)
    expect(e.outOfPocket).toBe(150 * 2 + 250)
  })

  it('never charges more than the out-of-pocket maximum', () => {
    const e = estimateYear(platinum, { ...DEFAULT_USAGE, emergency: 100 })
    expect(e.outOfPocket).toBe(platinum.moop)
  })

  it('reports care a plan lists nothing for, instead of guessing', () => {
    const e = estimateYear({ ...gold, rules: {} }, usage)
    expect(e.unknown.length).toBeGreaterThan(0)
    expect(e.outOfPocket).toBe(0)
  })

  it('treats a not-covered benefit as full price', () => {
    const plan = { ...silver, rules: { primaryCare: { copay: 0, rate: 0, afterDeductible: false, notCovered: true } } }
    const e = estimateYear(plan, { ...DEFAULT_USAGE, primaryCare: 2, specialist: 0, urgentCare: 0 })
    expect(e.outOfPocket).toBe(300)
    expect(e.notCovered).toContain('Primary care visits')
  })

  it('has no total when the premium is missing', () => {
    expect(estimateYear({ ...silver, premium: null }, usage).total).toBeNull()
  })
})

describe('medicationCoverage', () => {
  const meds = [
    { name: 'Lisinopril', rxcui: '29046' },
    { name: 'Atorvastatin', rxcui: '83367' },
    { name: 'Vitamin', rxcui: null },
  ]

  it('says not checked without a drug check file', () => {
    expect(medicationCoverage(silver, meds, null).checked).toBe(false)
  })

  it('counts covered, missing and unknown medicines', () => {
    const drug = parseDrugCoverage([
      { plan_id: silver.id, rxcui: 29046, coverage: 'Covered' },
      { plan_id: silver.id, rxcui: 83367, coverage: 'NotCovered' },
    ])
    const c = medicationCoverage(silver, meds, drug)
    expect(c).toMatchObject({ checked: true, covered: 1, total: 2 })
    expect(c.missing).toEqual(['Atorvastatin'])
  })
})

describe('parseDrugCoverage', () => {
  it('reads an array or a coverage list, and treats generic-covered as covered', () => {
    const rows = [{ plan_id: 'p', rxcui: 1, coverage: 'GenericCovered' }, { plan_id: 'p', rxcui: 2, coverage: 'DataNotProvided' }]
    expect(parseDrugCoverage(rows).p).toEqual({ 1: 'covered', 2: 'unknown' })
    expect(parseDrugCoverage({ coverage: rows }).p[1]).toBe('covered')
    expect(parseDrugCoverage(null)).toBeNull()
    expect(parseDrugCoverage([])).toBeNull()
  })
})

describe('coverageScores and picks', () => {
  const build = (drug) => {
    const base = plans.map((plan) => ({ plan, est: estimateYear(plan, usage), med: medicationCoverage(plan, [], drug) }))
    const scores = coverageScores(base, base.map((r) => r.med))
    return base.map((r, i) => ({ ...r, score: scores[i] }))
  }

  it('scores a lower out-of-pocket maximum and deductible higher', () => {
    const rows = build(null)
    const byName = Object.fromEntries(rows.map((r) => [r.plan.name, r.score.total]))
    expect(byName['Sample Platinum Plus']).toBeGreaterThan(byName['Sample Bronze Saver'])
  })

  it('picks the cheapest plan and the best coverage within a budget', () => {
    const rows = build(null)
    const { lowest, bestCoverage } = pickPlans(rows, null)
    expect(lowest.est.total).toBe(Math.min(...rows.map((r) => r.est.total)))
    expect(bestCoverage.score.total).toBe(Math.max(...rows.map((r) => r.score.total)))
    const limited = pickPlans(rows, lowest.est.total)
    expect(limited.bestCoverage.est.total).toBeLessThanOrEqual(lowest.est.total)
  })

  it('returns nothing when no plan fits the budget', () => {
    expect(pickPlans(build(null), 1).bestCoverage).toBeNull()
  })
})

describe('summarizePatient and buildAdvisorPrompt', () => {
  const rec = (id, domain, data) => ({ id, domain, data, source: {} })
  const cc = (text, codings = []) => ({ text, codings })
  const records = [
    rec('d', 'demographics', { firstName: 'Zed', lastName: 'Secretname', birthDate: '1980-01-01' }),
    rec('c', 'conditions', { condition: cc('Type 2 diabetes'), clinicalStatus: cc('Active') }),
    rec('m', 'medications', {
      medication: cc('Lisinopril 10 MG', [{ code: '29046', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' }]),
    }),
    rec('p', 'procedures', { procedure: cc('Appendectomy') }),
  ]

  it('reads conditions, medicines with RxNorm codes, and procedures', () => {
    const s = summarizePatient(records, [])
    expect(s.conditions[0].name).toBe('Type 2 diabetes')
    expect(s.medications[0]).toMatchObject({ name: 'Lisinopril 10 MG', rxcui: '29046' })
    expect(s.procedures[0].name).toBe('Appendectomy')
  })

  it('builds a prompt with the chosen items and none of the identifying details', () => {
    const s = summarizePatient(records, [])
    const rows = plans.slice(0, 2).map((plan) => ({
      plan,
      est: estimateYear(plan, usage),
      med: medicationCoverage(plan, s.medications, null),
      score: { total: 50 },
    }))
    const text = buildAdvisorPrompt({
      include: { conditions: ['Type 2 diabetes'], medications: [], procedures: [] },
      usage,
      rows,
      budget: 9000,
    })
    expect(text).toMatch(/Type 2 diabetes/)
    expect(text).toMatch(/Plan 2: /)
    expect(text).toMatch(/Possible future needs/)
    expect(text).toMatch(/\$9,000/)
    expect(text).not.toMatch(/Secretname|1980-01-01|Zed/)
    expect(text).not.toMatch(/Lisinopril/)
  })
})

describe('plans that keep drugs apart from medical care', () => {
  const list = (type, amount) => ({ type, amount, network_tier: 'In-Network', family_cost: 'Individual', individual: true })
  const base = {
    id: 'x',
    name: 'Split plan',
    premium: 100,
    benefits: [
      { name: 'Primary Care Visit to Treat an Injury or Illness', covered: true, cost_sharings: [{ network_tier: 'In-Network', copay_amount: 30, display_string: '$30 Copay' }] },
      { name: 'Generic Drugs', covered: true, cost_sharings: [{ network_tier: 'In-Network', copay_amount: 10, display_string: '$10 Copay after deductible' }] },
    ],
  }
  const combined = normalizePlan({
    ...base,
    deductibles: [list('Combined Medical and Drug EHB Deductible', 5000)],
    moops: [list('Maximum Out of Pocket for Medical and Drug EHB Benefits (Total)', 8000)],
  })
  const split = normalizePlan({
    ...base,
    deductibles: [list('Medical EHB Deductible', 5000), list('Drug EHB Deductible', 0)],
    moops: [list('Maximum Out of Pocket for Medical EHB Benefits', 7000), list('Maximum Out of Pocket for Drug EHB Benefits', 100)],
  })
  const use = { ...DEFAULT_USAGE, primaryCare: 3, specialist: 0, urgentCare: 0, genericDrugs: 24 }

  it('reads separate drug amounts only when the plan keeps them apart', () => {
    expect(combined.deductible).toBe(5000)
    expect(combined.drugDeductible).toBeNull()
    expect(combined.moop).toBe(8000)
    expect(combined.drugMoop).toBeNull()
    expect(split.deductible).toBe(5000)
    expect(split.drugDeductible).toBe(0)
    expect(split.moop).toBe(7000)
    expect(split.drugMoop).toBe(100)
  })

  it('does not run drugs through the medical deductible when they have their own', () => {
    const splitDeductibleOnly = normalizePlan({
      ...base,
      deductibles: [list('Medical EHB Deductible', 5000), list('Drug EHB Deductible', 0)],
      moops: [list('Maximum Out of Pocket for Medical and Drug EHB Benefits (Total)', 8000)],
    })
    // combined: 24 fills of $20 all go to the $5,000 deductible = $480, plus $90 of visits
    expect(estimateYear(combined, use).outOfPocket).toBe(570)
    // separate $0 drug deductible: 24 fills of a $10 copay = $240, plus $90 of visits
    expect(estimateYear(splitDeductibleOnly, use).outOfPocket).toBe(330)
  })

  it('caps drugs at the drug maximum and medical care at the medical maximum', () => {
    // drugs would cost $240 but the drug maximum is $100, plus $90 of visits
    expect(estimateYear(split, use).outOfPocket).toBe(190)
  })

  it('adds the two maximums for the coverage score', () => {
    expect(totalMoop(split)).toBe(7100)
    expect(totalMoop(combined)).toBe(8000)
    expect(totalMoop({ moop: null })).toBeNull()
  })

  it('shows both amounts in the summary for Claude', () => {
    const text = buildAdvisorPrompt({
      include: { conditions: [], medications: [], procedures: [] },
      usage: use,
      rows: [{ plan: split, est: estimateYear(split, use), med: { checked: false, covered: 0, total: 0, missing: [], unknown: [] }, score: { total: 50 } }],
      budget: null,
    })
    expect(text).toMatch(/\$5,000 medical \+ \$0 drugs \(kept separate\)/)
  })
})
