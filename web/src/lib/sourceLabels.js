export const SOURCE_TYPE_LABELS = {
  sample: 'Sample data',
  'file-upload': 'Uploaded file',
  'smart-health-link': 'SMART Health Link',
  'pdf-upload': 'PDF import',
  'fhir-bundle-upload': 'FHIR bundle upload',
  manual: 'Manually entered',
}

export function sourceLabel(source) {
  return SOURCE_TYPE_LABELS[source.type] ?? source.type
}
