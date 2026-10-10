import { useState } from 'react'
import { DOMAIN_ORDER, DOMAINS, isDisplayOnly } from '../lib/domains'
import { DATE_FIELDS, IDENTITY_FIELDS, displayFields, fieldLabel, recordLabel } from '../lib/piqi/rules'
import { effectiveData } from '../lib/piqi/engine'
import { displayText } from '../lib/piqi/attributeTypes'
import { DOCUMENT_FIELDS, SUMMARY_FIELD, displayDate, displayOnlyFields, sortByDateDesc } from '../lib/displayOnly'
import { filterBySpecialty, specialtyOf, SPECIALTIES } from '../lib/specialty'
import { sourceLabel } from '../lib/sourceLabels'
import SpecialtyFilter from './SpecialtyFilter'

const SYSTEM_NAMES = [
  [/snomed/i, 'SNOMED CT'],
  [/loinc/i, 'LOINC'],
  [/rxnorm/i, 'RxNorm'],
  [/icd-10-cm/i, 'ICD-10-CM'],
  [/icd-10/i, 'ICD-10'],
  [/ama-assn|cpt/i, 'CPT'],
  [/hcpcs/i, 'HCPCS'],
  [/ada\.org|cdt/i, 'CDT'],
  [/cvx/i, 'CVX'],
  [/ndc/i, 'NDC'],
  [/unitsofmeasure/i, 'UCUM'],
]

function systemName(system) {
  if (!system) return ''
  return SYSTEM_NAMES.find(([pattern]) => pattern.test(system))?.[1] ?? system.replace(/^https?:\/\//, '')
}

function Codes({ value }) {
  const codings = value?.codings?.filter((c) => c.code) ?? []
  if (codings.length === 0) return <span className="missing-cell">uncoded</span>
  return codings.map((c, i) => (
    <div key={`${c.system}|${c.code}|${i}`} className="code-line">
      <span className="code-system">{systemName(c.system)}</span> {c.code}
    </div>
  ))
}

const SPECIALTY_LABELS = Object.fromEntries(SPECIALTIES.map((s) => [s.key, s.label]))

function ClinicalTable({ domain, records, assertions }) {
  const dateField = DATE_FIELDS[domain]
  return (
    <div className="table-scroll">
      <table className="clinical-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Code</th>
            <th scope="col">Date</th>
            <th scope="col">Details</th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const { merged, confirmed } = effectiveData(record, assertions)
            const details = displayFields(domain, merged).filter(({ field }) => field !== dateField)
            return (
              <tr key={record.id}>
                <th scope="row">
                  {recordLabel(domain, merged)}
                  <div className="specialty-tag">{SPECIALTY_LABELS[specialtyOf(record)]}</div>
                </th>
                <td>{domain === 'demographics' ? '' : <Codes value={merged[IDENTITY_FIELDS[domain]]} />}</td>
                <td>{displayDate(merged[dateField]) ?? ''}</td>
                <td>
                  {details.map(({ field, required }) => {
                    const text = displayText(merged[field])
                    return (
                      <div key={field}>
                        <span className="detail-label">{fieldLabel(field)}:</span>{' '}
                        {text ?? (required ? <span className="missing-cell">not recorded</span> : '')}
                      </div>
                    )
                  })}
                </td>
                <td>
                  {sourceLabel(record.source)}
                  {confirmed && <div className="specialty-tag">patient confirmed</div>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DocumentTable({ domain, records }) {
  const doc = DOCUMENT_FIELDS[domain]
  const summaryField = SUMMARY_FIELD[domain]
  return (
    <div className="table-scroll">
      <table className="clinical-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Date</th>
            <th scope="col">Details</th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {sortByDateDesc(records).map((record) => {
            const data = record.data
            const text = doc && data[doc.text]
            return (
              <tr key={record.id}>
                <th scope="row">
                  {recordLabel(domain, data)}
                  <div className="specialty-tag">{SPECIALTY_LABELS[specialtyOf(record)]}</div>
                </th>
                <td>{displayDate(data.date) ?? ''}</td>
                <td>
                  {displayOnlyFields(domain, data)
                    .filter(([label]) => label !== 'Date')
                    .map(([label, value]) => (
                      <div key={label}>
                        <span className="detail-label">{label}:</span> {value}
                      </div>
                    ))}
                  {summaryField && data[summaryField] && <div className="record-summary">{data[summaryField]}</div>}
                  {text && (
                    <details className="document-text">
                      <summary>Full {doc.label}</summary>
                      <pre>{text}</pre>
                    </details>
                  )}
                  {!text && doc && data[doc.omitted] && <div className="specialty-tag">{data[doc.omitted]}</div>}
                </td>
                <td>{sourceLabel(record.source)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CoverageTable({ records }) {
  return (
    <div className="table-scroll">
      <table className="clinical-table">
        <thead>
          <tr>
            <th scope="col">Plan</th>
            <th scope="col">Type</th>
            <th scope="col">Effective</th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <th scope="row">{record.data.plan_name}</th>
              <td>{record.data.type ?? ''}</td>
              <td>{displayDate(record.data.effective_date) ?? ''}</td>
              <td>{sourceLabel(record.source)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// The provider-facing view: every section as a table with codes, dates,
// all populated details and provenance. The patient-facing equivalent is
// Dashboard.
export default function ClinicalView({ sourceRecords, assertions }) {
  const [specialty, setSpecialty] = useState('all')

  if (sourceRecords.length === 0) {
    return <div className="empty-state">No health information imported yet.</div>
  }

  const visible = filterBySpecialty(sourceRecords, specialty)
  const byDomain = {}
  for (const record of visible) {
    if (!byDomain[record.domain]) byDomain[record.domain] = []
    byDomain[record.domain].push(record)
  }
  const present = DOMAIN_ORDER.filter((d) => byDomain[d]?.length)

  return (
    <div className="clinical-view">
      <p className="section-help">
        Every record exactly as it came in -- nothing merged or grouped -- so
        you can compare it against your My health summary.
      </p>
      <SpecialtyFilter records={sourceRecords} value={specialty} onChange={setSpecialty} />
      <nav className="clinical-index" aria-label="Sections">
        {present.map((domain) => (
          <a key={domain} href={`#clinical-${domain}`}>
            {DOMAINS[domain].label} ({byDomain[domain].length})
          </a>
        ))}
      </nav>
      {present.map((domain) => (
        <section key={domain} id={`clinical-${domain}`}>
          <h2>
            {DOMAINS[domain].label} <span className="count">({byDomain[domain].length})</span>
          </h2>
          {domain === 'coverage' && <CoverageTable records={byDomain[domain]} />}
          {isDisplayOnly(domain) && <DocumentTable domain={domain} records={byDomain[domain]} />}
          {domain !== 'coverage' && !isDisplayOnly(domain) && (
            <ClinicalTable domain={domain} records={byDomain[domain]} assertions={assertions} />
          )}
        </section>
      ))}
    </div>
  )
}
