import {
  REQUIRED_FIELDS,
  FIELD_LABELS,
  IDENTITY_FIELDS,
  DATE_FIELDS,
  recordLabel,
  normalizeText,
} from './rules'

const RECENT_DAYS = 180
const STALE_DAYS = 730

export function assertionsForRecord(assertions, recordId) {
  return assertions.filter((a) => a.sourceRecordId === recordId)
}

export function effectiveData(record, assertions) {
  const fieldAssertions = assertionsForRecord(assertions, record.id).filter(
    (a) => a.kind === 'field',
  )
  const merged = { ...record.data }
  const assertedFields = new Set()
  for (const a of fieldAssertions) {
    merged[a.field] = a.value
    assertedFields.add(a.field)
  }
  const confirmed = assertionsForRecord(assertions, record.id).some(
    (a) => a.kind === 'confirm',
  )
  return { merged, assertedFields, confirmed }
}

function timelinessBucket(dateStr) {
  if (!dateStr) return 'unknown'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return 'unknown'
  const ageDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
  if (ageDays < 0) return 'recent'
  if (ageDays <= RECENT_DAYS) return 'recent'
  if (ageDays <= STALE_DAYS) return 'historical'
  return 'stale'
}

function makeFinding({ id, domain, dimension, recordIds, title, description, field }) {
  return {
    id,
    domain,
    dimension,
    recordIds,
    field: field ?? null,
    title,
    description,
    suggestedActions: ['review', 'ignore_for_now', 'remind_later'],
  }
}

function coverageCompletenessFindings(records) {
  const findings = []
  for (const record of records) {
    const data = record.data
    const missingParts = []
    if (!Array.isArray(data.deductibles) || data.deductibles.length === 0) {
      missingParts.push('deductible amounts')
    }
    if (!Array.isArray(data.moops) || data.moops.length === 0) {
      missingParts.push('out-of-pocket maximum amounts')
    }
    if (missingParts.length > 0) {
      findings.push(
        makeFinding({
          id: `completeness:coverage:missing-amounts:${record.id}`,
          domain: 'coverage',
          dimension: 'completeness',
          recordIds: [record.id],
          title: `${recordLabel('coverage', data)}: missing ${missingParts.join(' and ')}`,
          description:
            'This coverage record does not include the plan amounts needed to answer "what will I pay."',
        }),
      )
    }
  }
  return findings
}

function completenessFindings(domain, records, assertions) {
  if (domain === 'coverage') return coverageCompletenessFindings(records)
  const requiredFields = REQUIRED_FIELDS[domain]
  if (!requiredFields) return []
  const findings = []
  for (const record of records) {
    const { merged } = effectiveData(record, assertions)
    for (const field of requiredFields) {
      const value = merged[field]
      if (value === undefined || value === null || value === '') {
        findings.push(
          makeFinding({
            id: `completeness:${domain}:${field}:${record.id}`,
            domain,
            dimension: 'completeness',
            recordIds: [record.id],
            title: `${recordLabel(domain, merged)}: ${FIELD_LABELS[field] ?? field} missing`,
            description: `${FIELD_LABELS[field] ?? field} was not present in the source record and has not been confirmed by you.`,
            field,
          }),
        )
      }
    }
  }
  return findings
}

function duplicationAndConsistencyFindings(domain, records, assertions) {
  const identityField = IDENTITY_FIELDS[domain]
  if (!identityField) return []
  const findings = []
  const groups = new Map()
  const effectiveByRecord = new Map()

  for (const record of records) {
    const eff = effectiveData(record, assertions)
    effectiveByRecord.set(record.id, eff)
    const key = normalizeText(eff.merged[identityField])
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(record)
  }

  const comparableFields = (REQUIRED_FIELDS[domain] ?? []).filter(
    (f) => f !== identityField,
  )

  for (const [, groupRecords] of groups) {
    if (groupRecords.length < 2) continue
    const recordIds = groupRecords.map((r) => r.id)
    const label = recordLabel(domain, effectiveByRecord.get(groupRecords[0].id).merged)

    let allIdentical = true
    for (let i = 1; i < groupRecords.length; i++) {
      const a = effectiveByRecord.get(groupRecords[0].id).merged
      const b = effectiveByRecord.get(groupRecords[i].id).merged
      for (const field of comparableFields) {
        if (normalizeText(a[field]) !== normalizeText(b[field])) {
          allIdentical = false
          break
        }
      }
      if (!allIdentical) break
    }

    if (allIdentical) {
      findings.push(
        makeFinding({
          id: `duplication:${domain}:exact:${recordIds.sort().join(',')}`,
          domain,
          dimension: 'duplication',
          recordIds,
          title: `${label}: appears ${groupRecords.length} times from different sources`,
          description:
            'These records match on every field. They likely represent the same information imported more than once.',
        }),
      )
    } else {
      findings.push(
        makeFinding({
          id: `consistency:${domain}:conflict:${recordIds.sort().join(',')}`,
          domain,
          dimension: 'consistency',
          recordIds,
          title: `${label}: conflicting details across sources`,
          description:
            'These records share the same ' +
            identityField +
            ' but disagree on other details. Only you can say which is current.',
        }),
      )
    }
  }

  return findings
}

function provenanceFindings(records) {
  const findings = []
  for (const record of records) {
    if (!record.source?.type || record.source.type === 'unknown') {
      findings.push(
        makeFinding({
          id: `provenance:${record.domain}:${record.id}`,
          domain: record.domain,
          dimension: 'provenance',
          recordIds: [record.id],
          title: `${recordLabel(record.domain, record.data)}: source unknown`,
          description: 'This record has no identifiable source and cannot be trusted as-is.',
        }),
      )
    }
  }
  return findings
}

function timelinessFindings(domain, records, assertions) {
  const dateField = DATE_FIELDS[domain]
  const findings = []
  for (const record of records) {
    const { merged } = effectiveData(record, assertions)
    const dateStr = dateField ? merged[dateField] : record.source?.importedAt
    const bucket = timelinessBucket(dateStr ?? record.source?.importedAt)
    if (bucket === 'stale') {
      findings.push(
        makeFinding({
          id: `timeliness:${domain}:${record.id}`,
          domain,
          dimension: 'timeliness',
          recordIds: [record.id],
          title: `${recordLabel(domain, merged)}: potentially stale`,
          description:
            'This record is more than two years old and has not been reconfirmed since.',
        }),
      )
    }
  }
  return findings
}

export function timelinessBucketFor(domain, record, assertions) {
  const { merged } = effectiveData(record, assertions)
  const dateField = DATE_FIELDS[domain]
  const dateStr = dateField ? merged[dateField] : record.source?.importedAt
  return timelinessBucket(dateStr ?? record.source?.importedAt)
}

export function runPiqiAnalysis(sourceRecords, assertions, findingDecisions) {
  const byDomain = new Map()
  for (const record of sourceRecords) {
    if (!byDomain.has(record.domain)) byDomain.set(record.domain, [])
    byDomain.get(record.domain).push(record)
  }

  let findings = []
  for (const [domain, records] of byDomain) {
    findings = findings.concat(
      completenessFindings(domain, records, assertions),
      duplicationAndConsistencyFindings(domain, records, assertions),
      timelinessFindings(domain, records, assertions),
    )
  }
  findings = findings.concat(provenanceFindings(sourceRecords))

  return findings.map((f) => ({
    ...f,
    decision: findingDecisions[f.id] ?? null,
  }))
}
