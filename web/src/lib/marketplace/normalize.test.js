import { describe, it, expect } from 'vitest'
import sample from '../../data/sample_marketplace_plans.json'
import { costText, fixMojibake, normalizePlan, parsePlansFile } from './normalize'

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
