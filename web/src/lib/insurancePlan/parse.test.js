import { describe, expect, it } from 'vitest'
import { InsurancePlanError, formatCost, formatLimit, parseInsurancePlan } from './parse'
import { answerExtraBenefit, EXTRA_BENEFITS } from './extraBenefits'

const SBC = 'http://hl7.org/fhir/us/insurance-card/CodeSystem/sbc-benefit-category'
const BPS = 'https://benefitplanstandard.org/fhir/StructureDefinition/'
const usd = (value) => ({ value, unit: 'USD', system: 'urn:iso:std:iso:4217', code: 'USD' })
const cat = (code, display) => ({ coding: [{ system: SBC, code, display }] })
const share = (fields) => ({
  url: `${BPS}bps-cost-share`,
  extension: Object.entries(fields).map(([url, v]) => ({ url, [typeof v === 'number' ? 'valueInteger' : 'valueString']: v })),
})
const unmapped = (key, name) => ({
  url: `${BPS}bps-unmapped-benefit`,
  extension: [
    { url: 'canonicalKey', valueString: key },
    { url: 'serviceName', valueString: name },
    { url: 'category', valueString: 'HEARING' },
  ],
})

// Trimmed from the Benefit Plan Standard's Aetna Medicare Select Extra (HMO-POS) example.
const maBundle = {
  resourceType: 'Bundle',
  type: 'collection',
  entry: [
    {
      resource: {
        resourceType: 'InsurancePlan',
        id: 'aetna-ma',
        name: 'Aetna Medicare Select Extra (HMO-POS)',
        period: { start: '2027', end: '2027' },
        identifier: [{ system: 'https://benefitplanstandard.org/fhir/identifier/cms_contract_plan_segment', value: 'H1609-028-000' }],
        ownedBy: { reference: 'urn:uuid:org1', display: 'Aetna Medicare' },
        extension: [
          {
            url: `${BPS}bps-plan-metadata`,
            extension: [
              { url: 'planYear', valueInteger: 2027 },
              { url: 'market', valueString: 'medicare_advantage' },
            ],
          },
          unmapped('hearing_aids', 'Prescription hearing aids (all types)'),
          unmapped('fitness_benefit', 'Fitness benefit'),
        ],
        coverage: [
          {
            type: cat('hospital-inpatient', 'Hospital Inpatient'),
            benefit: [{ type: { text: 'Inpatient hospital, acute' }, requirement: 'Authorization required (pbp_b1a_auth_yn "1").' }],
          },
        ],
        plan: [
          {
            generalCost: [{ type: { text: 'Individual out-of-pocket maximum, IN' }, cost: { value: 6750, currency: 'USD' } }],
            specificCost: [
              {
                category: cat('hospital-inpatient', 'Hospital Inpatient'),
                benefit: [
                  {
                    type: { text: 'Inpatient hospital, acute' },
                    cost: [
                      {
                        extension: [share({ tierId: 'IN', basis: 'per_day', unitRangeFrom: 1, unitRangeTo: 5 })],
                        type: { coding: [{ code: 'copay' }] },
                        applicability: { coding: [{ code: 'in-network' }] },
                        value: usd(375),
                      },
                      {
                        extension: [share({ tierId: 'POS' })],
                        type: { coding: [{ code: 'copaypct' }] },
                        applicability: { coding: [{ code: 'out-of-network' }] },
                        qualifiers: [{ text: 'Point-of-service option' }],
                        value: { value: 50, unit: '%', code: '%' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
}

describe('parseInsurancePlan', () => {
  it('reads a Medicare Advantage plan from a Bundle', () => {
    const p = parseInsurancePlan(maBundle)
    expect(p.name).toBe('Aetna Medicare Select Extra (HMO-POS)')
    expect(p.issuer).toBe('Aetna Medicare')
    expect(p.marketLabel).toBe('Medicare Advantage')
    expect(p.planYear).toBe(2027)
    expect(p.contractPlan).toBe('H1609-028-000')
    expect(p.general[0].amount).toBe(6750)
  })

  it('joins coverage rules with costs and formats them for a member', () => {
    const [inpatient] = parseInsurancePlan(maBundle).benefits
    expect(inpatient.requirement).toMatch(/Authorization required/)
    expect(inpatient.costs.map((c) => `${c.network}: ${formatCost(c)}`)).toEqual([
      'In network: $375 copay a day, days 1–5',
      'Point-of-service option: 50% coinsurance',
    ])
  })

  it('accepts JSON text with a byte order mark', () => {
    expect(parseInsurancePlan('﻿' + JSON.stringify(maBundle)).name).toMatch(/Aetna/)
  })

  it('rejects input with no InsurancePlan', () => {
    expect(() => parseInsurancePlan({ resourceType: 'Bundle', entry: [] })).toThrow(InsurancePlanError)
  })
})

describe('answerExtraBenefit', () => {
  const hearingAids = EXTRA_BENEFITS.find((x) => x.key === 'hearing_aids')

  it('says a benefit the plan only lists is listed, not covered or missing', () => {
    expect(answerExtraBenefit(parseInsurancePlan(maBundle), hearingAids).status).toBe('listed')
  })

  it('says not covered when the plan excludes it', () => {
    const plan = { ...parseInsurancePlan(maBundle), extras: [], excluded: ['Hearing aids'] }
    expect(answerExtraBenefit(plan, hearingAids).status).toBe('not-covered')
  })

  it('says not in the plan data when nothing mentions it', () => {
    const plan = { ...parseInsurancePlan(maBundle), extras: [] }
    expect(answerExtraBenefit(plan, hearingAids).status).toBe('not-in-data')
  })

  it('does not answer an adult question from a children-only benefit', () => {
    const plan = parseInsurancePlan(maBundle)
    plan.benefits.push({
      category: { code: 'children-eye-exam', display: 'Children Eye Exam' },
      name: "Children's eye exam",
      costs: [{ network: 'In network', kind: 'copay', amount: 0, unit: 'USD', absent: null }],
      limits: [],
    })
    const eye = EXTRA_BENEFITS.find((x) => x.key === 'routine_eye_exam')
    expect(answerExtraBenefit(plan, eye).status).toBe('not-in-data')
  })
})

describe('formatLimit', () => {
  it('names the period the plan gives', () => {
    expect(formatLimit({ amount: 1, unit: 'exams', period: 'per_6_months' })).toBe('1 exams per 6 months')
    expect(formatLimit({ amount: 35, unit: 'visits', period: 'Benefit Period' })).toBe('35 visits per benefit period')
  })
})
