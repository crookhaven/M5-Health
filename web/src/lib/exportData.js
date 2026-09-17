import { DOMAIN_ORDER, DOMAINS } from './domains'
import { REQUIRED_FIELDS, FIELD_LABELS, recordLabel } from './piqi/rules'
import { effectiveData } from './piqi/engine'
import { sourceLabel } from './sourceLabels'

function coverageLines(data) {
  const lines = []
  if (data.group_name) lines.push(`Group: ${data.group_name}`)
  for (const d of data.deductibles ?? []) {
    lines.push(`Deductible (${d.network_tier}, ${d.family_cost}): $${d.amount}`)
  }
  for (const m of data.moops ?? []) {
    lines.push(`Out-of-Pocket Max (${m.network_tier}, ${m.family_cost}): $${m.amount}`)
  }
  return lines
}

export function selectedDomains(sourceRecords, sharingSelection) {
  return DOMAIN_ORDER.filter((domain) => {
    const hasRecords = sourceRecords.some((r) => r.domain === domain)
    if (!hasRecords) return false
    return sharingSelection[domain] !== false
  })
}

export function buildPdfSections(domains, sourceRecords, assertions) {
  return domains.map((domain) => {
    const records = sourceRecords.filter((r) => r.domain === domain)
    const identityField = (REQUIRED_FIELDS[domain] ?? [])[0]
    return {
      label: DOMAINS[domain].label,
      records: records.map((record) => {
        const { merged, confirmed } = effectiveData(record, assertions)
        const lines =
          domain === 'coverage'
            ? coverageLines(merged)
            : (REQUIRED_FIELDS[domain] ?? [])
                .filter((f) => f !== identityField)
                .map((f) => `${FIELD_LABELS[f] ?? f}: ${merged[f] ?? 'not recorded'}`)
        return {
          title: recordLabel(domain, merged),
          lines,
          source: `${sourceLabel(record.source)}${confirmed ? ' (Patient Confirmed)' : ''}`,
        }
      }),
    }
  })
}

export function buildSharePackageBundle(domains, sourceRecords, assertions) {
  const bundle = {
    generatedAt: new Date().toISOString(),
    records: {},
    provenance: [],
    assertions: [],
  }
  for (const domain of domains) {
    const records = sourceRecords.filter((r) => r.domain === domain)
    bundle.records[domain] = records.map((record) => {
      const { merged, confirmed } = effectiveData(record, assertions)
      bundle.provenance.push({ recordId: record.id, domain, source: record.source })
      return { id: record.id, data: merged, confirmed }
    })
  }
  bundle.assertions = assertions.filter((a) =>
    sourceRecords.some((r) => r.id === a.sourceRecordId && domains.includes(r.domain)),
  )
  return bundle
}
