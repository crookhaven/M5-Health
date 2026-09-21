import { codeableConcept, coding } from '../piqi/attributeTypes'

// Extracts insurance claims (FHIR ExplanationOfBenefit, as returned by CMS Blue
// Button and CARIN BB) into the shape of the PIQI Patient EOB model,
// PAT_EOB_V1 (based on CPCDS):
//   https://github.com/piqiframework/reference_application/blob/main/PIQI_Engine.Server/ReferenceData/Models/PAT_EOB_V1.json
//
// Values are copied from the claim; nothing is invented. Where the source has
// no value the field is left out and the PIQI checks on it will fail honestly.
// Two values are derived rather than copied, and are marked below: the claim
// type (from the claim's declared C4BB profile) and the adjudication date.

const CLAIM_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/claim-type'
const CLAIM_USE_SYSTEM = 'http://hl7.org/fhir/claim-use'
const EOB_STATUS_SYSTEM = 'http://hl7.org/fhir/explanationofbenefit-status'
const NPI_SYSTEM = 'http://hl7.org/fhir/sid/us-npi'
const NDC_SYSTEM = 'http://hl7.org/fhir/sid/ndc'

function cc(concept) {
  if (!concept) return undefined
  const codings = (concept.coding ?? []).map((c) => coding({ code: c.code, display: c.display, system: c.system }))
  const text = concept.text ?? codings[0]?.display ?? codings[0]?.code
  if (!text && codings.length === 0) return undefined
  return codeableConcept({ text, codings })
}

function ccFromCode(system, code, display) {
  if (!code) return undefined
  return codeableConcept({ text: display ?? code, codings: [coding({ system, code, display: display ?? code })] })
}

function dateOnly(value) {
  return typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : value
}

function num(value) {
  return typeof value === 'number' ? value : undefined
}

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

function codeOf(concept) {
  return concept?.coding?.[0]?.code
}

function buildIndex(entries) {
  const byRef = new Map()
  for (const entry of entries) {
    const r = entry.resource
    if (!r?.resourceType) continue
    if (entry.fullUrl) byRef.set(entry.fullUrl, r)
    if (r.id) byRef.set(`${r.resourceType}/${r.id}`, r)
  }
  return byRef
}

function resolve(ref, eob, byRef) {
  const target = ref?.reference
  if (!target) return undefined
  if (target.startsWith('#')) return eob.contained?.find((c) => c.id === target.slice(1))
  return byRef.get(target) ?? byRef.get(target.split('/').slice(-2).join('/'))
}

function npiOf(resource) {
  const ids = resource?.identifier
  const list = Array.isArray(ids) ? ids : ids ? [ids] : []
  return (list.find((i) => i.system === NPI_SYSTEM) ?? list.find((i) => codeOf(i.type) === 'NPI'))?.value
}

// The C4BB profile a claim declares says what kind of claim it is.
function claimTypeFromProfile(eob) {
  const profile = (eob.meta?.profile ?? []).join(' ')
  if (/Inpatient-Institutional|Outpatient-Institutional/i.test(profile)) return 'institutional'
  if (/Pharmacy/i.test(profile)) return 'pharmacy'
  if (/Professional/i.test(profile)) return 'professional'
  if (/Oral/i.test(profile)) return 'oral'
  return undefined
}

function claimType(eob) {
  const declared = (eob.type?.coding ?? []).find((c) => c.system === CLAIM_TYPE_SYSTEM)
  if (declared) return cc(eob.type)
  const derived = claimTypeFromProfile(eob)
  if (!derived) return cc(eob.type)
  const original = (eob.type?.coding ?? []).map((c) => coding({ code: c.code, display: c.display, system: c.system }))
  const derivedCoding = coding({ system: CLAIM_TYPE_SYSTEM, code: derived, display: derived })
  return codeableConcept({ text: derived, codings: [derivedCoding, ...original] })
}

function supportingInfo(eob, categoryCode) {
  return (eob.supportingInfo ?? []).find((s) => codeOf(s.category) === categoryCode)
}

// Adjudication / total amounts are keyed by the category code from the C4BB
// adjudication value set. Other (Blue Button specific) categories are ignored.
const CLAIM_AMOUNT_FIELDS = {
  submitted: ['claimTotalSubmittedAmount', 'totalAmount'],
  eligible: ['claimTotalAllowedAmount'],
  paidtoprovider: ['claimAmountPaidToProvider'],
  paidtopatient: ['memberReimbursement'],
  paidbypatient: ['amountPaidByPatient'],
  deductible: ['memberPaidDeductible'],
  coinsurance: ['coInsuranceLiabilityAmount'],
  copay: ['copayAmount'],
  noncovered: ['claimNonCoveredAmount'],
  priorpayerpaid: ['claimOtherPayerPaidAmount'],
  discount: ['claimDiscountAmount'],
  memberliability: ['memberLiability'],
}

const LINE_AMOUNT_FIELDS = {
  submitted: 'lineSubmittedAmount',
  eligible: 'lineAllowedAmount',
  benefit: 'linePaymentAmount',
  paidtoprovider: 'lineAmountPaidToProvider',
  paidtopatient: 'lineMemberReimbursement',
  paidbypatient: 'lineAmountPaidByPatient',
  deductible: 'linePatientDeductible',
  coinsurance: 'lineCoinsuranceAmount',
  copay: 'lineCopayAmount',
  noncovered: 'lineNoncoveredAmount',
  priorpayerpaid: 'lineOtherPayerPaidAmount',
  discount: 'lineDiscountAmount',
  memberliability: 'lineMemberLiabilityAmount',
  drugcost: 'drugCost',
}

function applyAmounts(target, list, fieldsFor) {
  for (const a of list ?? []) {
    const key = codeOf(a.category)
    const fields = [].concat(fieldsFor[key] ?? [])
    for (const field of fields) {
      if (target[field] === undefined && num(a.amount?.value) !== undefined) target[field] = a.amount.value
    }
  }
}

function extractMedicalClaim(eob, byRef) {
  const start = eob.billablePeriod?.start
  const end = eob.billablePeriod?.end
  const admission = supportingInfo(eob, 'admissionperiod')?.timingPeriod
  const insurer = resolve(eob.insurer, eob, byRef)
  const identifier = eob.identifier?.[0]
  const firstTotal = eob.total?.[0]?.category
  const related = eob.related?.[0]
  const denial = (eob.adjudication ?? []).find((a) => codeOf(a.category) === 'denialreason')

  const claim = {
    claimIdentifierType: cc(identifier?.type),
    payerClaimUniqueIdentifier: identifier?.value ?? eob.id,
    processingStatusCode: ccFromCode(EOB_STATUS_SYSTEM, eob.status),
    claimTypeCode: claimType(eob),
    claimSubType: cc(eob.subType),
    claimUse: ccFromCode(CLAIM_USE_SYSTEM, eob.use),
    claimStartDate: start,
    statementFromDate: start,
    statementThruDate: end,
    claimServiceEndDate: end,
    admissionDate: admission?.start,
    dischargedate: admission?.end,
    claimReceivedDate: supportingInfo(eob, 'clmrecvddate')?.timingDate,
    // Derived: C4BB gives no separate adjudication date, so the date the
    // payer created the explanation of benefit is used.
    adjudicationDate: dateOnly(eob.created),
    claimPaidDate: eob.payment?.date,
    claimLastUpdateDate: eob.meta?.lastUpdated,
    billFacilityTypeCode: cc(supportingInfo(eob, 'typeofbill')?.code),
    frequencyCode: cc(supportingInfo(eob, 'typeofbill')?.code),
    inpatientAdmissionTypeCode: cc(supportingInfo(eob, 'admtype')?.code),
    inpatientSourceAdmissionCode: cc(supportingInfo(eob, 'pointoforigin')?.code),
    patientDischargeStatusCode: cc(supportingInfo(eob, 'discharge-status')?.code),
    claimDrgCode: cc(supportingInfo(eob, 'drg')?.code),
    claimPayeeTypeCode: cc(eob.payee?.type),
    claimPayee: eob.payee?.party?.display ?? eob.payee?.party?.identifier?.value ?? eob.payee?.party?.reference,
    claimPaymentAmount: num(eob.payment?.amount?.value),
    paymentDenialCode: cc(denial?.reason),
    adjudicationAmountType: cc(firstTotal),
    claimPayerIdentifier: insurer?.identifier?.[0]?.value,
    claimAdjustedfromIdentifier: related?.claim?.identifier?.value ?? related?.claim?.reference,
    claimAdjustedRelationship: cc(related?.relationship),
  }
  applyAmounts(claim, eob.total, CLAIM_AMOUNT_FIELDS)
  return clean(claim)
}

function extractProviders(eob, byRef) {
  const out = []
  const seen = new Set()
  function add(npi, role, name) {
    if (!npi && !name) return
    const key = `${npi}|${codeOf(role) ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(clean({ providerNpi: npi, careTeamRole: cc(role), providerName: name }))
  }
  for (const member of eob.careTeam ?? []) {
    const target = resolve(member.provider, eob, byRef)
    const npi = member.provider?.identifier?.value ?? npiOf(target) ?? member.provider?.reference
    add(npi, member.role, member.provider?.display)
  }
  const billing = resolve(eob.provider, eob, byRef)
  const billingNpi = npiOf(billing) ?? eob.provider?.identifier?.value
  if (billingNpi) add(billingNpi, { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claimcareteamrole', code: 'billing' }] })
  return out
}

function extractDiagnoses(eob) {
  return (eob.diagnosis ?? [])
    .map((dx) => {
      const type = dx.type?.[0]
      return clean({
        diagnosisCode: cc(dx.diagnosisCodeableConcept),
        diagnosisType: cc(type),
        presentOnAdmissionIndicator: dx.onAdmission?.coding?.[0]?.code,
        eCodeIndicator: codeOf(type) === 'externalcauseofinjury' ? 'true' : 'false',
      })
    })
    .filter((d) => d.diagnosisCode)
}

function extractProcedures(eob) {
  return (eob.procedure ?? [])
    .map((p) =>
      clean({
        procedureCode: cc(p.procedureCodeableConcept),
        procedureType: cc(p.type?.[0]),
        procedureDate: dateOnly(p.date),
      }),
    )
    .filter((p) => p.procedureCode)
}

function extractLines(eob) {
  return (eob.item ?? []).map((item) => {
    const product = item.productOrService
    const isNdc = product?.coding?.some((c) => c.system === NDC_SYSTEM)
    const line = {
      lineNumber: item.sequence,
      serviceDate: item.servicedDate ?? item.servicedPeriod?.start,
      serviceToDate: item.servicedPeriod?.end,
      revenueCenterCode: cc(item.revenue),
      typeOfService: cc(item.category),
      placeOfServiceCode: cc(item.locationCodeableConcept),
      lineProcedureCodeModifier: cc(item.modifier?.[0]),
    }
    if (isNdc) {
      line.nationalDrugCode = cc(product)
      line.quantityDispensed = num(item.quantity?.value)
      line.quantityQualifierCode = item.quantity?.unit ? ccFromCode(item.quantity.system, item.quantity.code ?? item.quantity.unit, item.quantity.unit) : undefined
    } else {
      line.lineProcedureCode = cc(product)
      line.allowedNumberOfUnits = num(item.quantity?.value)
    }
    applyAmounts(line, item.adjudication, LINE_AMOUNT_FIELDS)
    const status = (item.adjudication ?? []).find((a) => codeOf(a.category) === 'benefitpaymentstatus')
    line.benefitPaymentStatus = cc(status?.reason)
    const denial = (item.adjudication ?? []).find((a) => codeOf(a.category) === 'denialreason')
    line.linePaymentDenialCode = cc(denial?.reason)
    return clean(line)
  })
}

function extractMember(eobs, byRef) {
  const ref = eobs[0]?.patient?.reference
  const patient = (ref && (byRef.get(ref) ?? byRef.get(ref.split('/').slice(-2).join('/')))) ??
    [...byRef.values()].find((r) => r.resourceType === 'Patient')
  const address = patient?.address?.[0]
  const referenceId = ref?.split('/').pop()
  const gender = patient?.extension
    ?.find((e) => e.url?.endsWith('us-core-birthsex'))?.valueCode ?? patient?.gender
  const language = patient?.communication?.[0]?.language
  const member = {
    memberId: patient?.identifier?.[0]?.value ?? referenceId,
    memberIdentifierType: cc(patient?.identifier?.[0]?.type),
    dateOfBirth: patient?.birthDate,
    birthSex: gender ? ccFromCode('http://hl7.org/fhir/administrative-gender', gender) : undefined,
    streetAddress: address?.line?.join(' '),
    city: address?.city,
    state: address?.state,
    postalCode: address?.postalCode,
    country: address?.country,
    primaryLanguage: cc(language),
  }
  return clean(member)
}

function extractCoverage(eobs, byRef) {
  const found = new Map()
  for (const eob of eobs) {
    for (const ins of eob.insurance ?? []) {
      const name = ins.coverage?.display
      const resource = resolve(ins.coverage, eob, byRef)
      const key = name ?? resource?.id
      if (!key) continue
      const insurer = resolve(eob.insurer, eob, byRef)
      const start = eob.billablePeriod?.start
      const plan = resource?.class?.find((c) => codeOf(c.type) === 'plan')
      const group = resource?.class?.find((c) => codeOf(c.type) === 'group')
      const record = clean({
        planName: name ?? plan?.name,
        planIdentifier: plan?.value,
        groupId: group?.value,
        groupName: group?.name,
        coverageType: cc(resource?.type),
        coverageStatus: resource?.status ? ccFromCode('http://hl7.org/fhir/fm-status', resource.status) : undefined,
        subscriberId: resource?.subscriberId,
        relationshipToSubscriber: cc(resource?.relationship),
        startDate: resource?.period?.start ?? start,
        endDate: resource?.period?.end,
        claimPayerName: insurer?.name ?? eob.insurer?.display,
      })
      const existing = found.get(key)
      if (!existing) found.set(key, record)
      else if (start && (!existing.startDate || start < existing.startDate)) existing.startDate = start
    }
  }
  return [...found.values()]
}

export function claimLabel(claim) {
  const mc = claim.medicalClaim ?? {}
  const type = mc.claimTypeCode?.text ?? 'claim'
  const date = mc.claimStartDate ? ` ${mc.claimStartDate}` : ''
  return `${type}${date}`
}

// Returns { member, coverage, claims } or null when the bundle has no claims.
export function extractClaims(bundle) {
  const entries = bundle?.entry ?? (bundle?.resourceType ? [{ resource: bundle }] : [])
  const eobs = entries.map((e) => e.resource).filter((r) => r?.resourceType === 'ExplanationOfBenefit')
  if (eobs.length === 0) return null
  const byRef = buildIndex(entries)
  return {
    member: extractMember(eobs, byRef),
    coverage: extractCoverage(eobs, byRef),
    claims: eobs.map((eob) => ({
      id: eob.id,
      medicalClaim: extractMedicalClaim(eob, byRef),
      providers: extractProviders(eob, byRef),
      diagnoses: extractDiagnoses(eob),
      procedures: extractProcedures(eob),
      lines: extractLines(eob),
    })),
  }
}

// Combines claims from several imports. Claims are matched by id, so loading
// the same file twice does not duplicate them.
export function mergeClaimsData(existing, incoming) {
  if (!incoming) return existing ?? null
  if (!existing) return incoming
  const known = new Set(existing.claims.map((c) => c.id))
  const plans = new Set(existing.coverage.map((c) => c.planName))
  return {
    member: Object.keys(existing.member ?? {}).length ? existing.member : incoming.member,
    coverage: [...existing.coverage, ...incoming.coverage.filter((c) => !plans.has(c.planName))],
    claims: [...existing.claims, ...incoming.claims.filter((c) => !known.has(c.id))],
  }
}
