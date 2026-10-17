import { STATUS } from '../lib/rtb/useCases'

// One Real-Time Benefits MVP (medical or pharmacy): the event's use cases, how
// required each item is, and where the app stands on it today.
export default function RtbPanel({ program }) {
  return (
    <div className="import-panel">
      <section className="import-section">
        <h2>{program.title}</h2>
        <p>{program.intro}</p>
        <ul>
          {program.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p className="section-help">Source: {program.source}</p>
      </section>
      {program.useCases.map((uc) => (
        <section className="import-section" key={uc.title}>
          <h2>{uc.title}</h2>
          <ul className="scenario-list">
            {uc.items.map(([level, item, status, detail]) => (
              <li key={item}>
                <strong>{level}</strong> {item}: {STATUS[status]}
                {detail ? `. ${detail}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
