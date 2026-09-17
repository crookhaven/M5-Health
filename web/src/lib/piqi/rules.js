export const REQUIRED_FIELDS = {
  demographics: ['name', 'dob', 'sex'],
  medications: ['name', 'dosage', 'frequency', 'route', 'status'],
  allergies: ['substance', 'reaction', 'severity'],
  conditions: ['diagnosis', 'status'],
  labs: ['test', 'value', 'unit', 'date'],
  immunizations: ['vaccine', 'date'],
}

export const FIELD_LABELS = {
  name: 'name',
  dosage: 'dosage',
  frequency: 'frequency',
  route: 'route',
  status: 'status',
  substance: 'substance',
  reaction: 'reaction',
  severity: 'severity',
  diagnosis: 'diagnosis',
  test: 'test',
  value: 'value',
  unit: 'unit',
  date: 'date',
  vaccine: 'vaccine',
  dob: 'date of birth',
  sex: 'sex',
}

export const IDENTITY_FIELDS = {
  medications: 'name',
  allergies: 'substance',
  conditions: 'diagnosis',
  labs: 'test',
  immunizations: 'vaccine',
}

export const DATE_FIELDS = {
  labs: 'date',
  immunizations: 'date',
}

export const RECORD_LABEL_FIELDS = {
  demographics: 'name',
  medications: 'name',
  allergies: 'substance',
  conditions: 'diagnosis',
  labs: 'test',
  immunizations: 'vaccine',
  coverage: 'plan_name',
}

export function recordLabel(domain, data) {
  const field = RECORD_LABEL_FIELDS[domain]
  return (field && data[field]) || 'Untitled record'
}

export function normalizeText(value) {
  return (value ?? '').toString().trim().toLowerCase()
}
