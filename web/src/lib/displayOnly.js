// What to show for the display-only domains (see lib/domains). Their record
// data is plain strings from lib/fhir/normalize.

export const DISPLAY_FIELDS = {
  encounters: [
    ['date', 'Start'],
    ['endDate', 'End'],
    ['encounterClass', 'Class'],
    ['status', 'Status'],
    ['provider', 'Provider'],
    ['location', 'Location'],
    ['facility', 'Facility'],
    ['reason', 'Reason'],
    ['diagnosis', 'Diagnosis'],
  ],
  careTeam: [
    ['date', 'Since'],
    ['status', 'Status'],
    ['organization', 'Organization'],
    ['members', 'Members'],
  ],
  contacts: [
    ['relationship', 'Relationship'],
    ['phone', 'Phone'],
    ['email', 'Email'],
    ['address', 'Address'],
  ],
  imaging: [
    ['date', 'Date'],
    ['modality', 'Modality'],
    ['bodySite', 'Body site'],
    ['procedure', 'Procedure'],
    ['series', 'Series'],
    ['images', 'Images'],
    ['interpreter', 'Read by'],
    ['status', 'Status'],
  ],
  clinicalNotes: [
    ['noteType', 'Type'],
    ['date', 'Date'],
    ['author', 'Author'],
    ['organization', 'Organization'],
    ['encounter', 'Encounter'],
    ['status', 'Status'],
    ['format', 'Format'],
  ],
  referrals: [
    ['date', 'Ordered'],
    ['category', 'Category'],
    ['status', 'Status'],
    ['priority', 'Priority'],
    ['requester', 'Ordered by'],
    ['performer', 'Referred to'],
    ['reason', 'Reason'],
  ],
}

// A short paragraph shown under the fields.
export const SUMMARY_FIELD = { imaging: 'conclusion', clinicalNotes: 'summary', referrals: 'summary' }

// The full document text, shown collapsed, with its companion fields.
export const DOCUMENT_FIELDS = {
  imaging: { text: 'reportText', truncated: 'reportTruncated', omitted: 'reportOmitted', url: 'reportUrl', label: 'report' },
  clinicalNotes: { text: 'text', truncated: 'truncated', omitted: 'omitted', url: 'url', label: 'note' },
}

export function displayDate(value) {
  return typeof value === 'string' ? value.slice(0, 10) : value
}

const DATE_KEYS = new Set(['date', 'endDate'])

// Populated fields, leaving out any that just repeat the card title (some
// sources put the same text in an encounter's type and class).
export function displayOnlyFields(domain, data) {
  return (DISPLAY_FIELDS[domain] ?? [])
    .map(([field, label]) => [label, DATE_KEYS.has(field) ? displayDate(data[field]) : data[field]])
    .filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== data.title)
}

// Newest first; undated records last.
export function sortByDateDesc(records) {
  return [...records].sort((a, b) => (b.data.date ?? '').localeCompare(a.data.date ?? ''))
}

const PDF_TEXT_CHARS = 2000

export function displayOnlyLines(domain, data) {
  const lines = displayOnlyFields(domain, data).map(([label, value]) => `${label}: ${value}`)
  const summary = data[SUMMARY_FIELD[domain]]
  if (summary) lines.push(summary)
  const doc = DOCUMENT_FIELDS[domain]
  const text = doc && data[doc.text]
  if (text) {
    lines.push(text.length > PDF_TEXT_CHARS ? `${text.slice(0, PDF_TEXT_CHARS)}... (full ${doc.label} in the app)` : text)
  }
  return lines
}
