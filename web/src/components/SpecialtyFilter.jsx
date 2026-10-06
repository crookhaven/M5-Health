import { SPECIALTIES, specialtyOf } from '../lib/specialty'

// All / Medical / Dental / Vision / Hearing / Dermatology, showing only the
// specialties this patient has records for, with counts.
export default function SpecialtyFilter({ records, value, onChange }) {
  const counts = { all: records.length }
  for (const record of records) {
    const key = specialtyOf(record)
    counts[key] = (counts[key] ?? 0) + 1
  }
  const available = SPECIALTIES.filter((s) => counts[s.key])
  if (available.length <= 2) return null // only "All" and one specialty: nothing to filter

  return (
    <div className="dataset-switcher specialty-filter" role="group" aria-label="Specialty">
      {available.map((s) => (
        <button
          key={s.key}
          type="button"
          aria-pressed={value === s.key}
          className={value === s.key ? 'active' : ''}
          onClick={() => onChange(s.key)}
        >
          {s.label} ({counts[s.key]})
        </button>
      ))}
    </div>
  )
}
