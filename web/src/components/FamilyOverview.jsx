import { useWorkspace } from '../state/WorkspaceContext'
import { DATASETS, DATASET_ORDER, IPS_DOMAINS, datasetHasData } from '../lib/datasets'

function counts(slice) {
  const ips = slice.sourceRecords.filter((r) => IPS_DOMAINS.includes(r.domain)).length
  return {
    clinical: slice.sourceRecords.length,
    ips,
    claims: slice.claimsData?.claims?.length ?? 0,
  }
}

// One card per patient, with what each has and the latest PIQI score per data set.
export default function FamilyOverview({ onOpen }) {
  const { patients, activeId, allData, selectPatient } = useWorkspace()

  return (
    <section className="import-section">
      <h2>Everyone in this workspace</h2>
      <p>Each person's data is kept completely separate. Open a person to see only their records.</p>
      <div className="family-grid">
        {patients.map((p) => {
          const slice = allData[p.id]
          const n = counts(slice)
          return (
            <article key={p.id} className={`family-card${p.id === activeId ? ' active' : ''}`}>
              <h3>{p.name}</h3>
              <ul className="family-stats">
                {DATASET_ORDER.map((key) => {
                  const has = datasetHasData(key, slice)
                  const score = slice.gatewayResults?.[key]?.score
                  const unit = key === 'claims' ? 'claims' : 'records'
                  return (
                    <li key={key}>
                      <strong>{DATASETS[key].label}:</strong>{' '}
                      {has ? `${n[key]} ${unit}` : 'no data'}
                      {score != null && ` · PIQI score ${score}`}
                    </li>
                  )
                })}
              </ul>
              <button
                type="button"
                onClick={() => {
                  selectPatient(p.id)
                  onOpen()
                }}
              >
                Open {p.name}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
