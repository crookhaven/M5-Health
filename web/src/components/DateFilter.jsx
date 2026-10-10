import { useMemo } from 'react'
import { ALL_DATES, availableDateParts } from '../lib/dateFilter'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Narrows the records shown down to a year, a year+month, or an exact day --
// sitting next to the specialty filter. Nothing is removed from the record
// grouping/dedup logic by this; it just shrinks the input to it, so a
// grouped card like "Obesity, recorded 15 times" becomes "recorded 3 times"
// once you've narrowed to a single year, and shows every instance once
// you've narrowed to a single day.
export default function DateFilter({ records, value, onChange }) {
  const { years, monthsByYear, daysByYearMonth } = useMemo(() => availableDateParts(records), [records])
  const sortedYears = useMemo(() => [...years].sort((a, b) => b.localeCompare(a)), [years])

  if (sortedYears.length === 0) return null

  const months = value.year === 'all' ? [] : [...(monthsByYear.get(value.year) ?? [])].sort()
  const days =
    value.year === 'all' || value.month === 'all'
      ? []
      : [...(daysByYearMonth.get(`${value.year}-${value.month}`) ?? [])].sort()

  return (
    <div className="date-filter" role="group" aria-label="Filter by date">
      <label>
        Date
        <select
          value={value.year}
          onChange={(e) => onChange({ year: e.target.value, month: 'all', day: 'all' })}
        >
          <option value="all">All time</option>
          {sortedYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      {value.year !== 'all' && months.length > 0 && (
        <label>
          Month
          <select value={value.month} onChange={(e) => onChange({ ...value, month: e.target.value, day: 'all' })}>
            <option value="all">All months</option>
            {months.map((mo) => (
              <option key={mo} value={mo}>
                {MONTH_NAMES[Number(mo) - 1] ?? mo}
              </option>
            ))}
          </select>
        </label>
      )}
      {value.year !== 'all' && value.month !== 'all' && days.length > 0 && (
        <label>
          Day
          <select value={value.day} onChange={(e) => onChange({ ...value, day: e.target.value })}>
            <option value="all">All days</option>
            {days.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      )}
      {value.year !== 'all' && (
        <button type="button" className="date-filter-clear" onClick={() => onChange(ALL_DATES)}>
          Clear
        </button>
      )}
    </div>
  )
}
