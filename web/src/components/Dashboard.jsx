import { useState } from 'react'
import { DOMAIN_HELP, DOMAIN_ORDER, DOMAINS, isDisplayOnly } from '../lib/domains'
import { filterBySpecialty } from '../lib/specialty'
import SpecialtyFilter from './SpecialtyFilter'
import {
  DOCUMENT_FIELDS,
  SUMMARY_FIELD,
  displayDate,
  displayOnlyFields,
  sortByDateDesc,
} from '../lib/displayOnly'
import { displayFields, fieldLabel, recordLabel } from '../lib/piqi/rules'
import { effectiveData, timelinessBucketFor } from '../lib/piqi/engine'
import { displayText } from '../lib/piqi/attributeTypes'
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
  const fields = displayFields(domain, merged)
  const bucketLabel = TIMELINESS_LABELS[timelinessBucketFor(domain, record, assertions)]

  return (
    <div className="record-card">
      <div className="record-card-header">
        <h3>{recordLabel(domain, merged)}</h3>
        {bucketLabel && <span className="badge">{bucketLabel}</span>}
      </div>
      <dl className="record-fields">
        {fields.map(({ field }) => {
          const text = displayText(merged[field])
          return (
            <div key={field}>
              <dt>{fieldLabel(field)}</dt>
              <dd>
                {text !== undefined ? (
                  <>
                    {text}
                    {assertedFields.has(field) && (
                      <span className="assertion-tag">patient-added</span>
                    )}
                  </>
                ) : (
                  <span className="missing-value">not recorded</span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
      <div className="record-source">
        Status: {confirmed ? 'Patient Confirmed' : sourceLabel(record.source)}
        {' · '}
        Source: {sourceLabel(record.source)}
      </div>
    </div>
  )
}

function DisplayOnlyCard({ domain, record }) {
  const data = record.data
  const summary = data[SUMMARY_FIELD[domain]]
  const doc = DOCUMENT_FIELDS[domain]
  const text = doc && data[doc.text]

  return (
    <div className="record-card">
      <div className="record-card-header">
        <h3>{recordLabel(domain, data)}</h3>
        {data.date && <span className="badge">{displayDate(data.date)}</span>}
      </div>
      <dl className="record-fields">
        {displayOnlyFields(domain, data).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {summary && <p className="record-summary">{summary}</p>}
      {text && (
        <details className="document-text">
          <summary>Show full {doc.label}</summary>
          <pre>{text}</pre>
          {data[doc.truncated] && <p className="record-source">Shortened for display.</p>}
        </details>
      )}
      {!text && doc && data[doc.omitted] && <p className="record-source">{data[doc.omitted]}</p>}
      {!text && doc && data[doc.url] && (
        <p className="record-source">
          Full {doc.label}:{' '}
          <a href={data[doc.url]} target="_blank" rel="noopener noreferrer">
            open at source
          </a>
        </p>
      )}
      <div className="record-source">Source: {sourceLabel(record.source)}</div>
    </div>
  )
}

function SectionHeading({ domain }) {
  return (
    <>
      <h2>{DOMAINS[domain].label}</h2>
      {DOMAIN_HELP[domain] && <p className="section-help">{DOMAIN_HELP[domain]}</p>}
    </>
  )
}

// The patient-facing view: plain-language cards. The provider-facing
// equivalent is ClinicalView.
export default function Dashboard({ sourceRecords, assertions }) {
  const [specialty, setSpecialty] = useState('all')
  const visible = filterBySpecialty(sourceRecords, specialty)
  const byDomain = {}
  for (const record of visible) {
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
      <SpecialtyFilter records={sourceRecords} value={specialty} onChange={setSpecialty} />
      {DOMAIN_ORDER.map((domain) => {
        const records = byDomain[domain] ?? []
        if (records.length === 0) return null

        if (domain === 'coverage') {
          return (
            <section key={domain}>
              <SectionHeading domain={domain} />
              <div className="coverage-list">
                {records.map((record) => (
                  <CoverageScreen key={record.id} record={record} />
                ))}
              </div>
            </section>
          )
        }

        if (isDisplayOnly(domain)) {
          return (
            <section key={domain}>
              <SectionHeading domain={domain} />
              <div className="record-grid record-grid-wide">
                {sortByDateDesc(records).map((record) => (
                  <DisplayOnlyCard key={record.id} domain={domain} record={record} />
                ))}
              </div>
            </section>
          )
        }

        return (
          <section key={domain}>
            <SectionHeading domain={domain} />
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
