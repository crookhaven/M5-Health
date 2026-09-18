// Data classes from the HL7 PIQI Clinical Data Model (PAT_CLINICAL_V1), plus
// Coverage, which is an M5 Health addition outside the PIQI clinical model.
// https://github.com/piqiframework/reference_application/blob/main/PIQI_Engine.Server/ReferenceData/Models/PAT_CLINICAL_V1.json

export const DOMAINS = {
  demographics: { key: 'demographics', label: 'Demographics', plural: false },
  allergies: { key: 'allergies', label: 'Allergies', plural: true },
  conditions: { key: 'conditions', label: 'Conditions', plural: true },
  immunizations: { key: 'immunizations', label: 'Immunizations', plural: true },
  labResults: { key: 'labResults', label: 'Lab Results', plural: true },
  medications: { key: 'medications', label: 'Medications', plural: true },
  procedures: { key: 'procedures', label: 'Procedures', plural: true },
  vitalSigns: { key: 'vitalSigns', label: 'Vital Signs', plural: true },
  medicalDevices: { key: 'medicalDevices', label: 'Medical Devices', plural: true },
  healthAssessments: { key: 'healthAssessments', label: 'Health Assessments', plural: true },
  coverage: { key: 'coverage', label: 'Coverage', plural: true },
}

export const DOMAIN_ORDER = [
  'demographics',
  'allergies',
  'conditions',
  'immunizations',
  'labResults',
  'medications',
  'procedures',
  'vitalSigns',
  'medicalDevices',
  'healthAssessments',
  'coverage',
]
