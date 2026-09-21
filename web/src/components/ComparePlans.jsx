import { useMemo, useState } from 'react'
import sampleFile from '../data/sample_marketplace_plans.json'
import { COMPARE_BENEFITS, SBC_EXAMPLES, parsePlansFile } from '../lib/marketplace/normalize'
import {
  DEFAULT_USAGE,
  SERVICES,
  coverageScores,
  estimateYear,
  medicationCoverage,
  pickPlans,
} from '../lib/marketplace/estimate'
import { summarizePatient } from '../lib/marketplace/patientSummary'
import { useWorkspace } from '../state/WorkspaceContext'
import PlanAdvisor from './PlanAdvisor'

const NOT_LISTED = 'Not listed'
const DEFAULT_SHOWN = 4
const METAL_ORDER = ['Bronze', 'Expanded Bronze', 'Silver', 'Gold', 'Platinum', 'Catastrophic']

const money = (n) =>
  n === null || n === undefined ? NOT_LISTED : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const money2 = (n) =>
  n === null || n === undefined ? NOT_LISTED : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

const sample = parsePlansFile(JSON.stringify(sampleFile))

const DOCUMENT_LINKS = [
  ['benefits', 'Benefits'],
  ['brochure', 'Brochure'],
  ['formulary', 'Drug list'],
  ['network', 'Doctors and hospitals'],
]

// "$7,500", or "$7,500 medical + $0 drugs" when the plan keeps drugs apart.
function withDrugs(medical, drug) {
  if (drug === null || drug === undefined) return money(medical)
  return `${money(medical)} medical + ${money(drug)} drugs`
}

function DocLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

function documentLinks(plan) {
  const items = DOCUMENT_LINKS.filter(([key]) => plan.links[key])
  if (items.length === 0) return NOT_LISTED
  return items.map(([key, text], i) => (
    <span key={key}>
      {i > 0 ? ' \u00b7 ' : ''}
      <DocLink href={plan.links[key]}>{text}</DocLink>
    </span>
  ))
}

function medText(med) {
  if (med.total === 0) return 'No coded medicines to check'
  if (!med.checked) return 'Not checked yet'
  const extra = [
    med.missing.length ? `not covered: ${med.missing.join(', ')}` : null,
    med.unknown.length ? `unknown: ${med.unknown.join(', ')}` : null,
  ].filter(Boolean)
  return `${med.covered} of ${med.total}${extra.length ? ` (${extra.join('; ')})` : ''}`
}

// Side-by-side comparison of Marketplace plans, with an estimated yearly cost and
// coverage score for the patient's own records. Works from a plans file saved from
// the CMS Marketplace API; until one is loaded it shows invented sample plans.
export default function ComparePlans() {
  const { sourceRecords, assertions } = useWorkspace()
  const [data, setData] = useState(sample)
  const [source, setSource] = useState('sample')
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(() => sample.plans.slice(0, DEFAULT_SHOWN).map((p) => p.id))
  const [metals, setMetals] = useState([])
  const [edits, setEdits] = useState({})
  const [budgetText, setBudgetText] = useState('')
  const [copiedLine, setCopiedLine] = useState(false)

  const summary = useMemo(() => summarizePatient(sourceRecords, assertions), [sourceRecords, assertions])
  const usage = { ...DEFAULT_USAGE, genericDrugs: summary.medications.length * 12, ...edits }
  const budget = budgetText.trim() === '' || Number.isNaN(Number(budgetText)) ? null : Number(budgetText)

  const usageKey = JSON.stringify(usage)
  const rowsAll = useMemo(() => {
    const base = data.plans.map((plan) => ({
      plan,
      est: estimateYear(plan, usage),
      med: medicationCoverage(plan, summary.medications, data.drugCoverage),
    }))
    const scores = coverageScores(base, base.map((r) => r.med))
    return base.map((r, i) => ({ ...r, score: scores[i] }))
  }, [data, summary, usageKey])

  const metalLevels = [...new Set(data.plans.map((p) => p.metalLevel).filter(Boolean))].sort(
    (a, b) => (METAL_ORDER.indexOf(a) + 1 || 99) - (METAL_ORDER.indexOf(b) + 1 || 99),
  )
  const visible = rowsAll.filter((r) => metals.length === 0 || metals.includes(r.plan.metalLevel))
  const chosen = rowsAll.filter((r) => selected.includes(r.plan.id))
  const picks = pickPlans(visible, budget)
  const isSample = source === 'sample'
  const sbcCount = data.plans.filter((p) => p.sbc.url).length

  function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parsePlansFile(String(reader.result))
        setData(parsed)
        setSource(file.name)
        setSelected(parsed.plans.slice(0, DEFAULT_SHOWN).map((p) => p.id))
        setMetals([])
        setError(null)
      } catch (err) {
        setError(err.message)
      }
    }
    reader.onerror = () => setError('Could not read that file.')
    reader.readAsText(file)
    event.target.value = ''
  }

  const toggle = (id) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))
  const toggleMetal = (m) =>
    setMetals((current) => (current.includes(m) ? current.filter((x) => x !== m) : [...current, m]))

  const rxcuis = [...new Set(summary.medications.filter((m) => m.rxcui).map((m) => m.rxcui))]
  const drugLine = `$rxcuis = ${rxcuis.map((c) => `'${c}'`).join(',')}`
  async function copyLine() {
    try {
      await navigator.clipboard.writeText(drugLine)
      setCopiedLine(true)
    } catch {
      setCopiedLine(false)
    }
  }

  const ROWS = [
    { label: 'Insurer', get: ({ plan }) => plan.issuer ?? NOT_LISTED },
    { label: 'Metal level', get: ({ plan }) => plan.metalLevel ?? NOT_LISTED },
    { label: 'Plan type', get: ({ plan }) => plan.type ?? NOT_LISTED },
    { label: 'Monthly premium', get: ({ plan }) => money2(plan.premium) },
    {
      label: 'Deductible (you, in-network)',
      get: ({ plan }) => withDrugs(plan.deductible, plan.drugDeductible),
    },
    {
      label: 'Out-of-pocket maximum (you, in-network)',
      get: ({ plan }) => withDrugs(plan.moop, plan.drugMoop),
    },
    ...COMPARE_BENEFITS.map((b) => ({ label: b.label, get: ({ plan }) => plan.benefits[b.key] ?? NOT_LISTED })),
    {
      label: 'Summary of Benefits and Coverage (SBC)',
      get: ({ plan }) => (plan.sbc.url ? <DocLink href={plan.sbc.url}>Open the SBC</DocLink> : NOT_LISTED),
    },
    ...SBC_EXAMPLES.map((ex) => ({
      label: `SBC example: ${ex.label} (you pay)`,
      get: ({ plan }) => money(plan.sbc.examples[ex.key]),
    })),
    { label: 'Other plan documents', get: ({ plan }) => documentLinks(plan) },
    { label: 'HSA eligible', get: ({ plan }) => (plan.hsaEligible === null ? NOT_LISTED : plan.hsaEligible ? 'Yes' : 'No') },
    { label: 'Quality rating (stars of 5)', get: ({ plan }) => plan.qualityRating ?? NOT_LISTED },
    { label: 'National network', get: ({ plan }) => (plan.hasNationalNetwork === null ? NOT_LISTED : plan.hasNationalNetwork ? 'Yes' : 'No') },
    { label: 'Estimated care cost for the year (your usage)', get: ({ est }) => money(est.outOfPocket), estimate: true },
    { label: 'Estimated total for the year (premiums + care)', get: ({ est }) => money(est.total), estimate: true },
    { label: 'Your medicines covered', get: ({ med }) => medText(med), estimate: true },
    { label: 'Coverage score (0-100)', get: ({ score }) => score.total, estimate: true },
  ]

  return (
    <section className="import-section compare-plans">
      <h2>Compare Marketplace plans</h2>
      {isSample ? (
        <p className="local-note" role="note">
          Showing invented sample plans. These are not real plans or prices. Load a plans file
          saved from the CMS Marketplace API to compare real ones.
        </p>
      ) : (
        <p className="local-note">
          Showing {data.plans.length} plans from {source}.{' '}
          {sbcCount > 0
            ? `SBC links found for ${sbcCount} of ${data.plans.length} plans.`
            : 'This file has no SBC links. Run the latest fetch script to add them.'}
        </p>
      )}
      {data.household && (
        <p>
          <strong>{data.household.label ?? 'Household'}:</strong> age {data.household.age},{' '}
          {String(data.household.gender ?? '').toLowerCase()},{' '}
          {data.household.uses_tobacco ? 'uses tobacco' : 'non-smoker'}, ZIP {data.household.zipcode}.{' '}
          {data.household.source}
        </p>
      )}
      <div className="button-row">
        <label>
          Load plans file (.json){' '}
          <input type="file" accept=".json,application/json" onChange={handleFile} />
        </label>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}

      {metalLevels.length > 1 && (
        <fieldset className="plan-picker">
          <legend>Show only these metal levels (none ticked shows all)</legend>
          {metalLevels.map((m) => (
            <label key={m} className="plan-option inline">
              <input type="checkbox" checked={metals.includes(m)} onChange={() => toggleMetal(m)} /> {m}
            </label>
          ))}
        </fieldset>
      )}

      <fieldset className="plan-picker">
        <legend>
          Choose plans to compare ({chosen.length} chosen, {visible.length} shown)
        </legend>
        <div className="button-row">
          <button type="button" onClick={() => setSelected(visible.map((r) => r.plan.id))}>
            Select all shown
          </button>
          <button type="button" onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
        {visible.map(({ plan }) => (
          <label key={plan.id} className="plan-option">
            <input type="checkbox" checked={selected.includes(plan.id)} onChange={() => toggle(plan.id)} />{' '}
            {plan.name}
            {plan.metalLevel ? ` (${plan.metalLevel})` : ''}
          </label>
        ))}
      </fieldset>

      <fieldset className="plan-picker">
        <legend>Care you expect in a year (change these to fit you)</legend>
        {SERVICES.map((s) => (
          <label key={s.key} className="plan-option inline">
            {s.label}{' '}
            <input
              type="number"
              min="0"
              className="usage-input"
              value={usage[s.key]}
              onChange={(e) => setEdits((cur) => ({ ...cur, [s.key]: e.target.value }))}
            />
          </label>
        ))}
        <label className="plan-option">
          Yearly budget for premiums plus care (optional){' '}
          <input
            type="number"
            min="0"
            className="usage-input"
            value={budgetText}
            onChange={(e) => setBudgetText(e.target.value)}
          />
        </label>
        <p className="local-note">
          Estimates use typical prices ({SERVICES.map((s) => `${s.label.split(' (')[0].toLowerCase()} $${s.price}`).join(', ')})
          and each plan&apos;s deductible, copays and out-of-pocket maximum. They are not quotes.
        </p>
      </fieldset>

      {rxcuis.length > 0 && !data.drugCoverage && (
        <p className="local-note">
          To check whether plans cover your medicines, paste this line into PowerShell just before
          the fetch script, then load the new file:{' '}
          <code>{drugLine}</code>{' '}
          <button type="button" onClick={copyLine}>
            {copiedLine ? 'Copied' : 'Copy line'}
          </button>
        </p>
      )}

      {(picks.lowest || picks.bestCoverage) && (
        <div className="picks" aria-label="Quick picks">
          {picks.lowest && (
            <p>
              <strong>Lowest estimated cost{rxcuis.length && data.drugCoverage ? ' that covers all your medicines' : ''}:</strong>{' '}
              {picks.lowest.plan.name}, about {money(picks.lowest.est.total)} for the year.
            </p>
          )}
          {picks.bestCoverage && (
            <p>
              <strong>Best coverage{budget !== null ? ` within ${money(budget)}` : ''}:</strong>{' '}
              {picks.bestCoverage.plan.name}, coverage score {picks.bestCoverage.score.total}, about{' '}
              {money(picks.bestCoverage.est.total)} for the year.
            </p>
          )}
          <p className="local-note">
            These come from your usage numbers above. They are estimates to help you compare, not advice.
          </p>
        </div>
      )}

      {chosen.length === 0 ? (
        <p className="empty-state">Choose at least one plan above.</p>
      ) : (
        <div className="table-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col">&nbsp;</th>
                {chosen.map(({ plan }) => (
                  <th scope="col" key={plan.id}>
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className={row.estimate ? 'estimate-row' : undefined}>
                  <th scope="row">{row.label}</th>
                  {chosen.map((r) => (
                    <td key={r.plan.id}>{row.get(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PlanAdvisor summary={summary} usage={usage} rows={chosen} budget={budget} />

      <p className="local-note">
        Costs shown are for one person, in-network, as the Marketplace API reports them. Check the
        plan&apos;s own documents before choosing. This is not advice.
      </p>
      <p className="local-note">
        The SBC examples are the standard scenarios every insurer must show (having a baby, managing
        diabetes, treating a simple fracture). They help you compare plans side by side, but they are
        not an estimate for you. Open the SBC for the full details.
      </p>
    </section>
  )
}
