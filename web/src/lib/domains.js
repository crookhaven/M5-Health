export const DOMAINS = {
  demographics: { key: 'demographics', label: 'Demographics', plural: false },
  medications: { key: 'medications', label: 'Medications', plural: true },
  allergies: { key: 'allergies', label: 'Allergies', plural: true },
  conditions: { key: 'conditions', label: 'Conditions', plural: true },
  labs: { key: 'labs', label: 'Labs', plural: true },
  immunizations: { key: 'immunizations', label: 'Immunizations', plural: true },
  coverage: { key: 'coverage', label: 'Coverage', plural: true },
}

export const DOMAIN_ORDER = [
  'demographics',
  'medications',
  'allergies',
  'conditions',
  'labs',
  'immunizations',
  'coverage',
]
