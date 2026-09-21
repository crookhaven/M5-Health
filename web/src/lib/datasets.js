import { buildPiqiMessage } from './piqi/message'
import { buildClaimsPiqiMessage } from './claims/message'

// The three data sets the app can score with PIQI. Each has its own PIQI
// message, its own rubric and its own Gateway result.
export const DATASETS = {
  clinical: {
    key: 'clinical',
    label: 'Clinical',
    rubricHint: 'a clinical rubric such as USCDI v3.1',
    fileName: 'm5-health-piqi-message.json',
  },
  ips: {
    key: 'ips',
    label: 'IPS',
    rubricHint: 'the IPS rubric',
    fileName: 'm5-health-ips-piqi-message.json',
  },
  claims: {
    key: 'claims',
    label: 'Claims',
    rubricHint: 'the claims rubric',
    fileName: 'm5-health-claims-piqi-message.json',
  },
}

export const DATASET_ORDER = ['clinical', 'ips', 'claims']

// The four IPS rubric classes. Records of these domains keep their stored
// order, so a result for the IPS message links to the same records.
export const IPS_DOMAINS = ['demographics', 'allergies', 'medications', 'conditions']

export function buildDatasetMessage(dataset, { sourceRecords, assertions, claimsData }) {
  if (dataset === 'claims') return buildClaimsPiqiMessage(claimsData)
  if (dataset === 'ips') return buildPiqiMessage(sourceRecords, assertions, { domains: IPS_DOMAINS })
  return buildPiqiMessage(sourceRecords, assertions)
}

export function datasetHasData(dataset, { sourceRecords, claimsData }) {
  if (dataset === 'claims') return Boolean(claimsData?.claims?.length)
  if (dataset === 'ips') return sourceRecords.some((r) => IPS_DOMAINS.includes(r.domain))
  return sourceRecords.length > 0
}

// The fields the IPS rubric checks, by class.
export const IPS_FIELDS = {
  demographics: ['lastName', 'firstName', 'birthDate', 'birthSex', 'patientIdentifier', 'primaryLanguage', 'telecom', 'currentAddress'],
  allergies: ['substance', 'clinicalStatus', 'reaction', 'effectiveDate'],
  medications: ['medication', 'doseAmount', 'doseAmountUnit', 'doseRoute', 'startDate'],
  conditions: ['condition', 'clinicalStatus', 'onsetDate'],
}

export const IPS_SECTION_TITLES = {
  demographics: 'Patient',
  allergies: 'Allergies and intolerances',
  medications: 'Medication summary',
  conditions: 'Problem list',
}
