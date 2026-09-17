function text(codeableConcept) {
  if (!codeableConcept) return undefined
  return codeableConcept.text ?? codeableConcept.coding?.[0]?.display
}

function humanName(name) {
  if (!name) return undefined
  const given = name.given?.join(' ') ?? ''
  const family = name.family ?? ''
  return [given, family].filter(Boolean).join(' ') || undefined
}

function normalizePatient(resource) {
  return {
    domain: 'demographics',
    data: {
      name: humanName(resource.name?.[0]),
      dob: resource.birthDate,
      sex: resource.gender,
    },
  }
}

function normalizeMedication(resource) {
  const dosageInstruction = resource.dosageInstruction?.[0]
  return {
    domain: 'medications',
    data: {
      name: text(resource.medicationCodeableConcept) ?? resource.medicationReference?.display,
      dosage:
        dosageInstruction?.doseAndRate?.[0]?.doseQuantity?.value !== undefined
          ? `${dosageInstruction.doseAndRate[0].doseQuantity.value} ${dosageInstruction.doseAndRate[0].doseQuantity.unit ?? ''}`.trim()
          : undefined,
      frequency: dosageInstruction?.timing?.code?.text ?? dosageInstruction?.text,
      route: text(dosageInstruction?.route),
      status: resource.status,
    },
  }
}

function normalizeAllergy(resource) {
  const reaction = resource.reaction?.[0]
  return {
    domain: 'allergies',
    data: {
      substance: text(resource.code),
      reaction: text(reaction?.manifestation?.[0]),
      severity: reaction?.severity,
    },
  }
}

function normalizeCondition(resource) {
  return {
    domain: 'conditions',
    data: {
      diagnosis: text(resource.code),
      status: text(resource.clinicalStatus) ?? resource.clinicalStatus?.coding?.[0]?.code,
    },
  }
}

function normalizeObservation(resource) {
  if (resource.category?.some((c) => c.coding?.some((code) => code.code === 'laboratory')) === false) {
    return null
  }
  return {
    domain: 'labs',
    data: {
      test: text(resource.code),
      value: resource.valueQuantity?.value ?? resource.valueString,
      unit: resource.valueQuantity?.unit,
      date: resource.effectiveDateTime,
    },
  }
}

function normalizeImmunization(resource) {
  return {
    domain: 'immunizations',
    data: {
      vaccine: text(resource.vaccineCode),
      date: resource.occurrenceDateTime,
    },
  }
}

function normalizeCoverage(resource) {
  return {
    domain: 'coverage',
    data: {
      plan_name: resource.class?.find((c) => c.type?.coding?.[0]?.code === 'plan')?.name ?? 'Coverage',
      group_name: resource.payor?.[0]?.display,
      type: resource.type ? text(resource.type) : undefined,
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
    if (result) results.push(result)
  }
  return results
}
