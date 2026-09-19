import { FIELD_LABELS } from './rules'

// Patient-facing guidance for PIQI findings. Fixed, hand-written text -- no
// health data leaves the browser and every message can be reviewed.
//
// Each finding is sorted into one of two routes:
//   'fix'      -- the patient can resolve it (fill in a gap they know the
//                 answer to, or confirm a duplicate / still-current item).
//   'provider' -- it is not the patient's call (measured results, diagnoses,
//                 conflicting records, unknown sources). Flag it for a
//                 provider instead of guessing.

export const ROUTE_FIX = 'fix'
export const ROUTE_PROVIDER = 'provider'

// Measured or clinician-determined values. A patient should never type these
// in from memory, so gaps here always go to the provider.
export const PROVIDER_ONLY_DOMAINS = new Set(['labResults', 'vitalSigns', 'healthAssessments', 'medicalDevices'])

// Missing fields a patient can usually answer themselves.
export const PATIENT_FIXABLE_FIELDS = new Set([
  'firstName',
  'lastName',
  'birthDate',
  'birthSex',
  'doseAmount',
  'doseRoute',
  'requestStatus',
  'conditionStatus',
  'reaction',
  'severity',
  'administrationDate',
  'procedureDateTime',
  'procedureStatus',
])

// Plain-language explanations for the gaps that come up most.
export const FIELD_GUIDANCE = {
  doseAmount: {
    explanation: 'The record does not say how much of this medicine to take each time.',
    nextStep: 'Check your pill bottle or pharmacy label and enter the dose (for example, 20 mg).',
  },
  doseRoute: {
    explanation: 'The record does not say how this medicine is taken (for example by mouth or by injection).',
    nextStep: 'Check your pill bottle or pharmacy label and enter the route (for example, Oral).',
  },
  requestStatus: {
    explanation: 'The record does not say whether this medicine is currently active.',
    nextStep: 'Enter whether you are still taking it (for example, Active or Stopped).',
  },
  conditionStatus: {
    explanation: 'The record does not say whether this condition is ongoing or resolved.',
    nextStep: 'Enter what you know (for example, Active or Resolved). If you are not sure, flag it for your provider.',
  },
  birthDate: {
    explanation: 'Your date of birth is missing, which makes it harder to match your records correctly.',
    nextStep: 'Enter your date of birth.',
  },
  birthSex: {
    explanation: 'Birth sex is missing. Some health checks and screenings depend on it.',
    nextStep: 'Enter the birth sex shown on your medical records.',
  },
  reaction: {
    explanation: 'The allergy is listed, but not what happens when you are exposed to it.',
    nextStep: 'Enter the reaction you have had (for example, Hives).',
  },
  severity: {
    explanation: 'The allergy is listed, but not how serious the reaction is.',
    nextStep: 'Enter your best description (for example, Mild or Severe). Ask your provider if you are not sure.',
  },
  administrationDate: {
    explanation: 'The record does not say when this vaccine was given.',
    nextStep: 'Enter the date if you know it. A vaccine card or your pharmacy can help.',
  },
  procedureDateTime: {
    explanation: 'The record does not say when this procedure happened.',
    nextStep: 'Enter the date if you know it.',
  },
}

function fixOrProvider(finding) {
  if (PROVIDER_ONLY_DOMAINS.has(finding.domain)) return ROUTE_PROVIDER
  return PATIENT_FIXABLE_FIELDS.has(finding.field) ? ROUTE_FIX : ROUTE_PROVIDER
}

// Medication names often carry the strength and form ("Lisinopril 10 MG Oral
// Tablet"). That is the size of one tablet, not how much you take each time or
// how often, so the structured dose can still be genuinely missing.
const STRENGTH_PATTERN = /\b\d+(?:\.\d+)?\s*(?:MG|MCG|G|ML|UNITS?|IU)\b/i
const ORAL_PATTERN = /\boral\b/i

function medicationNameHints(finding) {
  const name = finding.title.split(':')[0]
  return {
    strength: name.match(STRENGTH_PATTERN)?.[0] ?? null,
    isOral: ORAL_PATTERN.test(name),
  }
}

function completenessGuidance(finding) {
  const label = FIELD_LABELS[finding.field] ?? finding.field ?? 'a detail'
  const route = fixOrProvider(finding)
  let known = FIELD_GUIDANCE[finding.field]

  if (finding.domain === 'medications') {
    const { strength, isOral } = medicationNameHints(finding)
    if (finding.field === 'doseAmount' && strength) {
      known = {
        explanation: `The medicine name shows its strength (${strength}), but the record does not say how much you take each time or how often. For example, one ${strength} tablet twice a day is different from two tablets once a day.`,
        nextStep: 'Check your pill bottle or pharmacy label for the directions and enter how much you take each time (for example, 1 tablet).',
      }
    }
    if (finding.field === 'doseRoute' && isOral) {
      known = {
        explanation: 'The medicine name says it is an oral medicine, but the record does not list the route (how it is taken) as its own detail.',
        nextStep: 'If you swallow it by mouth, enter "Oral". Check your pill bottle or pharmacy label if you are not sure.',
      }
    }
  }

  if (route === ROUTE_FIX) {
    return {
      route,
      explanation: known?.explanation ?? `The ${label} is missing from this record.`,
      nextStep: known?.nextStep ?? `If you know the ${label}, enter it. Otherwise flag it for your provider.`,
      providerQuestion: `The ${label} is missing for "${finding.title.split(':')[0]}". Can you add or confirm it?`,
    }
  }

  const measured = PROVIDER_ONLY_DOMAINS.has(finding.domain)
  return {
    route,
    explanation: measured
      ? `The ${label} is missing. This value comes from a test or device, so it has to come from the source, not from memory.`
      : `The ${label} is missing. This is a clinical detail that your provider or the original source should supply.`,
    nextStep: 'Flag this for your provider or ask the original lab, clinic or device source for the missing information.',
    providerQuestion: `The ${label} is missing for "${finding.title.split(':')[0]}". Can you supply it or send a corrected record?`,
  }
}

export function guidanceForFinding(finding) {
  const name = finding.title.split(':')[0]

  switch (finding.dimension) {
    case 'completeness':
      return completenessGuidance(finding)
    case 'duplication':
      return {
        route: ROUTE_FIX,
        explanation: 'This looks like the same item imported more than once. It does not change your care, but it can make your record look messier and confuse a reader.',
        nextStep: 'If these really are the same, mark this reviewed. No other change is needed.',
        providerQuestion: `"${name}" appears more than once in my records. Can you confirm it is one item?`,
      }
    case 'consistency':
      return {
        route: ROUTE_PROVIDER,
        explanation: 'Two records for the same item disagree, for example on the dose. Only a clinician can say which one is right, so please do not pick one yourself.',
        nextStep: 'Compare against your pill bottle or pharmacy label, then flag this so your provider can confirm which is current.',
        providerQuestion: `My records list "${name}" with conflicting details. Which one is current, and can the other be corrected or removed?`,
      }
    case 'provenance':
      return {
        route: ROUTE_PROVIDER,
        explanation: 'This record does not say where it came from, so it cannot be trusted as-is.',
        nextStep: 'Flag this for your provider. If you remember where it came from, mention that.',
        providerQuestion: `I have a record for "${name}" with no known source. Can you confirm it is correct?`,
      }
    case 'timeliness':
      return {
        route: ROUTE_FIX,
        explanation: 'This record is more than two years old and has not been rechecked. It may no longer be accurate.',
        nextStep: PROVIDER_ONLY_DOMAINS.has(finding.domain)
          ? 'Flag this for your provider. An older result may need to be repeated.'
          : 'If it is still true, mark it reviewed. If you are not sure, flag it for your provider.',
        providerQuestion: `"${name}" has not been updated in over two years. Is it still current?`,
      }
    default:
      return {
        route: ROUTE_PROVIDER,
        explanation: finding.description,
        nextStep: 'Flag this for your provider.',
        providerQuestion: finding.title,
      }
  }
}

// Timeliness on measured data (labs, vitals) is really a provider question,
// so route it there even though the general timeliness rule is patient-friendly.
export function routeForFinding(finding) {
  const guidance = guidanceForFinding(finding)
  if (finding.dimension === 'timeliness' && PROVIDER_ONLY_DOMAINS.has(finding.domain)) {
    return ROUTE_PROVIDER
  }
  return guidance.route
}

export function withGuidance(finding) {
  const guidance = guidanceForFinding(finding)
  return { ...guidance, route: routeForFinding(finding) }
}

export function buildProviderNote(findings) {
  const lines = findings.map((f, i) => `${i + 1}. ${withGuidance(f).providerQuestion}`)
  return [
    'Questions about my health record for my provider',
    '',
    ...lines,
    '',
    'These came from a data-quality check of my records in M5 Health. Please review and let me know what to correct.',
  ].join('\n')
}
