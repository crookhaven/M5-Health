import { useState } from 'react'
import { DOMAIN_HELP, DOMAIN_ORDER, DOMAINS, isDisplayOnly } from '../lib/domains'
import { filterBySpecialty } from '../lib/specialty'
import SpecialtyFilter from './SpecialtyFilter'
import DateFilter from './DateFilter'
import { ALL_DATES, filterByDate } from '../lib/dateFilter'
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

// Within a display-only domain, group cards under the person they're with
// (an encounter's provider) when seeing everything tied to that one person
// together -- sorted by when it happened -- is more useful than a single
// list sorted by date that mixes every provider together.
const GROUP_BY_PERSON = { encounters: 'provider' }

function groupByPerson(domain, records) {
  const field = GROUP_BY_PERSON[domain]
  if (!field) return null

  const groups = new Map()
  const none = []
  for (const record of records) {
    const name = record.data[field]
    if (!name) {
      none.push(record)
      continue
    }
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(record)
  }

  const sections = [...groups.entries()].map(([name, recs]) => ({
    name,
    records: sortByDateDesc(recs),
  }))
  // Most recently seen provider first.
  sections.sort((a, b) => (b.records[0].data.date ?? '').localeCompare(a.records[0].data.date ?? ''))
  if (none.length) sections.push({ name: null, records: sortByDateDesc(none) })
  return sections
}

function SectionHeading({ domain }) {
  return (
    <>
      <h2>{DOMAINS[domain].label}</h2>
      {DOMAIN_HELP[domain] && <p className="section-help">{DOMAIN_HELP[domain]}</p>}
    </>
  )
}

// Drops untitled records, then summarizes what's left -- exact duplicates
// collapsed everywhere, and for domains where the same fact gets reaffirmed
// at nearly every visit (a chronic condition, a tobacco-use status, a known
// allergy), every instance grouped down to the most recent one. This is the
// one place that decides what the summary actually shows, used both to
// render each section and to count what's on screen (so the specialty
// badges don't quote the raw, pre-summary record count).
function summarizedByDomain(records, assertions) {
  const byDomain = {}
  for (const record of records) {
    if (!byDomain[record.domain]) byDomain[record.domain] = []
    byDomain[record.domain].push(record)
  }
  const result = {}
  for (const domain of Object.keys(byDomain)) {
    const titled = byDomain[domain].filter(
      (record) => recordLabel(domain, effectiveData(record, assertions).merged) !== 'Untitled record',
    )
    result[domain] = summarizeForDisplay(
      domain,
      titled,
      (record) => effectiveData(record, assertions).merged,
      IDENTITY_FIELDS[domain],
      DATE_FIELDS[domain],
    )
  }
  return result
}

function summarizedTotal(records, assertions) {
  const byDomain = summarizedByDomain(records, assertions)
  return Object.values(byDomain).reduce((total, recs) => total + recs.length, 0)
}

// The patient-facing view: plain-language cards, grouped and summarized down
// to what's currently true. The provider-facing equivalent, with every
// record exactly as imported for comparison, is Clinical view.
export default function Dashboard({ sourceRecords, assertions }) {
  const [specialty, setSpecialty] = useState('all')
  const [dateFilter, setDateFilter] = useState(ALL_DATES)
  const dateFiltered = filterByDate(sourceRecords, dateFilter)
  const visible = filterBySpecialty(dateFiltered, specialty)
  const byDomain = summarizedByDomain(visible, assertions)

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
      <p className="section-help">
        Your summary: duplicates merged, and anything reaffirmed at nearly
        every visit shown as just its most recent entry. For every record
        exactly as it came in, see Clinical view. Narrow to a year, month or
        day with the date filter to see everything from that time instead of
        just the most recent.
      </p>
      <div className="filter-row">
        <SpecialtyFilter
          records={dateFiltered}
          value={specialty}
          onChange={setSpecialty}
          countFn={(recs) => summarizedTotal(recs, assertions)}
        />
        <DateFilter records={sourceRecords} value={dateFilter} onChange={setDateFilter} />
      </div>
      {DOMAIN_ORDER.map((domain) => {
        const deduped = byDomain[domain] ?? []
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
          const personGroups = groupByPerson(domain, deduped)
          return (
            <section key={domain}>
              <SectionHeading domain={domain} />
              {personGroups ? (
                personGroups.map((group) => (
                  <div key={group.name ?? '__none'} className="person-group">
                    <h3 className="person-group-heading">{group.name ?? 'No provider listed'}</h3>
                    <div className="record-grid record-grid-wide">
                      {group.records.map((record) => (
                        <DisplayOnlyCard key={record.id} domain={domain} record={record} />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="record-grid record-grid-wide">
                  {sortByDateDesc(deduped).map((record) => (
                    <DisplayOnlyCard key={record.id} domain={domain} record={record} />
                  ))}
                </div>
              )}
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
