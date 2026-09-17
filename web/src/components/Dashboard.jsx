import { DOMAIN_ORDER, DOMAINS } from '../lib/domains'
import { REQUIRED_FIELDS, FIELD_LABELS, recordLabel } from '../lib/piqi/rules'
import { effectiveData, timelinessBucketFor } from '../lib/piqi/engine'
import { sourceLabel } from '../lib/sourceLabels'
import CoverageScreen from './CoverageScreen'

const TIMELINESS_LABELS = {
  recent: 'Recently updated',
  historical: 'Historical',
  stale: 'Potentially stale',
  unknown: null,
}

function RecordCard({ domain, record, assertions }) {
  const { merged, assertedFields, confirmed } = effectiveData(record, assertions)
  const fields = REQUIRED_FIELDS[domain] ?? []
  const identityField = fields[0]
  const bucketLabel = TIMELINESS_LABELS[timelinessBucketFor(domain, record, assertions)]

  return (
    <div className="record-card">
      <div className="record-card-header">
        <h3>{recordLabel(domain, merged)}</h3>
        {bucketLabel && <span className="badge">{bucketLabel}</span>}
      </div>
      <dl className="record-fields">
        {fields
          .filter((f) => f !== identityField)
          .map((field) => (
            <div key={field}>
              <dt>{FIELD_LABELS[field] ?? field}</dt>
              <dd>
                {merged[field] || merged[field] === 0 ? (
                  <>
                    {merged[field]}
                    {assertedFields.has(field) && (
                      <span className="assertion-tag">patient-added</span>
                    )}
                  </>
                ) : (
                  <span className="missing-value">not recorded</span>
                )}
              </dd>
            </div>
          ))}
      </dl>
      <div className="record-source">
        Status: {confirmed ? 'Patient Confirmed' : sourceLabel(record.source)}
        {' · '}
        Source: {sourceLabel(record.source)}
      </div>
    </div>
  )
}

export default function Dashboard({ sourceRecords, assertions }) {
  const byDomain = {}
  for (const record of sourceRecords) {
    if (!byDomain[record.domain]) byDomain[record.domain] = []
    byDomain[record.domain].push(record)
  }

  if (sourceRecords.length === 0) {
    return (
      <div className="empty-state">
        No health information imported yet. Go to the Import tab to load your
        sample record, a coverage document, a PDF, or a SMART Health Link.
      </div>
    )
  }

  return (
    <div className="dashboard">
      {DOMAIN_ORDER.map((domain) => {
        const records = byDomain[domain] ?? []
        if (records.length === 0) return null

        if (domain === 'coverage') {
          return (
            <section key={domain}>
              <h2>{DOMAINS[domain].label}</h2>
              <div className="coverage-list">
                {records.map((record) => (
                  <CoverageScreen key={record.id} record={record} />
                ))}
              </div>
            </section>
          )
        }

        return (
          <section key={domain}>
            <h2>{DOMAINS[domain].label}</h2>
            <div className="record-grid">
              {records.map((record) => (
                <RecordCard
                  key={record.id}
                  domain={domain}
                  record={record}
                  assertions={assertions}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
