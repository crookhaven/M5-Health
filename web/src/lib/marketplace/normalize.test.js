import { describe, it, expect } from 'vitest'
import sample from '../../data/sample_marketplace_plans.json'
import { costText, fixMojibake, normalizePlan, parsePlansFile, safeUrl } from './normalize'

describe('costText', () => {
  it('words copays and coinsurance', () => {
    expect(costText({ copay_amount: 30 })).toBe('$30 copay')
    expect(costText({ copay_amount: 0 })).toBe('No charge')
    expect(costText({ coinsurance_rate: 0.2, coinsurance_options: 'After deductible' })).toBe(
      '20% coinsurance after deductible',
    )
    expect(costText({ coinsurance_rate: 20 })).toBe('20% coinsurance')
  })

  it('prefers the API display string and copes with nothing', () => {
    expect(costText({ display_string: '$10 Copay', copay_amount: 99 })).toBe('$10 Copay')
    expect(costText({})).toBeNull()
    expect(costText(undefined)).toBeNull()
  })
})

describe('normalizePlan', () => {
  it('flattens the fields the comparison shows', () => {
    const p = normalizePlan(sample.plans[1])
    expect(p.name).toBe('Sample Silver Balanced')
    expect(p.metalLevel).toBe('Silver')
    expect(p.premium).toBe(428.9)
    expect(p.deductible).toBe(4200)
    expect(p.moop).toBe(8700)
    expect(p.benefits.primaryCare).toBe('$30 copay')
    expect(p.benefits.emergency).toBe('30% coinsurance after deductible')
    expect(p.qualityRating).toBe(4)
  })

  it('uses the individual in-network deductible, not the family one', () => {
    expect(normalizePlan(sample.plans[0]).deductible).toBe(7500)
  })

  it('reports a missing benefit as null and a non-covered benefit as Not covered', () => {
    const p = normalizePlan({
      name: 'Bare plan',
      benefits: [{ name: 'Specialist Visit', covered: false }],
    })
    expect(p.benefits.primaryCare).toBeNull()
    expect(p.benefits.specialist).toBe('Not covered')
    expect(p.premium).toBeNull()
    expect(p.deductible).toBeNull()
    expect(p.id).toBe('Bare plan')
  })
})

describe('parsePlansFile', () => {
  it('reads an API result and a bare array', () => {
    expect(parsePlansFile(JSON.stringify(sample)).plans).toHaveLength(4)
    expect(parsePlansFile(JSON.stringify(sample.plans)).plans).toHaveLength(4)
  })

  it('carries the household label from the sample file', () => {
    expect(parsePlansFile(JSON.stringify(sample)).household.label).toBe('Synthetic demo household')
  })

  it('rejects bad input with a clear message', () => {
    expect(() => parsePlansFile('nope')).toThrow(/not valid JSON/)
    expect(() => parsePlansFile('{"plans": []}')).toThrow(/No plans found/)
    expect(() => parsePlansFile('{}')).toThrow(/No plans found/)
  })
})

describe('fixMojibake', () => {
  it('repairs text that was decoded as Latin-1 and leaves normal text alone', () => {
    expect(fixMojibake('Blue Cross\u00C2\u00AE Local HMO')).toBe('Blue Cross\u00AE Local HMO')
    expect(fixMojibake('Blue Cross Local HMO')).toBe('Blue Cross Local HMO')
    expect(fixMojibake('Caf\u00C3\u00A9')).toBe('Caf\u00E9')
    expect(fixMojibake(undefined)).toBeUndefined()
  })

  it('is applied to plan and insurer names', () => {
    const p = normalizePlan({ name: 'Blue Cross\u00C2\u00AE Local', issuer: { name: 'Acme\u00C2\u00AE' } })
    expect(p.name).toBe('Blue Cross\u00AE Local')
    expect(p.issuer).toBe('Acme\u00AE')
  })

  it('reads a file that starts with a byte-order mark', () => {
    const text = '\uFEFF' + JSON.stringify({ plans: [{ name: 'A' }] })
    expect(parsePlansFile(text).plans).toHaveLength(1)
  })
})

describe('SBC links and examples', () => {
  const base = { id: '11111MI0010001', name: 'Plan One' }
  const file = {
    '11111MI0010001': {
      url: 'https://example.org/sbc.pdf',
      examples: {
        baby: { deductible: '$1,500.00', copayment: '$40.00', coinsurance: '$200.00', limit: '$0.00' },
        diabetes: { deductible: 'Not Applicable' },
      },
    },
  }

  it('only accepts web links', () => {
    expect(safeUrl('https://example.org/a')).toBe('https://example.org/a')
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('')).toBeNull()
    expect(safeUrl(undefined)).toBeNull()
    expect(normalizePlan({ ...base, brochure_url: 'javascript:alert(1)' }).links.brochure).toBeNull()
  })

  it('reads the SBC link and adds up the example cost from the CMS file', () => {
    const p = normalizePlan(base, file)
    expect(p.sbc.url).toBe('https://example.org/sbc.pdf')
    expect(p.sbc.examples.baby).toBe(1740)
    expect(p.sbc.examples.diabetes).toBeNull()
    expect(p.sbc.examples.simplefracture).toBeNull()
  })

  it('matches on the 14-character plan id when the file is keyed that way', () => {
    const p = normalizePlan({ ...base, id: '11111MI0010001-00' }, file)
    expect(p.sbc.url).toBe('https://example.org/sbc.pdf')
  })

  it('prefers the API sbcs numbers when the plan has them', () => {
    const plan = {
      ...base,
      sbcs: { baby: { deductible: { amount: 1000 }, copay: { amount: 100 }, coinsurance: { amount: 50 }, limit: { amount: 0 } } },
    }
    expect(normalizePlan(plan, file).sbc.examples.baby).toBe(1150)
  })

  it('shows nothing rather than guessing when there is no SBC information', () => {
    const p = normalizePlan(base)
    expect(p.sbc.url).toBeNull()
    expect(p.sbc.examples.baby).toBeNull()
  })

  it('passes the _sbc block through parsePlansFile', () => {
    const parsed = parsePlansFile(JSON.stringify({ plans: [base], _sbc: file }))
    expect(parsed.plans[0].sbc.url).toBe('https://example.org/sbc.pdf')
  })
})

describe('separate drug deductible and out-of-pocket maximum', () => {
  it('leaves the sample plans (combined amounts) unchanged', () => {
    const p = normalizePlan(sample.plans[0])
    expect(p.drugDeductible).toBeNull()
    expect(p.drugMoop).toBeNull()
    expect(typeof p.deductible).toBe('number')
    expect(typeof p.moop).toBe('number')
  })
})
