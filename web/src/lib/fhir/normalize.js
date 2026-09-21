import { codeableConcept, coding, observationValue, rangeValue } from '../piqi/attributeTypes'

function ccFromConcept(concept) {
  if (!concept) return undefined
  return codeableConcept({
    text: concept.text,
    codings: (concept.coding ?? []).map((c) => coding({ code: c.code, display: c.display, system: c.system })),
  })
}

function ccFromText(text) {
  if (!text) return undefined
  return codeableConcept({ text })
}

// A quantity's unit as a coded concept when the source gives a unit code and
// system (usually UCUM), otherwise as plain text.
function unitConcept(quantity) {
  const text = quantity?.unit ?? quantity?.code
  if (!text) return undefined
  if (quantity.code && quantity.system) {
    return codeableConcept({
      text,
      codings: [coding({ system: quantity.system, code: quantity.code, display: quantity.unit })],
    })
  }
  return ccFromText(text)
}

function humanName(name) {
  if (!name) return {}
  return {
    firstName: name.given?.[0],
    middleName: name.given?.length > 1 ? name.given.slice(1).join(' ') : undefined,
    lastName: name.family,
  }
}

const US_CORE_EXTENSION_BASE = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-'

// US Core's race/ethnicity extensions carry an OMB category coding plus a
// free-text summary as sub-extensions, rather than a plain CodeableConcept --
// https://hl7.org/fhir/us/core/StructureDefinition-us-core-race.html
function usCoreCategoryConcept(resource, extensionName) {
  const ext = resource.extension?.find((e) => e.url === `${US_CORE_EXTENSION_BASE}${extensionName}`)
  if (!ext) return undefined
  const ombCoding = ext.extension?.find((e) => e.url === 'ombCategory')?.valueCoding
  const text = ext.extension?.find((e) => e.url === 'text')?.valueString
  if (!ombCoding && !text) return undefined
  return codeableConcept({
    text,
    codings: ombCoding ? [coding({ code: ombCoding.code, display: ombCoding.display, system: ombCoding.system })] : [],
  })
}

// US Core birth sex is a fixed-code extension (M/F/UNK), distinct from the
// base FHIR `gender` administrative field -- prefer it when present.
function usCoreBirthSex(resource) {
  const code = resource.extension?.find((e) => e.url === `${US_CORE_EXTENSION_BASE}birthsex`)?.valueCode
  if (!code) return undefined
  const display = { M: 'Male', F: 'Female', UNK: 'Unknown' }[code] ?? code
  return codeableConcept({
    text: display,
    codings: [coding({ code, display, system: 'http://hl7.org/fhir/administrative-gender' })],
  })
}

function normalizePatient(resource) {
  const name = humanName(resource.name?.[0])
  const address = resource.address?.[0]
  const addressText = address
    ? [address.line?.join(' '), address.city, address.state, address.postalCode].filter(Boolean).join(', ')
    : undefined
  return {
    domain: 'demographics',
    data: {
      firstName: name.firstName,
      middleName: name.middleName,
      lastName: name.lastName,
      birthDate: resource.birthDate,
      birthSex: usCoreBirthSex(resource) ?? ccFromText(resource.gender),
      race: usCoreCategoryConcept(resource, 'race'),
      ethnicity: usCoreCategoryConcept(resource, 'ethnicity'),
      deceased:
        resource.deceasedBoolean !== undefined
          ? ccFromText(resource.deceasedBoolean ? 'Yes' : 'No')
          : undefined,
      deathDate: resource.deceasedDateTime,
      maritalStatus: ccFromConcept(resource.maritalStatus),
      primaryLanguage: ccFromConcept(resource.communication?.[0]?.language),
      patientIdentifier: resource.identifier?.[0]?.value,
      currentAddress: addressText,
      emailAddress: resource.telecom?.find((t) => t.system === 'email')?.value,
      // PIQI: "telephone or other telecommunication contact information".
      // Email has its own attribute, so use a phone first, then any other kind.
      telecom: (
        resource.telecom?.find((t) => t.system === 'phone') ??
        resource.telecom?.find((t) => t.system && t.system !== 'email' && t.value)
      )?.value,
    },
  }
}

// Finds the resource a FHIR reference points at inside the same Bundle, by
// fullUrl ("urn:uuid:...") or "Type/id". IPS documents keep the medicine in a
// separate Medication resource that MedicationStatement/Request point to.
function resolveReference(reference, ctx) {
  const ref = reference?.reference
  if (!ref || !ctx?.byRef) return undefined
  return ctx.byRef.get(ref) ?? ctx.byRef.get(ref.split('/').slice(-2).join('/'))
}

function medicationConcept(resource, ctx) {
  if (resource.medicationCodeableConcept) return ccFromConcept(resource.medicationCodeableConcept)
  const ref = resource.medicationReference
  const target = resolveReference(ref, ctx)
  if (target?.code) return ccFromConcept(target.code)
  // Unresolvable reference: the display text is still better than nothing.
  return ref?.display ? ccFromText(ref.display) : undefined
}

function normalizeMedication(resource, ctx) {
  // MedicationRequest calls it dosageInstruction; MedicationStatement (what an
  // IPS uses) calls it dosage.
  const dosage = (resource.dosageInstruction ?? resource.dosage)?.[0]
  const doseQty = dosage?.doseAndRate?.[0]?.doseQuantity
  const dispenseQty = resource.dispenseRequest?.quantity
  const period = dosage?.timing?.repeat?.boundsPeriod
  return {
    domain: 'medications',
    data: {
      medication: medicationConcept(resource, ctx),
      doseAmount: doseQty?.value !== undefined ? String(doseQty.value) : undefined,
      doseAmountUnit: unitConcept(doseQty),
      doseRoute: ccFromConcept(dosage?.route),
      doseQuantity: dispenseQty?.value !== undefined ? String(dispenseQty.value) : undefined,
      doseQuantityUnit: unitConcept(dispenseQty),
      instructions: dosage?.text,
      indication: ccFromConcept(resource.reasonCode?.[0]),
      startDate:
        period?.start ??
        resource.effectivePeriod?.start ??
        resource.effectiveDateTime ??
        resource.authoredOn ??
        resource.dateAsserted,
      endDate: period?.end ?? resource.effectivePeriod?.end,
      statementDate: resource.authoredOn ?? resource.effectiveDateTime ?? resource.dateAsserted,
      requestStatus: ccFromText(resource.status),
      medicationCategory: ccFromConcept(resource.category?.[0]),
      medicationIntent: ccFromText(resource.intent),
    },
  }
}

function normalizeAllergy(resource) {
  const reaction = resource.reaction?.[0]
  return {
    domain: 'allergies',
    data: {
      substance: ccFromConcept(resource.code),
      category: resource.category?.[0] ? ccFromText(resource.category[0]) : undefined,
      reaction: ccFromConcept(reaction?.manifestation?.[0]),
      severity: reaction?.severity ? ccFromText(reaction.severity) : undefined,
      effectiveDate: resource.onsetDateTime ?? resource.recordedDate,
      clinicalStatus: ccFromConcept(resource.clinicalStatus),
      verificationStatus: ccFromConcept(resource.verificationStatus),
    },
  }
}

function normalizeCondition(resource) {
  return {
    domain: 'conditions',
    data: {
      condition: ccFromConcept(resource.code),
      onsetDate: resource.onsetDateTime,
      conditionStatus: ccFromConcept(resource.clinicalStatus),
      resolutionDate: resource.abatementDateTime,
      clinicalStatus: ccFromConcept(resource.clinicalStatus),
      verificationStatus: ccFromConcept(resource.verificationStatus),
      conditionCategory: ccFromConcept(resource.category?.[0]),
      assertedDate: resource.recordedDate,
      recordedDate: resource.recordedDate,
    },
  }
}

function isCategory(resource, code) {
  return resource.category?.some((c) => c.coding?.some((coded) => coded.code === code))
}

// Works for either an Observation resource or one of its `component` entries
// -- both carry value[x]/referenceRange directly per the FHIR spec.
function normalizeObservationValue(source) {
  if (source.valueQuantity) {
    return observationValue({
      number: source.valueQuantity.value,
      text: source.valueQuantity.unit ? undefined : String(source.valueQuantity.value),
    })
  }
  if (source.valueString) return observationValue({ text: source.valueString })
  if (source.valueCodeableConcept) {
    return observationValue({ text: source.valueCodeableConcept.text, type: ccFromConcept(source.valueCodeableConcept) })
  }
  return undefined
}

function hasDirectValue(source) {
  return (
    source.valueQuantity !== undefined ||
    source.valueString !== undefined ||
    source.valueCodeableConcept !== undefined
  )
}

// Panel-style Observations (blood pressure, multi-question survey
// instruments like PRAPARE) carry their real values in `component`, not on
// the resource itself. Real-world PIQI converters emit one record per
// component in that case, rather than one for the whole panel --
// confirmed by comparing against navapbc/piqi-data's reference conversion
// of Synthea output, where vitalSigns/healthAssessments counts only
// matched ours once component expansion was added.
function observationValueSources(resource) {
  const sources = []
  if (hasDirectValue(resource) || !resource.component?.length) {
    sources.push({ code: resource.code, valueSource: resource })
  }
  for (const component of resource.component ?? []) {
    sources.push({ code: component.code, valueSource: component })
  }
  return sources
}

function normalizeReferenceRange(resource) {
  const range = resource.referenceRange?.[0]
  if (!range) return undefined
  return rangeValue({
    text: range.text,
    lowValue: range.low?.value !== undefined ? String(range.low.value) : undefined,
    highValue: range.high?.value !== undefined ? String(range.high.value) : undefined,
  })
}

function normalizeLabResult(resource) {
  return {
    domain: 'labResults',
    data: {
      order: ccFromConcept(resource.basedOn?.[0]?.display ? { text: resource.basedOn[0].display } : undefined),
      test: ccFromConcept(resource.code),
      resultUnit: unitConcept(resource.valueQuantity),
      resultValue: normalizeObservationValue(resource),
      interpretation: ccFromConcept(resource.interpretation?.[0]),
      specimenType: ccFromConcept(resource.specimen?.display ? { text: resource.specimen.display } : undefined),
      resultStatus: ccFromText(resource.status),
      performedDateTime: resource.effectiveDateTime,
      issuedDateTime: resource.issued,
      referenceRange: normalizeReferenceRange(resource),
      orderDate: resource.issued,
      labCategory: ccFromConcept(resource.category?.[0]),
    },
  }
}

function normalizeVitalSign(resource) {
  return observationValueSources(resource).map(({ code, valueSource }) => ({
    domain: 'vitalSigns',
    data: {
      vitalSign: ccFromConcept(code),
      resultValue: normalizeObservationValue(valueSource),
      resultUnit: unitConcept(valueSource.valueQuantity),
      interpretation: ccFromConcept(resource.interpretation?.[0]),
      resultStatus: ccFromText(resource.status),
      performedDateTime: resource.effectiveDateTime,
      referenceRange: normalizeReferenceRange(valueSource),
      vitalSignCategory: ccFromConcept(resource.category?.[0]),
    },
  }))
}

function normalizeHealthAssessment(resource) {
  return observationValueSources(resource).map(({ code, valueSource }) => ({
    domain: 'healthAssessments',
    data: {
      assessment: ccFromConcept(code),
      assessmentStatus: ccFromText(resource.status),
      resultValue: normalizeObservationValue(valueSource),
      resultUnit: unitConcept(valueSource.valueQuantity),
      effectiveDate: resource.effectiveDateTime,
      category: ccFromConcept(resource.category?.[0]),
    },
  }))
}

function normalizeObservation(resource) {
  if (isCategory(resource, 'laboratory')) return normalizeLabResult(resource)
  if (isCategory(resource, 'vital-signs')) return normalizeVitalSign(resource)
  if (isCategory(resource, 'social-history') || isCategory(resource, 'survey')) {
    return normalizeHealthAssessment(resource)
  }
  return null
}

function normalizeImmunization(resource) {
  return {
    domain: 'immunizations',
    data: {
      administrationDate: resource.occurrenceDateTime,
      immunization: ccFromConcept(resource.vaccineCode),
      lotNumber: resource.lotNumber,
      expirationDate: resource.expirationDate,
      immunizationStatus: ccFromText(resource.status),
      immunizationStatusReason: ccFromConcept(resource.statusReason),
      primarySource: resource.primarySource !== undefined ? String(resource.primarySource) : undefined,
    },
  }
}

function normalizeProcedure(resource) {
  const dateTime = resource.performedDateTime ?? resource.performedPeriod?.start
  return {
    domain: 'procedures',
    data: {
      procedureDateTime: dateTime,
      procedure: ccFromConcept(resource.code),
      procedureReason: ccFromConcept(resource.reasonCode?.[0]),
      procedureStatus: ccFromText(resource.status),
      procedurePerformedDate: dateTime,
    },
  }
}

function normalizeDevice(resource) {
  const udi = resource.udiCarrier?.[0]
  return {
    domain: 'medicalDevices',
    data: {
      deviceID: udi?.deviceIdentifier,
      deviceType: ccFromConcept(resource.type),
      deviceStatus: ccFromText(resource.status),
      serialNumber: resource.serialNumber ?? resource.identifier?.[0]?.value,
      lotNumber: resource.lotNumber,
      expirationDate: resource.expirationDate,
      manufactureDate: resource.manufactureDate,
      carrierHRF: udi?.carrierHRF,
      distinctIdentifier: udi?.distinctIdentifier,
    },
  }
}

function normalizeCoverage(resource) {
  return {
    domain: 'coverage',
    data: {
      plan_name: resource.class?.find((c) => c.type?.coding?.[0]?.code === 'plan')?.name ?? 'Coverage',
      group_name: resource.payor?.[0]?.display,
      type: resource.type ? resource.type.text ?? resource.type.coding?.[0]?.display : undefined,
      effective_date: resource.period?.start,
    },
  }
}

// --- CMS Blue Button / CARIN BB ExplanationOfBenefit (claims) ---------------
//
// Claims are billing records, not clinical records, so this is a deliberately
// modest mapping. Diagnoses, procedures and pharmacy fills become the nearest
// PIQI data class. Nothing is invented: claims carry no clinical status, no
// dose and no medication name, so those fields stay empty and the PIQI checks
// on them will honestly fail. Codes repeat across claims, so each distinct code
// is kept once, dated by the earliest claim it appears on.

const NDC = 'http://hl7.org/fhir/sid/ndc'
const PROCEDURE_ITEM_SYSTEMS = ['http://www.ama-assn.org/go/cpt', 'HCPCSReleaseCodeSets']

function claimStart(resource) {
  return resource.billablePeriod?.start ?? resource.created?.slice(0, 10)
}

// Adds `record` unless the same key was already seen; if it was, keeps the
// earlier of the two dates on the record that is already in the results.
function addOnce(ctx, out, key, record, dateField, date) {
  const seen = ctx?.seen
  const existing = seen?.get(key)
  if (existing) {
    const current = existing.data[dateField]
    if (date && (!current || date < current)) existing.data[dateField] = date
    return
  }
  seen?.set(key, record)
  out.push(record)
}

function firstCode(concept) {
  const c = concept?.coding?.[0]
  return c ? `${c.system ?? ''}|${c.code ?? ''}` : undefined
}

function normalizeExplanationOfBenefit(resource, ctx) {
  const out = []
  const start = claimStart(resource)

  for (const dx of resource.diagnosis ?? []) {
    const concept = dx.diagnosisCodeableConcept
    const key = firstCode(concept)
    if (!key) continue
    const record = {
      domain: 'conditions',
      data: {
        condition: ccFromConcept(concept),
        recordedDate: start,
        conditionCategory: ccFromText('Claim diagnosis'),
      },
    }
    addOnce(ctx, out, `dx:${key}`, record, 'recordedDate', start)
  }

  for (const proc of resource.procedure ?? []) {
    const concept = proc.procedureCodeableConcept
    const key = firstCode(concept)
    if (!key) continue
    const date = proc.date ?? start
    const record = {
      domain: 'procedures',
      data: {
        procedure: ccFromConcept(concept),
        procedureDateTime: date,
        procedurePerformedDate: date,
      },
    }
    addOnce(ctx, out, `proc:${key}:${date}`, record, 'procedureDateTime', date)
  }

  for (const item of resource.item ?? []) {
    const concept = item.productOrService
    const coding0 = concept?.coding?.[0]
    if (!coding0?.code) continue
    const date = item.servicedDate ?? item.servicedPeriod?.start ?? start
    if (coding0.system === NDC) {
      // A pharmacy fill. `quantity` is the amount dispensed, not the dose, so
      // it is not mapped to doseAmount.
      const record = {
        domain: 'medications',
        data: {
          medication: ccFromConcept(concept),
          startDate: date,
          statementDate: date,
        },
      }
      addOnce(ctx, out, `rx:${coding0.code}`, record, 'startDate', date)
    } else if (PROCEDURE_ITEM_SYSTEMS.some((sys) => coding0.system?.includes(sys))) {
      const record = {
        domain: 'procedures',
        data: {
          procedure: ccFromConcept(concept),
          procedureDateTime: date,
          procedurePerformedDate: date,
        },
      }
      addOnce(ctx, out, `proc:${coding0.system}|${coding0.code}:${date}`, record, 'procedureDateTime', date)
    }
  }

  const coverageName = resource.insurance?.find((i) => i.focal)?.coverage?.display
  if (coverageName) {
    addOnce(
      ctx,
      out,
      `cov:${coverageName}`,
      {
        domain: 'coverage',
        data: { plan_name: coverageName, group_name: resource.insurer?.display, type: 'Medicare (Blue Button)', effective_date: start },
      },
      'effective_date',
      start,
    )
  }
  return out
}

const NORMALIZERS = {
  Patient: normalizePatient,
  MedicationRequest: normalizeMedication,
  MedicationStatement: normalizeMedication,
  AllergyIntolerance: normalizeAllergy,
  Condition: normalizeCondition,
  Observation: normalizeObservation,
  Immunization: normalizeImmunization,
  Procedure: normalizeProcedure,
  Device: normalizeDevice,
  Coverage: normalizeCoverage,
  ExplanationOfBenefit: normalizeExplanationOfBenefit,
}

export function normalizeFhirBundle(bundle) {
  const entries = bundle?.entry ?? (bundle?.resourceType ? [{ resource: bundle }] : [])
  const byRef = new Map()
  for (const entry of entries) {
    const r = entry.resource
    if (!r?.resourceType) continue
    if (entry.fullUrl) byRef.set(entry.fullUrl, r)
    if (r.id) byRef.set(`${r.resourceType}/${r.id}`, r)
  }
  const ctx = { byRef, seen: new Map() }
  const results = []
  for (const entry of entries) {
    const resource = entry.resource
    if (!resource?.resourceType) continue
    const normalizer = NORMALIZERS[resource.resourceType]
    if (!normalizer) continue
    const result = normalizer(resource, ctx)
    if (Array.isArray(result)) {
      results.push(...result)
    } else if (result) {
      results.push(result)
    }
  }
  return results
}
