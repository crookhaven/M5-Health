export const SOURCE_TYPE_LABELS = {
  sample: 'Sample data',
  'file-upload': 'Uploaded file',
  'smart-health-link': 'SMART Health Link',
  'pdf-upload': 'PDF import',
  manual: 'Manually entered',
}

export function sourceLabel(source) {
  return SOURCE_TYPE_LABELS[source.type] ?? source.type
}
