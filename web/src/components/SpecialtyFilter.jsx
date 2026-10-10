import { SPECIALTIES, specialtyOf } from '../lib/specialty'

// All / Medical / Dental / Vision / Hearing / Dermatology, showing only the
// specialties this patient has records for, with counts. `countFn`, when
// given, counts what a screen actually displays (e.g. the Dashboard's
// deduped/grouped card count) instead of the raw number of source records --
// otherwise a summary screen that now shows a handful of cards still wears a
// badge claiming thousands, which is exactly the "too many records" feeling
// grouping was meant to fix.
export default function SpecialtyFilter({ records, value, onChange, countFn }) {
  const count = countFn ?? ((recs) => recs.length)
  const bySpecialty = new Map()
  for (const record of records) {
    const key = specialtyOf(record)
    if (!bySpecialty.has(key)) bySpecialty.set(key, [])
    bySpecialty.get(key).push(record)
  }
  const counts = { all: count(records) }
  for (const [key, recs] of bySpecialty) counts[key] = count(recs)
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
