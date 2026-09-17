export function createSourceRecord({ sourceType, documentName, domain, data, raw }) {
  return {
    id: crypto.randomUUID(),
    domain,
    source: {
      type: sourceType,
      documentName,
      importedAt: new Date().toISOString(),
    },
    data,
    raw: raw ?? null,
  }
}

export function validateCoveragePlan(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('File is not a valid JSON object.')
  }
  if (!Array.isArray(parsed.benefits)) {
    throw new Error(
      'File does not look like a plan benefits document (missing "benefits" array).',
    )
  }
  return parsed
}
