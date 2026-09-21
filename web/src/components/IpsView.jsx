import { effectiveData } from '../lib/piqi/engine'
import { displayText } from '../lib/piqi/attributeTypes'
import { FIELD_LABELS } from '../lib/piqi/rules'
import { IPS_DOMAINS, IPS_FIELDS, IPS_SECTION_TITLES } from '../lib/datasets'

function Section({ domain, records, assertions }) {
  const fields = IPS_FIELDS[domain]
  return (
    <section className="ips-section">
      <h3>
        {IPS_SECTION_TITLES[domain]} <span className="count">({records.length})</span>
      </h3>
      {records.length === 0 ? (
        <p className="empty-state">
          Nothing in this section. An IPS needs this section to be present, even if it says
          there is nothing to report.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="class-table">
            <thead>
              <tr>
                {fields.map((f) => (
                  <th key={f} scope="col">
                    {FIELD_LABELS[f] ?? f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const { merged } = effectiveData(record, assertions)
                return (
                  <tr key={record.id}>
                    {fields.map((f) => {
                      const text = displayText(merged[f])
                      return (
                        <td key={f} className={text ? undefined : 'missing-cell'}>
                          {text ?? 'missing'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// Your records grouped as the sections of an International Patient Summary,
// showing the fields the IPS rubric checks, with gaps marked.
export default function IpsView({ sourceRecords, assertions }) {
  const has = sourceRecords.some((r) => IPS_DOMAINS.includes(r.domain))
  if (!has) {
    return (
      <p className="empty-state">
        No IPS data yet. Import an IPS bundle, or any health record with a patient, allergies,
        medications or conditions, and it will appear here in IPS sections.
      </p>
    )
  }
  return (
    <div className="ips-view">
      <p>
        These are your records arranged as the sections of an International Patient Summary,
        with the fields the IPS rubric checks. &quot;Missing&quot; marks a gap the score may
        flag.
      </p>
      {IPS_DOMAINS.map((domain) => (
        <Section
          key={domain}
          domain={domain}
          records={sourceRecords.filter((r) => r.domain === domain)}
          assertions={assertions}
        />
      ))}
    </div>
  )
}
