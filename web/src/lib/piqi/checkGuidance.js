import { FIELD_LABELS } from './rules'
import { CLAIMS_FIELD_LABELS } from '../claims/model'
import {
  FIELD_GUIDANCE,
  PATIENT_FIXABLE_FIELDS,
  PROVIDER_ONLY_DOMAINS,
  ROUTE_FIX,
  ROUTE_PROVIDER,
} from './guidance'
import { checkKind } from './checkKind'

// Plain-language guidance for a failed PIQI Gateway check. Fixed text, written
// by hand: nothing is sent anywhere and every message can be reviewed.
//
// route 'fix'      -- the patient can supply or correct this
// route 'provider' -- needs the provider or the original source
// technical: true -- a data-format problem (code lists, units) that typing
//                    into the app cannot fix; shown separately and collapsed.

const STRENGTH = /\b\d+(?:\.\d+)?\s*(?:MG|MCG|G|ML|UNITS?|IU)\b/i

export function attributeLabel(check) {
  return (check.claims ? CLAIMS_FIELD_LABELS[check.attribute] : undefined) ?? FIELD_LABELS[check.attribute] ?? check.attribute
}

export function checkTitle(check) {
  const name = check.elementLabel || check.domain
  return `${name}: ${attributeLabel(check)}`
}

function providerQuestion(check) {
  const name = check.elementLabel || check.domain
  return `A data-quality check ("${check.assessment}") failed for "${name}". Can you correct or supply the ${attributeLabel(check)}?`
}

const CODE_SYSTEMS = /SNOMED CT|RxNorm|LOINC|CVX|NDC|UCUM|BCP-47|HL7|ICD-10/gi

// Which standard code lists a coded check names, e.g. "allergy substance is
// SNOMED CT or RxNorm" -> ["SNOMED CT", "RxNorm"].
export function expectedCodeSystems(check) {
  return [...new Set(`${check.assessment ?? ''}`.match(CODE_SYSTEMS) ?? [])]
}

function populatedGuidance(check) {
  const label = attributeLabel(check)
  let known = FIELD_GUIDANCE[check.attribute]

  if (check.domain === 'medications') {
    const strength = check.elementLabel?.match(STRENGTH)?.[0]
    if (check.attribute === 'doseAmount' && strength) {
      known = {
        explanation: `The medicine name shows its strength (${strength}), but the record has no dose amount filled in for the health-record check to count.`,
        nextStep: 'Check your pill bottle or pharmacy label and enter the amount from it as a number (for example, 10). If you are not sure, flag it for your provider.',
      }
    }
    if (check.attribute === 'doseRoute' && /\boral\b/i.test(check.elementLabel ?? '')) {
      known = {
        explanation: 'The medicine name says it is an oral medicine, but the route (how it is taken) is not listed as its own detail.',
        nextStep: 'If you swallow it by mouth, enter "Oral". Check your pill bottle or pharmacy label if you are not sure.',
      }
    }
  }

  if (check.attribute === 'clinicalStatus' && check.domain === 'allergies') {
    known = {
      explanation: 'The record does not say whether this allergy is still active or has resolved.',
      nextStep: 'Enter Active if you still react to it, or Resolved if it no longer applies. If you are not sure, flag it for your provider.',
    }
  }

  const fixable = !PROVIDER_ONLY_DOMAINS.has(check.domain) && PATIENT_FIXABLE_FIELDS.has(check.attribute)
  if (fixable) {
    return {
      route: ROUTE_FIX,
      explanation: known?.explanation ?? `The ${label} is missing from this record.`,
      nextStep: known?.nextStep ?? `If you know the ${label}, enter it. Otherwise flag it for your provider.`,
    }
  }
  return {
    route: ROUTE_PROVIDER,
    explanation: PROVIDER_ONLY_DOMAINS.has(check.domain)
      ? `The ${label} is missing. This value comes from a test or device, so it has to come from the source, not from memory.`
      : `The ${label} is missing. This is a clinical detail that your provider or the original source should supply.`,
    nextStep: 'Flag this for your provider or ask the original lab, clinic or device source for the missing information.',
  }
}

// Claims are created by the health plan and the providers who bill it, so
// nothing on a claims check can be fixed by typing into the app.
function claimsGuidance(check, kind) {
  const label = attributeLabel(check)
  const coded = kind === 'coded' || /valid value|cpt|hcpcs|\bdrg\b/i.test(check.assessment ?? '')
  return {
    route: ROUTE_PROVIDER,
    technical: coded,
    kind,
    explanation: coded
      ? `The ${label} on this claim does not use the standard code list this check expects. Claims data comes from your health plan, so this is a data-format issue, not something you did wrong.`
      : `A check on the ${label} did not pass ("${check.assessment}"). Claims are created by your health plan and the providers who bill it, so this cannot be corrected here.`,
    nextStep: 'Flag it so you can ask your health plan, or the provider who billed the claim, to correct or supply it.',
    providerQuestion: `A data-quality check ("${check.assessment}") failed on a claim (${check.elementLabel || check.domain}). Can the ${label} be corrected or supplied?`,
  }
}

export function guidanceForCheck(check) {
  const kind = checkKind(check)
  const label = attributeLabel(check)
  if (check.claims) return claimsGuidance(check, kind)
  let base

  if (kind === 'populated') {
    base = populatedGuidance(check)
  } else if (kind === 'numeric') {
    const fixable = !PROVIDER_ONLY_DOMAINS.has(check.domain) && PATIENT_FIXABLE_FIELDS.has(check.attribute)
    base = fixable
      ? {
          route: ROUTE_FIX,
          explanation: `The ${label} is not a plain number, so it cannot be counted.`,
          nextStep: 'Enter just the number from your label (for example, 10), without units or words.',
        }
      : {
          route: ROUTE_PROVIDER,
          explanation: `The ${label} is not a valid number. Values like this come from the source, so please do not change them yourself.`,
          nextStep: 'Flag this for your provider or the source that supplied the record.',
        }
  } else if (kind === 'date') {
    const fixable = !PROVIDER_ONLY_DOMAINS.has(check.domain) && PATIENT_FIXABLE_FIELDS.has(check.attribute)
    base = fixable
      ? {
          route: ROUTE_FIX,
          explanation: `The ${label} does not look like a valid date in the past (for example it may be blank, in the future, or unreadable).`,
          nextStep: 'If you know the correct date, enter it. Otherwise flag it for your provider.',
        }
      : {
          route: ROUTE_PROVIDER,
          explanation: `The ${label} does not look like a valid date in the past.`,
          nextStep: 'Flag this for your provider so the source can correct it.',
        }
  } else if (kind === 'coded') {
    const systems = expectedCodeSystems(check)
    const expected = systems.length ? ` (${systems.join(' or ')})` : ''
    base = {
      route: ROUTE_PROVIDER,
      technical: true,
      explanation: `The ${label} is not coded in the standard code list this check expects${expected}. The record may show the right words but not the standard code behind them. This is a data-format issue, not something you did wrong.`,
      nextStep: 'Typing text here cannot add a code. Flag it so your provider or the app that supplied the record can add the standard code.',
    }
  } else {
    base = {
      route: ROUTE_PROVIDER,
      explanation: `A check on the ${label} did not pass ("${check.assessment}").`,
      nextStep: 'Flag this for your provider.',
    }
  }

  return { ...base, kind, technical: base.technical ?? false, providerQuestion: providerQuestion(check) }
}

export function buildCheckProviderNote(checks) {
  const lines = checks.map((c, i) => `${i + 1}. ${guidanceForCheck(c).providerQuestion}`)
  return [
    'Questions about my health record for my provider',
    '',
    ...lines,
    '',
    'These came from a PIQI data-quality audit of my records in M5 Health. Please review and let me know what to correct.',
  ].join('\n')
}
