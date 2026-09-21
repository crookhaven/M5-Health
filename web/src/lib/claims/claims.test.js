import { describe, it, expect } from 'vitest'
import { extractClaims, mergeClaimsData } from './extract'
import { buildClaimsPiqiMessage } from './message'
import { displayText } from '../piqi/attributeTypes'
import { parseGatewayResult, linkChecksToRecords } from '../piqi/gatewayResult'
import { guidanceForCheck, checkTitle } from '../piqi/checkGuidance'

const coding = (system, code, display) => ({ system, code, display })

function eob(id, overrides = {}) {
  return {
    resourceType: 'ExplanationOfBenefit',
    id,
    status: 'active',
    use: 'claim',
    meta: {
      lastUpdated: '2026-03-05T22:02:47.312+00:00',
      profile: ['http://hl7.org/fhir/us/carin-bb/StructureDefinition/C4BB-ExplanationOfBenefit-Inpatient-Institutional|2.2.0'],
    },
    type: { coding: [coding('https://bluebutton.cms.gov/fhir/CodeSystem/CLM-TYPE-CD', '60')] },
    identifier: [{ type: { coding: [coding('http://hl7.org/fhir/us/carin-bb/CodeSystem/C4BBIdentifierType', 'uc', 'Unique Claim ID')] }, value: `claim-${id}` }],
    patient: { reference: 'Patient/123' },
    created: '2026-03-05T00:00:00+00:00',
    billablePeriod: { start: '2021-07-14', end: '2021-07-30' },
    insurance: [{ focal: true, coverage: { display: 'Part A' } }],
    contained: [{ resourceType: 'Practitioner', id: 'prac', identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1093792350' }] }],
    provider: { reference: '#prac' },
    careTeam: [{ sequence: 1, provider: { identifier: { system: 'http://hl7.org/fhir/sid/us-npi', value: '1548226988' } }, role: { coding: [coding('http://terminology.hl7.org/CodeSystem/claimcareteamrole', 'rendering')] } }],
    supportingInfo: [
      { category: { coding: [coding('x', 'clmrecvddate')] }, timingDate: '2021-07-30' },
      { category: { coding: [coding('x', 'typeofbill')] }, code: { coding: [coding('https://www.nubc.org/CodeSystem/TypeOfBill', '111')] } },
    ],
    diagnosis: [
      { sequence: 1, diagnosisCodeableConcept: { coding: [coding('http://hl7.org/fhir/sid/icd-10-cm', 'E11.9')] }, type: [{ coding: [coding('x', 'principal')] }], onAdmission: { coding: [coding('x', 'Y')] } },
      { sequence: 2, diagnosisCodeableConcept: { coding: [coding('http://hl7.org/fhir/sid/icd-10-cm', 'W55.29')] }, type: [{ coding: [coding('x', 'externalcauseofinjury')] }] },
    ],
    procedure: [{ date: '2021-07-22', type: [{ coding: [coding('x', 'principal')] }], procedureCodeableConcept: { coding: [coding('http://www.cms.gov/Medicare/Coding/ICD10', '5A1D70Z')] } }],
    item: [
      {
        sequence: 1,
        revenue: { coding: [coding('x', '0349')] },
        productOrService: { coding: [coding('http://www.ama-assn.org/go/cpt', '99213')] },
        servicedPeriod: { start: '2021-07-14', end: '2021-07-15' },
        quantity: { value: 2 },
        adjudication: [{ category: { coding: [coding('x', 'submitted')] }, amount: { value: 100 } }, { category: { coding: [coding('x', 'CLM_LINE_OTHER')] }, amount: { value: 5 } }],
      },
      {
        sequence: 2,
        productOrService: { coding: [coding('http://hl7.org/fhir/sid/ndc', '00264180032')] },
        servicedDate: '2021-07-14',
        quantity: { value: 6, unit: 'ML' },
      },
    ],
    total: [
      { category: { coding: [coding('x', 'submitted')] }, amount: { value: 461995.16 } },
      { category: { coding: [coding('x', 'paidbypatient')] }, amount: { value: 12 } },
    ],
    payment: { amount: { value: 5792.1 } },
    ...overrides,
  }
}

const bundle = { resourceType: 'Bundle', entry: [{ resource: eob('a') }, { resource: eob('b', { billablePeriod: { start: '2022-01-01' } }) }] }

describe('extractClaims', () => {
  it('returns null when the bundle has no claims', () => {
    expect(extractClaims({ resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Patient' } }] })).toBe(null)
  })

  it('reads the claim header, amounts and dates', () => {
    const { claims } = extractClaims(bundle)
    const mc = claims[0].medicalClaim
    expect(mc.payerClaimUniqueIdentifier).toBe('claim-a')
    expect(mc.statementFromDate).toBe('2021-07-14')
    expect(mc.claimReceivedDate).toBe('2021-07-30')
    expect(mc.claimTotalSubmittedAmount).toBe(461995.16)
    expect(mc.amountPaidByPatient).toBe(12)
    expect(mc.claimPaymentAmount).toBe(5792.1)
    expect(displayText(mc.billFacilityTypeCode)).toBe('111')
  })

  it('derives an institutional claim type from the declared C4BB profile and keeps the original code', () => {
    const type = extractClaims(bundle).claims[0].medicalClaim.claimTypeCode
    expect(displayText(type)).toBe('institutional')
    expect(type.codings.map((c) => c.code)).toEqual(['institutional', '60'])
  })

  it('reads diagnoses, procedures and providers', () => {
    const [claim] = extractClaims(bundle).claims
    expect(claim.diagnoses.map((d) => displayText(d.diagnosisCode))).toEqual(['E11.9', 'W55.29'])
    expect(claim.diagnoses[1].eCodeIndicator).toBe('true')
    expect(claim.diagnoses[0].presentOnAdmissionIndicator).toBe('Y')
    expect(displayText(claim.procedures[0].procedureCode)).toBe('5A1D70Z')
    expect(claim.providers.map((p) => p.providerNpi).sort()).toEqual(['1093792350', '1548226988'])
  })

  it('splits service lines into procedure lines and drug lines, ignoring unknown categories', () => {
    const [line, drug] = extractClaims(bundle).claims[0].lines
    expect(displayText(line.lineProcedureCode)).toBe('99213')
    expect(line.allowedNumberOfUnits).toBe(2)
    expect(line.lineSubmittedAmount).toBe(100)
    expect(Object.keys(line).some((k) => /OTHER/i.test(k))).toBe(false)
    expect(displayText(drug.nationalDrugCode)).toBe('00264180032')
    expect(drug.quantityDispensed).toBe(6)
    expect(drug.allowedNumberOfUnits).toBe(undefined)
  })

  it('uses the patient reference as the member id when no Patient resource is present', () => {
    expect(extractClaims(bundle).member.memberId).toBe('123')
  })

  it('does not duplicate claims or plans when merged twice', () => {
    const once = extractClaims(bundle)
    const merged = mergeClaimsData(once, extractClaims(bundle))
    expect(merged.claims).toHaveLength(2)
    expect(merged.coverage).toHaveLength(1)
  })
})

describe('buildClaimsPiqiMessage', () => {
  const message = buildClaimsPiqiMessage(extractClaims(bundle))

  it('targets the claims model and lists each class', () => {
    expect(message.model).toBe('PAT_EOB_V1')
    expect(message.patient.medicalClaim).toHaveLength(2)
    expect(message.patient.claimDiagnosis).toHaveLength(4)
    expect(message.patient.claimServiceLine).toHaveLength(4)
    expect(message.patient.member.memberId).toBe('123')
  })

  it('lists each provider once', () => {
    expect(message.patient.provider).toHaveLength(2)
  })

  it('includes every model field, null when empty, and wraps coded fields', () => {
    const mc = message.patient.medicalClaim[0]
    expect(mc.claimDrgCode).toEqual({ text: null, codings: [] })
    expect(mc.claimDrgVersion).toBe(null)
    expect(mc.claimTypeCode.text).toBe('institutional')
    expect(mc.claimTotalSubmittedAmount).toBe(461995.16)
  })
})

describe('claims results from the Gateway', () => {
  const attr = (name, items) => ({ attributeName: name, attributeAudit: { assessmentItems: items } })
  const failed = (assessment) => ({ attributeMnemonic: 'x', assessment, status: 'Failed', reason: 'r' })
  const result = {
    scoringData: { evaluationRubric: 'Claims rubric', messageResults: { numerator: 5, denominator: 9, piqiScore: 55 } },
    auditedMessage: {
      root: {
        classes: [
          { className: 'Medical Claim', elements: [{ attributes: [attr('payerClaimUniqueIdentifier', [{ status: 'Passed' }]), attr('claimPaidDate', [failed('paid date is valid date')]), attr('claimTypeCode', [failed("medical claim type is 'institutional'")])] }] },
          { className: 'Coverage', elements: [{ attributes: [attr('planName', [failed('plan identifier is populated')])] }] },
        ],
      },
    },
  }

  it('recognises a claims result and keeps its checks out of the clinical records', () => {
    const parsed = parseGatewayResult(result)
    expect(parsed.checks.every((c) => c.claims)).toBe(true)
    expect(parsed.checks.map((c) => c.domain)).toEqual(['medicalClaim', 'medicalClaim', 'coverage'])
    const linked = linkChecksToRecords(parsed, [{ id: 'r1', domain: 'coverage', data: {} }], [])
    expect(linked.checks.every((c) => c.recordId === null)).toBe(true)
  })

  it('routes claims checks to the health plan and labels their fields', () => {
    const parsed = parseGatewayResult(result)
    const paid = parsed.checks[0]
    const g = guidanceForCheck(paid)
    expect(g.route).toBe('provider')
    expect(g.nextStep).toMatch(/health plan/)
    expect(checkTitle(paid)).toMatch(/Claim Paid Date|Paid Date/i)
    expect(guidanceForCheck(parsed.checks[1]).technical).toBe(false)
    const codeList = { ...paid, assessment: 'medical claim status is valid value' }
    expect(guidanceForCheck(codeList).technical).toBe(true)
  })
})
