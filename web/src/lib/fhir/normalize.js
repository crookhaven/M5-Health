import { ungzip } from 'pako'
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

// US Core birth sex is a fixed-code extension (M/F/UNK) from its own code
// system -- not the base FHIR `gender` administrative-gender system, whose
// codes are the lowercase words male/female/other/unknown. Tagging M/F/UNK
// as administrative-gender (as this used to do) produces a coding that is
// invalid under either system. A USCDI-aligned PIQI Gateway audit also wants
// a SNOMED CT code specifically ("Patient Birth Sex code is not in SNOMED
// CT" for a US Core M/F value with no SNOMED alongside it), so add the
// standard crosswalk (M -> 248153007, F -> 248152002) as a second coding on
// the same concept, the same way a multi-system concept like an allergy's
// substance already carries several parallel codings.
const US_CORE_BIRTHSEX_SYSTEM = 'http://hl7.org/fhir/us/core/CodeSystem/birthsex'
const BIRTHSEX_SNOMED = { M: { code: '248153007', display: 'Male' }, F: { code: '248152002', display: 'Female' } }

function usCoreBirthSex(resource) {
  const code = resource.extension?.find((e) => e.url === `${US_CORE_EXTENSION_BASE}birthsex`)?.valueCode
  if (!code) return undefined
  const display = { M: 'Male', F: 'Female', UNK: 'Unknown' }[code] ?? code
  const snomed = BIRTHSEX_SNOMED[code]
  return codeableConcept({
    text: display,
    codings: [
      coding({ code, display, system: US_CORE_BIRTHSEX_SYSTEM }),
      ...(snomed ? [coding({ code: snomed.code, display: snomed.display, system: 'http://snomed.info/sct' })] : []),
    ],
  })
}

// Base FHIR `gender` is itself a coded field (AdministrativeGender:
// male | female | other | unknown), so it should carry a coding, not just
// text -- dropping the code is what makes a Gateway audit call it an invalid
// concept when there is no US Core birthsex extension to prefer instead
// (seen auditing an IPS bundle, which has no US Core extensions).
function administrativeGenderConcept(genderCode) {
  if (!genderCode) return undefined
  return codeableConcept({
    text: genderCode,
    codings: [coding({ code: genderCode, system: 'http://hl7.org/fhir/administrative-gender' })],
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
      birthSex: usCoreBirthSex(resource) ?? administrativeGenderConcept(resource.gender),
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
      // Outside the PIQI model (EXTRA_FIELDS): shown, and used by Compare plans
      // to estimate fills, never sent to PIQI.
      asNeeded: dosage?.asNeededBoolean || dosage?.asNeededCodeableConcept ? 'Yes' : undefined,
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
      // Outside the PIQI model (EXTRA_FIELDS): shown, not sent to PIQI.
      reactionOnset: reaction?.onset,
    },
  }
}

// "Office visit 2026-07-12" for a condition's or note's encounter.
function encounterLabel(ref, ctx) {
  const encounter = resolveReference(ref, ctx)
  if (encounter?.resourceType !== 'Encounter') return ref?.display
  const kind = conceptText(encounter.type?.[0]) ?? encounter.class?.display ?? encounter.class?.code
  return [kind, encounter.period?.start?.slice(0, 10)].filter(Boolean).join(' ') || ref?.display
}

function normalizeCondition(resource, ctx) {
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
      encounter: encounterLabel(resource.encounter, ctx),
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

// Panel-style lab Observations (a CBC or metabolic panel, a Gram stain with
// several reported organisms) carry their real per-analyte results in
// `component`, not on the resource itself -- the same pattern already
// handled for vitalSigns/healthAssessments below. Without this, a panel
// collapses into one record under its own panel-level code with no result
// value, and every analyte it actually reported is silently dropped.
function normalizeLabResult(resource, ctx) {
  const performer = joinNames(resource.performer, ctx)
  return observationValueSources(resource).map(({ code, valueSource }) => ({
    domain: 'labResults',
    data: {
      performingSite: ccFromText(performer),
      bodySite: conceptText(resource.bodySite),
      order: ccFromConcept(resource.basedOn?.[0]?.display ? { text: resource.basedOn[0].display } : undefined),
      test: ccFromConcept(code),
      resultUnit: unitConcept(valueSource.valueQuantity),
      resultValue: normalizeObservationValue(valueSource),
      interpretation: ccFromConcept(resource.interpretation?.[0]),
      specimenType: ccFromConcept(resource.specimen?.display ? { text: resource.specimen.display } : undefined),
      resultStatus: ccFromText(resource.status),
      performedDateTime: resource.effectiveDateTime,
      issuedDateTime: resource.issued,
      referenceRange: normalizeReferenceRange(valueSource),
      orderDate: resource.issued,
      labCategory: ccFromConcept(resource.category?.[0]),
    },
  }))
}

function normalizeVitalSign(resource, ctx) {
  const performer = joinNames(resource.performer, ctx)
  return observationValueSources(resource).map(({ code, valueSource }) => ({
    domain: 'vitalSigns',
    data: {
      bodySite: conceptText(resource.bodySite),
      performer,
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

function normalizeHealthAssessment(resource, ctx) {
  const performer = joinNames(resource.performer, ctx)
  return observationValueSources(resource).map(({ code, valueSource }) => ({
    domain: 'healthAssessments',
    data: {
      performer,
      assessment: ccFromConcept(code),
      assessmentStatus: ccFromText(resource.status),
      resultValue: normalizeObservationValue(valueSource),
      resultUnit: unitConcept(valueSource.valueQuantity),
      effectiveDate: resource.effectiveDateTime,
      category: ccFromConcept(resource.category?.[0]),
    },
  }))
}

// A measurement with a real unit, not a score: UCUM annotations like
// "{score}" mark questionnaire totals rather than lab measurements.
function isMeasurement(resource) {
  const unit = resource.valueQuantity?.code ?? resource.valueQuantity?.unit
  return Boolean(unit) && !/^\{.*\}$/.test(unit)
}

function normalizeObservation(resource, ctx) {
  if (isCategory(resource, 'laboratory')) return normalizeLabResult(resource, ctx)
  if (isCategory(resource, 'vital-signs')) return normalizeVitalSign(resource, ctx)
  if (isCategory(resource, 'social-history') || isCategory(resource, 'survey')) {
    return normalizeHealthAssessment(resource, ctx)
  }
  // Uncategorized or other categories (exam, procedure...), common in
  // converted C-CDA: measurements are lab results, the rest (scores, coded
  // findings like "well nourished") are assessments, rather than dropping them.
  // Without any value there is nothing to show.
  if (!hasDirectValue(resource) && !resource.component?.length) return null
  return isMeasurement(resource) ? normalizeLabResult(resource, ctx) : normalizeHealthAssessment(resource, ctx)
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

function normalizeProcedure(resource, ctx) {
  const dateTime = resource.performedDateTime ?? resource.performedPeriod?.start
  return {
    domain: 'procedures',
    data: {
      procedureDateTime: dateTime,
      procedure: ccFromConcept(resource.code),
      // The reason is just as often a reference to a Condition as an inline
      // code (seen in real IPS samples) -- Encounter and ServiceRequest
      // already fall back to reasonReference, Procedure did not.
      procedureReason: ccFromConcept(resource.reasonCode?.[0]) ?? ccFromText(referenceName(resource.reasonReference?.[0], ctx)),
      procedureStatus: ccFromText(resource.status),
      procedurePerformedDate: dateTime,
      endDateTime: resource.performedPeriod?.end,
      bodySite: conceptText(resource.bodySite?.[0]),
      performer: joinNames((resource.performer ?? []).map((p) => p.actor), ctx),
    },
  }
}

function normalizeDevice(resource, ctx) {
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
      manufacturer: resource.manufacturer,
      version: resource.version?.[0]?.value,
      owner: referenceName(resource.owner, ctx),
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
// CPT, HCPCS and CDT (dental) service lines become procedures.
const PROCEDURE_ITEM_SYSTEMS = ['http://www.ama-assn.org/go/cpt', 'HCPCSReleaseCodeSets', 'ada.org/cdt']

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

// --- Imaging, clinical notes and referrals (display-only) -------------------
//
// These sit outside the PIQI clinical model, so they are mapped to plain
// strings for display rather than PIQI attribute types, and are never scored.
// Note text is kept small enough for localStorage: only text attachments are
// decoded, and long text is cut off.

const MAX_TEXT_CHARS = 20000
const PERSON_TYPES = new Set(['Practitioner', 'Person', 'RelatedPerson', 'Patient'])

function conceptText(concept) {
  if (!concept) return undefined
  return concept.text ?? concept.coding?.find((c) => c.display)?.display ?? concept.coding?.[0]?.code
}

function personName(resource) {
  const name = resource.name?.[0]
  if (!name) return undefined
  if (name.text) return name.text
  const base = [...(name.prefix ?? []), ...(name.given ?? []), name.family].filter(Boolean).join(' ')
  return name.suffix?.length ? `${base}, ${name.suffix.join(', ')}` : base || undefined
}

function referenceName(ref, ctx) {
  const target = resolveReference(ref, ctx)
  if (target) {
    if (target.resourceType === 'Organization') return target.name ?? ref.display
    if (PERSON_TYPES.has(target.resourceType)) return personName(target) ?? ref.display
    if (target.resourceType === 'PractitionerRole') {
      return referenceName(target.practitioner, ctx) ?? referenceName(target.organization, ctx)
    }
    if (typeof target.name === 'string') return target.name // Location, CareTeam, Device...
    if (target.code) return conceptText(target.code)
  }
  return ref?.display
}

function joinNames(refs, ctx) {
  const names = [...new Set((refs ?? []).map((r) => referenceName(r, ctx)).filter(Boolean))]
  return names.length ? names.join('; ') : undefined
}

// Markup whitespace is not meaningful, so it is collapsed first; line breaks
// come from block tags and table cells are separated by a tab.
function htmlToText(html) {
  return html
    .replace(/\s+/g, ' ')
    .replace(/<\/(td|th)>/gi, '\t')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d|\/paragraph|\/item)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/ *\t */g, '\t')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// The human-readable narrative of a C-CDA document: each section's <text>
// block under its <title>. Regex rather than an XML parser so it runs the same
// in the browser and in tests; sections without narrative are left out.
function cdaNarrative(xml) {
  const blocks = []
  const textBlock = /<text\b[^>]*>([\s\S]*?)<\/text>/gi
  let match
  while ((match = textBlock.exec(xml))) {
    const body = htmlToText(match[1])
    if (!body) continue
    const titleStart = xml.lastIndexOf('<title>', match.index)
    const titleEnd = titleStart >= 0 ? xml.indexOf('</title>', titleStart) : -1
    const title = titleEnd > titleStart ? htmlToText(xml.slice(titleStart + 7, titleEnd)) : ''
    blocks.push(title ? `${title.toUpperCase()}\n${body}` : body)
  }
  return blocks.join('\n\n')
}

function isGzip(bytes) {
  return bytes[0] === 0x1f && bytes[1] === 0x8b
}

const XML_TYPES = new Set(['text/xml', 'application/xml', 'application/hl7-cda+xml'])

// Returns { text, truncated, format } for text attachments (inline or via a
// Binary in the same Bundle), { omitted } for other formats, or { url } when
// the content lives elsewhere. Handles gzip-compressed content and C-CDA XML,
// which some senders label as text/plain.
function attachmentContent(attachment, ctx) {
  if (!attachment) return {}
  let data = attachment.data
  let contentType = attachment.contentType
  if (!data && attachment.url) {
    const binary = resolveReference({ reference: attachment.url }, ctx)
    if (binary?.resourceType === 'Binary') {
      data = binary.data
      contentType = contentType ?? binary.contentType
    }
  }
  const mediaType = (contentType ?? '').split(';')[0].trim().toLowerCase()
  if (!data) return attachment.url && !attachment.url.startsWith('shlink:/') ? { url: attachment.url } : {}
  if (!mediaType.startsWith('text/') && !XML_TYPES.has(mediaType)) {
    return { omitted: `${contentType ?? 'Unknown format'} document, not shown here` }
  }
  let text
  try {
    let bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
    if (isGzip(bytes)) bytes = ungzip(bytes)
    text = new TextDecoder().decode(bytes)
  } catch {
    return { omitted: 'Document text could not be decoded' }
  }
  let format
  if (text.includes('<ClinicalDocument')) {
    text = cdaNarrative(text)
    if (!text) return { omitted: 'C-CDA document with no narrative text', format: 'C-CDA document' }
    format = 'C-CDA document (narrative text shown)'
  } else if (XML_TYPES.has(mediaType)) {
    return { omitted: `${contentType} document, not shown here` }
  } else if (mediaType === 'text/html') {
    text = htmlToText(text)
  }
  text = text.trim()
  if (text.length > MAX_TEXT_CHARS) return { text: text.slice(0, MAX_TEXT_CHARS), truncated: true, format }
  return { text, format }
}

// Built once per Bundle: which imaging studies have a report, and which
// attachments already belong to a report (so a DocumentReference copy of the
// same report is not shown twice).
function reportIndex(ctx) {
  if (ctx.reportIndex) return ctx.reportIndex
  const byStudy = new Map()
  const attachmentUrls = new Set()
  for (const resource of new Set(ctx.byRef.values())) {
    if (resource.resourceType !== 'DiagnosticReport') continue
    for (const ref of resource.imagingStudy ?? []) {
      const study = resolveReference(ref, ctx)
      if (study) byStudy.set(study, resource)
    }
    for (const form of resource.presentedForm ?? []) {
      if (form.url) attachmentUrls.add(form.url)
    }
  }
  ctx.reportIndex = { byStudy, attachmentUrls }
  return ctx.reportIndex
}

function hasCategoryCode(resource, codes) {
  return resource.category?.some((c) => c.coding?.some((coded) => codes.includes(coded.code)))
}

function reportFields(report, ctx) {
  if (!report) return {}
  const content = attachmentContent(report.presentedForm?.[0], ctx)
  return {
    conclusion: report.conclusion,
    reportTitle: report.presentedForm?.[0]?.title ?? conceptText(report.code),
    reportText: content.text,
    reportTruncated: content.truncated,
    reportOmitted: content.omitted,
    reportUrl: content.url,
    interpreter: joinNames(report.resultsInterpreter, ctx) ?? joinNames(report.performer, ctx),
  }
}

function normalizeImagingStudy(resource, ctx) {
  const report = reportIndex(ctx).byStudy.get(resource)
  const fromReport = reportFields(report, ctx)
  const bodySites = [...new Set((resource.series ?? []).map((s) => s.bodySite?.display ?? s.bodySite?.code).filter(Boolean))]
  const modalities = [...new Set((resource.modality ?? []).map((m) => m.display ?? m.code).filter(Boolean))]
  return {
    domain: 'imaging',
    data: {
      title: resource.description ?? conceptText(resource.procedureCode?.[0]) ?? conceptText(report?.code) ?? 'Imaging study',
      date: resource.started ?? report?.effectiveDateTime,
      modality: modalities.join(', ') || undefined,
      bodySite: bodySites.join(', ') || undefined,
      procedure: conceptText(resource.procedureCode?.[0]),
      series: String(resource.numberOfSeries ?? resource.series?.length ?? '') || undefined,
      images: resource.numberOfInstances !== undefined ? String(resource.numberOfInstances) : undefined,
      status: resource.status,
      ...fromReport,
      interpreter: joinNames(resource.interpreter, ctx) ?? fromReport.interpreter,
    },
  }
}

function normalizeDiagnosticReport(resource, ctx) {
  // Lab panels, and any results-only report with no narrative: the results are
  // already imported as Lab Results, so the report would just be an empty header.
  if (resource.result?.length) {
    const hasNarrative = resource.presentedForm?.length || resource.conclusion
    if (hasCategoryCode(resource, ['LAB', 'laboratory']) || !hasNarrative) return null
  }
  // A report on an imaging study in this Bundle is shown on that study.
  if ((resource.imagingStudy ?? []).some((ref) => resolveReference(ref, ctx))) return null

  const fields = reportFields(resource, ctx)
  if (hasCategoryCode(resource, ['LP29684-5', 'RAD'])) {
    return {
      domain: 'imaging',
      data: {
        title: conceptText(resource.code) ?? 'Imaging report',
        date: resource.effectiveDateTime ?? resource.effectivePeriod?.start ?? resource.issued,
        status: resource.status,
        ...fields,
      },
    }
  }
  return {
    domain: 'clinicalNotes',
    data: {
      title: fields.reportTitle ?? 'Report',
      noteType: conceptText(resource.category?.[0]) ?? 'Report',
      date: resource.effectiveDateTime ?? resource.effectivePeriod?.start ?? resource.issued,
      author: fields.interpreter,
      status: resource.status,
      summary: resource.conclusion,
      text: fields.reportText,
      truncated: fields.reportTruncated,
      omitted: fields.reportOmitted,
      url: fields.reportUrl,
    },
  }
}

function normalizeDocumentReference(resource, ctx) {
  if (resource.status === 'entered-in-error') return null
  const attachment = resource.content?.[0]?.attachment
  // A pointer to a SMART Health Link, not a note.
  if (resource.content?.some((c) => c.attachment?.url?.startsWith('shlink:/'))) return null
  // A copy of a report that is already shown from its DiagnosticReport.
  const related = (resource.context?.related ?? []).map((ref) => resolveReference(ref, ctx))
  if (related.some((r) => r?.resourceType === 'DiagnosticReport')) return null
  if (attachment?.url && reportIndex(ctx).attachmentUrls.has(attachment.url)) return null

  const content = attachmentContent(attachment, ctx)
  return {
    domain: 'clinicalNotes',
    data: {
      title: attachment?.title ?? resource.description ?? conceptText(resource.type) ?? 'Clinical note',
      noteType: conceptText(resource.type),
      date: resource.date ?? resource.context?.period?.start ?? attachment?.creation,
      author: joinNames(resource.author, ctx),
      organization: referenceName(resource.custodian, ctx),
      status: resource.docStatus ?? resource.status,
      format: content.format,
      text: content.text,
      truncated: content.truncated,
      omitted: content.omitted,
      url: content.url,
    },
  }
}

function normalizeServiceRequest(resource, ctx) {
  const reasons = [
    ...(resource.reasonCode ?? []).map(conceptText),
    ...(resource.reasonReference ?? []).map((ref) => referenceName(ref, ctx)),
  ].filter(Boolean)
  return {
    domain: 'referrals',
    data: {
      title: conceptText(resource.code) ?? 'Order',
      date: resource.authoredOn,
      category: conceptText(resource.category?.[0]),
      status: resource.status,
      priority: resource.priority,
      requester: referenceName(resource.requester, ctx),
      performer: joinNames(resource.performer, ctx),
      reason: [...new Set(reasons)].join('; ') || undefined,
      summary: (resource.note ?? []).map((n) => n.text).filter(Boolean).join(' ') || undefined,
    },
  }
}

function addressText(address) {
  if (!address) return undefined
  if (address.text) return address.text
  return [address.line?.join(' '), address.city, address.state, address.postalCode].filter(Boolean).join(', ') || undefined
}

function normalizeEncounter(resource, ctx) {
  const reasons = [
    ...(resource.reasonCode ?? []).map(conceptText),
    ...(resource.reasonReference ?? []).map((ref) => referenceName(ref, ctx)),
  ].filter(Boolean)
  return {
    domain: 'encounters',
    data: {
      title: conceptText(resource.type?.[0]) ?? resource.class?.display ?? resource.class?.code ?? 'Encounter',
      date: resource.period?.start,
      endDate: resource.period?.end,
      encounterClass: resource.class?.display ?? resource.class?.code,
      status: resource.status,
      provider: joinNames((resource.participant ?? []).map((p) => p.individual), ctx),
      location: joinNames((resource.location ?? []).map((l) => l.location), ctx),
      facility: referenceName(resource.serviceProvider, ctx),
      reason: [...new Set(reasons)].join('; ') || undefined,
      diagnosis: joinNames((resource.diagnosis ?? []).map((d) => d.condition), ctx),
    },
  }
}

function normalizeCareTeam(resource, ctx) {
  const members = (resource.participant ?? [])
    .map((p) => {
      const name = referenceName(p.member, ctx)
      const role = conceptText(p.role?.[0])
      return name && role ? `${name} (${role})` : name ?? role
    })
    .filter(Boolean)
  return {
    domain: 'careTeam',
    data: {
      title: resource.name ?? 'Care team',
      date: resource.period?.start,
      status: resource.status,
      organization: joinNames(resource.managingOrganization, ctx),
      members: members.join('; ') || undefined,
    },
  }
}

function normalizeRelatedPerson(resource) {
  const contact = (system) => resource.telecom?.find((t) => t.system === system)?.value
  return {
    domain: 'contacts',
    data: {
      title: personName(resource) ?? 'Related person',
      relationship: conceptText(resource.relationship?.[0]),
      phone: contact('phone'),
      email: contact('email'),
      address: addressText(resource.address?.[0]),
      date: resource.period?.start,
    },
  }
}

function compositionSections(sections) {
  return (sections ?? []).flatMap((section) => {
    const body = section.text?.div ? htmlToText(section.text.div) : ''
    const own = body ? [[section.title?.toUpperCase(), body].filter(Boolean).join('\n')] : []
    return [...own, ...compositionSections(section.section)]
  })
}

// A clinical document (e.g. a C-CDA converted to FHIR): shown as a note with
// each section's narrative.
function normalizeComposition(resource, ctx) {
  let text = compositionSections(resource.section).join('\n\n')
  const truncated = text.length > MAX_TEXT_CHARS
  if (truncated) text = text.slice(0, MAX_TEXT_CHARS)
  return {
    domain: 'clinicalNotes',
    data: {
      title: resource.title ?? conceptText(resource.type) ?? 'Clinical document',
      noteType: conceptText(resource.type),
      date: resource.date ?? resource.event?.[0]?.period?.start,
      author: joinNames(resource.author, ctx),
      organization: referenceName(resource.custodian, ctx),
      status: resource.status,
      encounter: encounterLabel(resource.encounter, ctx),
      text: text || undefined,
      truncated: truncated || undefined,
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
  ExplanationOfBenefit: normalizeExplanationOfBenefit,
  ImagingStudy: normalizeImagingStudy,
  DiagnosticReport: normalizeDiagnosticReport,
  DocumentReference: normalizeDocumentReference,
  ServiceRequest: normalizeServiceRequest,
  Encounter: normalizeEncounter,
  CareTeam: normalizeCareTeam,
  RelatedPerson: normalizeRelatedPerson,
  Composition: normalizeComposition,
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
