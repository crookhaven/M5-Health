// Narrowing the patient-facing views down to a specific year, month or day --
// "what happened in June 2025," not just "everything, forever." Each domain
// keeps its date in a different field (the PIQI clinical domains each have
// their own DATE_FIELDS entry; display-only domains and coverage use their
// own 'date'/'effective_date'), so this is the one place that knows how to
// find "the date" for any record, and demographics -- which isn't a dated
// event at all -- is left out of date filtering entirely.

import { DATE_FIELDS } from './piqi/rules'

const DISPLAY_ONLY_DATE_FIELD = 'date'
const COVERAGE_DATE_FIELD = 'effective_date'

// Domains with no natural "when did this happen" date: always shown,
// whatever the date filter is set to.
export const DATELESS_DOMAINS = new Set(['demographics'])

function recordDateField(domain) {
  if (domain === 'coverage') return COVERAGE_DATE_FIELD
  if (DATE_FIELDS[domain]) return DATE_FIELDS[domain]
  return DISPLAY_ONLY_DATE_FIELD
}

export function recordDateValue(domain, data) {
  const value = data?.[recordDateField(domain)]
  return typeof value === 'string' ? value : undefined
}

function dateParts(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr ?? '')
  return m ? { year: m[1], month: m[2], day: m[3] } : undefined
}

export const ALL_DATES = { year: 'all', month: 'all', day: 'all' }

// true when `dateStr` falls within `filter` ('all' at any level means that
// level isn't narrowed further). A record with no date at all never matches
// a filter that's been narrowed past "all time".
export function matchesDateFilter(dateStr, filter) {
  if (!filter || filter.year === 'all') return true
  const parts = dateParts(dateStr)
  if (!parts) return false
  if (parts.year !== filter.year) return false
  if (filter.month !== 'all' && parts.month !== filter.month) return false
  if (filter.day !== 'all' && parts.day !== filter.day) return false
  return true
}

// Applies a date filter across a mixed list of source records, leaving
// dateless domains (demographics) untouched by it.
export function filterByDate(records, filter) {
  if (!filter || filter.year === 'all') return records
  return records.filter(
    (record) =>
      DATELESS_DOMAINS.has(record.domain) || matchesDateFilter(recordDateValue(record.domain, record.data), filter),
  )
}

// What years/months/days actually have data, for populating the filter's
// dropdowns -- cascading, so the month list only shows months that exist
// within the selected year, and likewise for day within month.
export function availableDateParts(records) {
  const years = new Set()
  const monthsByYear = new Map()
  const daysByYearMonth = new Map()
  for (const record of records) {
    if (DATELESS_DOMAINS.has(record.domain)) continue
    const parts = dateParts(recordDateValue(record.domain, record.data))
    if (!parts) continue
    years.add(parts.year)
    if (!monthsByYear.has(parts.year)) monthsByYear.set(parts.year, new Set())
    monthsByYear.get(parts.year).add(parts.month)
    const ymKey = `${parts.year}-${parts.month}`
    if (!daysByYearMonth.has(ymKey)) daysByYearMonth.set(ymKey, new Set())
    daysByYearMonth.get(ymKey).add(parts.day)
  }
  return { years, monthsByYear, daysByYearMonth }
}
