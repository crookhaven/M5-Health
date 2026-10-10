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
import { displayFields, fieldLabel, recordLabel, IDENTITY_FIELDS, DATE_FIELDS } from '../lib/piqi/rules'
import { effectiveData, timelinessBucketFor } from '../lib/piqi/engine'
import { displayText } from '../lib/piqi/attributeTypes'
import { sourceLabel } from '../lib/sourceLabels'
import { summarizeForDisplay } from '../lib/dedup'
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
  const recurrence = record._recurrence

  return (
    <div className="record-card">
      <div className="record-card-header">
        <h3>{recordLabel(domain, merged)}</h3>
        {bucketLabel && <span className="badge">{bucketLabel}</span>}
      </div>
      {recurrence && recurrence.count > 1 && (
        <p className="record-recurrence">
          Showing the most recent of {recurrence.count} times this was recorded
          {recurrence.firstDate && <> &middot; first noted {displayDate(recurrence.firstDate)}</>}
        </p>
      )}
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

        // Drop records with nothing to identify them by (an "Untitled
        // record" tells the patient nothing), then summarize what's left --
        // exact duplicates collapsed everywhere, and for domains where the
        // same fact gets reaffirmed at nearly every visit (a chronic
        // condition, a tobacco-use status, a known allergy), every instance
        // grouped down to the most recent one. This applies across every
        // domain -- Coverage and the display-only ones (Care Team,
        // Encounters, Clinical Notes...) go through the same filter as the
        // PIQI clinical domains.
        const titled = records.filter(
          (record) => recordLabel(domain, effectiveData(record, assertions).merged) !== 'Untitled record',
        )
        const deduped = summarizeForDisplay(
          domain,
          titled,
          (record) => effectiveData(record, assertions).merged,
          IDENTITY_FIELDS[domain],
          DATE_FIELDS[domain],
        )
        if (deduped.length === 0) return null

        if (domain === 'coverage') {
          return (
            <section key={domain}>
              <SectionHeading domain={domain} />
              <div className="coverage-list">
                {deduped.map((record) => (
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
                {sortByDateDesc(deduped).map((record) => (
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
              {deduped.map((record) => (
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
