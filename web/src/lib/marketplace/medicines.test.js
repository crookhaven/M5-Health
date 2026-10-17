import { describe, expect, it } from 'vitest'
import { checkCoverageLive, fetchIngredients, groupMedicines, isVaccine, medicineStatuses, uncheckedRxcuis } from './medicines'
import { medicationCoverage } from './estimate'

const meds = [
  { id: '1', name: 'loratadine 10 MG Oral Tablet [Claritin]', rxcui: '311372' },
  { id: '2', name: 'loratadine 10 MG tablet', rxcui: '311371' },
  { id: '3', name: 'albuterol sulfate HFA 108 (90 Base) MCG/ACT inhaler', rxcui: '745679' },
  { id: '4', name: 'NDA020503 200 ACTUAT albuterol 0.09 MG/ACTUAT Metered Dose Inhaler', rxcui: '801092' },
  { id: '5', name: '0.5 ML influenza A virus A/Singapore/GP1908/2015 (H1N1) antigen 0.03 MG/ML Prefilled Syringe', rxcui: '1801446' },
  { id: '6', name: 'fluticasone 50 MCG/ACT nasal spray', rxcui: '896188' },
]

describe('grouping a medicine list for a plan check', () => {
  it('leaves out vaccines', () => {
    expect(isVaccine(meds[4].name)).toBe(true)
    expect(groupMedicines(meds).map((g) => g.ingredient)).not.toContain('influenza')
  })

  it('counts brand and generic, and two inhaler listings, once each', () => {
    const groups = groupMedicines(meds)
    expect(groups.map((g) => g.name)).toEqual([meds[0].name, meds[2].name, meds[5].name])
    expect(groups[0].rxcuis).toEqual(['311372', '311371'])
    expect(groups[1].rxcuis).toEqual(['745679', '801092'])
  })

  it('prefers RxNorm ingredients when it has them', () => {
    const groups = groupMedicines(
      [
        { id: 'a', name: 'Pulmicort Flexhaler 90 MCG/ACT inhaler', rxcui: 'p1' },
        { id: 'b', name: '60 ACTUAT budesonide 0.09 MG/ACTUAT Dry Powder Inhaler [Pulmicort]', rxcui: 'p2' },
      ],
      { p1: ['budesonide'], p2: ['budesonide'] },
    )
    expect(groups).toHaveLength(1)
  })

  it('reads ingredients from RxNav', async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ relatedGroup: { conceptGroup: [{ tty: 'IN', conceptProperties: [{ name: 'Budesonide' }] }, { tty: 'MIN' }] } }),
    })
    expect(await fetchIngredients(['p1'], fetchImpl)).toEqual({ p1: ['budesonide'] })
  })
})

describe('coverage of grouped medicines', () => {
  const groups = groupMedicines(meds)
  const coverage = { planA: { 311371: 'covered', 745679: 'not-covered', 801092: 'not-covered' } }

  it('counts a medicine covered if any of its RxCUIs is', () => {
    const c = medicationCoverage({ id: 'planA' }, groups, coverage)
    expect(c.covered).toBe(1)
    expect(c.missing).toEqual([meds[2].name])
    expect(c.unknown).toEqual([meds[5].name])
  })

  it('names what is covered, not covered and not yet checked', () => {
    expect(medicineStatuses('planA', groups, coverage).map((g) => g.status)).toEqual(['covered', 'not-covered', 'not-checked'])
    expect(uncheckedRxcuis(groups, coverage)).toEqual(['311372', '896188'])
  })

  it('asks the Marketplace API 20 plans at a time', async () => {
    const urls = []
    const fetchImpl = async (url) => {
      urls.push(new URL(url))
      return { ok: true, status: 200, json: async () => ({ coverage: [{ plan_id: 'x', rxcui: '1', coverage: 'Covered' }] }) }
    }
    const rows = await checkCoverageLive({ rxcuis: ['1', '2'], planIds: Array.from({ length: 25 }, (_, i) => `p${i}`), year: 2026, apiKey: 'k' }, fetchImpl)
    expect(urls).toHaveLength(2)
    expect(urls[0].searchParams.get('drugs')).toBe('1,2')
    expect(urls[1].searchParams.get('planids')).toBe('p20,p21,p22,p23,p24')
    expect(rows).toHaveLength(2)
  })
})
