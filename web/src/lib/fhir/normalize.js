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
      telecom: resource.telecom?.find((t) => t.system === 'phone')?.value,
    },
  }
}

function normalizeMedication(resource) {
  const dosage = resource.dosageInstruction?.[0]
  const doseQty = dosage?.doseAndRate?.[0]?.doseQuantity
  const dispenseQty = resource.dispenseRequest?.quantity
  const period = dosage?.timing?.repeat?.boundsPeriod
  return {
    domain: 'medications',
    data: {
      medication: ccFromConcept(resource.medicationCodeableConcept),
      doseAmount: doseQty?.value !== undefined ? String(doseQty.value) : undefined,
      doseAmountUnit: doseQty?.unit ? ccFromText(doseQty.unit) : undefined,
      doseRoute: ccFromConcept(dosage?.route),
      doseQuantity: dispenseQty?.value !== undefined ? String(dispenseQty.value) : undefined,
      doseQuantityUnit: dispenseQty?.unit ? ccFromText(dispenseQty.unit) : undefined,
      instructions: dosage?.text,
      indication: ccFromConcept(resource.reasonCode?.[0]),
      startDate: period?.start ?? resource.authoredOn,
      endDate: period?.end,
      statementDate: resource.authoredOn ?? resource.effectiveDateTime,
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
      resultUnit: resource.valueQuantity?.unit ? ccFromText(resource.valueQuantity.unit) : undefined,
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
      resultUnit: valueSource.valueQuantity?.unit ? ccFromText(valueSource.valueQuantity.unit) : undefined,
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
      resultUnit: valueSource.valueQuantity?.unit ? ccFromText(valueSource.valueQuantity.unit) : undefined,
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
}

export function normalizeFhirBundle(bundle) {
  const entries = bundle?.entry ?? (bundle?.resourceType ? [{ resource: bundle }] : [])
  const results = []
  for (const entry of entries) {
    const resource = entry.resource
    if (!resource?.resourceType) continue
    const normalizer = NORMALIZERS[resource.resourceType]
    if (!normalizer) continue
    const result = normalizer(resource)
    if (Array.isArray(result)) {
      results.push(...result)
    } else if (result) {
      results.push(result)
    }
  }
  return results
}
