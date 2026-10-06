import { DOMAIN_ORDER, DOMAINS, isDisplayOnly } from './domains'
import { displayOnlyLines, sortByDateDesc } from './displayOnly'
import { displayFields, fieldLabel, recordLabel } from './piqi/rules'
import { effectiveData } from './piqi/engine'
import { displayText } from './piqi/attributeTypes'
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
    const domainRecords = sourceRecords.filter((r) => r.domain === domain)
    const records = isDisplayOnly(domain) ? sortByDateDesc(domainRecords) : domainRecords
    return {
      label: DOMAINS[domain].label,
      records: records.map((record) => {
        const { merged, confirmed } = effectiveData(record, assertions)
        let lines
        if (domain === 'coverage') {
          lines = coverageLines(merged)
        } else if (isDisplayOnly(domain)) {
          lines = displayOnlyLines(domain, merged)
        } else {
          lines = displayFields(domain, merged).map(
            ({ field }) => `${fieldLabel(field)}: ${displayText(merged[field]) ?? 'not recorded'}`,
          )
        }
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
