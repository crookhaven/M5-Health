import { useState } from 'react'
import { InsurancePlanError, formatAmount, formatCost, formatLimit, parseInsurancePlan } from '../lib/insurancePlan/parse'
import { ANSWER_TEXT, EXTRA_BENEFITS, answerExtraBenefit } from '../lib/insurancePlan/extraBenefits'
import { PLAN_GROUPS, PLAN_LIBRARY, PLAN_LIBRARY_SOURCE } from '../lib/insurancePlan/library'
import { fetchFromGitHub } from '../lib/openSyntheticPatients'

function requirementText(req) {
  if (!req) return ''
  return /authori[sz]/i.test(req) ? 'Prior authorization required' : req.replace(/\s*\([^)]*\)\.?$/, '')
}

// RTB medical use cases 1, 3 and 4 answered from a FHIR InsurancePlan: what the
// plan covers and what the member pays, its limits, and whether it covers an
// extra benefit such as hearing aids.
export default function PlanBenefits() {
  const [plan, setPlan] = useState(null)
  const [source, setSource] = useState(null)
  const [choice, setChoice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function show(parsed, from) {
    setPlan(parsed)
    setSource(from)
    setError(null)
  }

  async function loadExample(url) {
    setChoice(url)
    if (!url) return
    setBusy(true)
    try {
      const entry = PLAN_LIBRARY.find((p) => p.url === url)
      show(parseInsurancePlan(await fetchFromGitHub(url)), `Benefit Plan Standard example: ${entry?.label ?? url}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        show(parseInsurancePlan(String(reader.result)), file.name)
        setChoice('')
      } catch (err) {
        setError(err instanceof InsurancePlanError ? err.message : `Could not read that plan: ${err.message}`)
      }
    }
    reader.onerror = () => setError('Could not read that file.')
    reader.readAsText(file)
    event.target.value = ''
  }

  return (
    <section className="import-section">
      <h2>Try it: a plan&apos;s benefits from FHIR</h2>
      <p>
        Pick a Medicare Advantage, ACA or employer plan, or load your own FHIR InsurancePlan (CARIN Digital
        Insurance Card SBC profile). The examples are real plans published by the{' '}
        <a href={PLAN_LIBRARY_SOURCE} target="_blank" rel="noreferrer">
          Benefit Plan Standard
        </a>{' '}
        project; the Medicare Advantage ones come from the CMS Plan Benefit Package files.
      </p>
      <div className="button-row">
        <label>
          Example plan{' '}
          <select value={choice} onChange={(e) => loadExample(e.target.value)} disabled={busy}>
            <option value="">Choose a plan…</option>
            {PLAN_GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {PLAN_LIBRARY.filter((p) => p.group === g).map((p) => (
                  <option key={p.url} value={p.url}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          Or load an InsurancePlan (.json){' '}
          <input type="file" accept=".json,application/json" onChange={handleFile} />
        </label>
      </div>
      {busy && <p className="import-message">Loading the plan from GitHub…</p>}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {plan && <PlanView plan={plan} source={source} />}
    </section>
  )
}

function PlanView({ plan, source }) {
  const answers = EXTRA_BENEFITS.map((x) => ({ extra: x, answer: answerExtraBenefit(plan, x) }))
  const listedOnly = plan.extras.filter((x) => !EXTRA_BENEFITS.some((e) => e.key === x.key || e.match.test(x.name)))
  return (
    <div className="plan-benefits">
      <h3>{plan.name}</h3>
      <p className="section-help">
        {[plan.issuer, plan.marketLabel, plan.planYear ? `plan year ${plan.planYear}` : null, plan.contractPlan ? `contract-plan ${plan.contractPlan}` : null]
          .filter(Boolean)
          .join(' · ')}
        <br />
        Source: {source}. Every answer below is for plan year {plan.planYear ?? 'not stated'}.
      </p>

      {plan.general.length > 0 && (
        <>
          <h4>Deductibles and out-of-pocket maximums</h4>
          <ul>
            {plan.general.map((g, i) => (
              <li key={i}>
                {g.label}
                {g.network && !g.label.toLowerCase().includes('network') ? ` (${g.network})` : ''}: {formatAmount(g.amount)}
              </li>
            ))}
          </ul>
        </>
      )}

      <h4>4. Does my plan cover hearing aids? (and other extra benefits)</h4>
      <div className="table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">Benefit</th>
              <th scope="col">Answer</th>
              <th scope="col">What you pay</th>
              <th scope="col">Limits</th>
            </tr>
          </thead>
          <tbody>
            {answers.map(({ extra, answer }) => (
              <tr key={extra.key}>
                <th scope="row">{extra.label}</th>
                <td>{ANSWER_TEXT[answer.status]}</td>
                <td>{answer.costs.map((c) => `${c.network}: ${c.text}`).join('; ') || '—'}</td>
                <td>{answer.limits.join('; ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {answers.some(({ answer }) => answer.status === 'listed') && (
        <p className="local-note">
          &ldquo;Listed by the plan&rdquo; means the source data has this benefit, but the CARIN SBC profile has no
          category code for it yet, so its cost and limits travel only as a name in an extension. Adding
          these codes is one of the change requests for the Digital Insurance Card IG.
        </p>
      )}

      <h4>1 and 3. What the plan covers, what you pay, and its limits</h4>
      <div className="table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">Service</th>
              <th scope="col">What you pay</th>
              <th scope="col">Limits</th>
              <th scope="col">Rules</th>
            </tr>
          </thead>
          <tbody>
            {plan.benefits.map((b, i) => (
              <tr key={i}>
                <th scope="row">{b.name}</th>
                <td>
                  {b.costs.length
                    ? b.costs.map((c, j) => (
                        <div key={j}>
                          {c.network}: {formatCost(c)}
                          {c.qualifiers.length && !c.network.includes(c.qualifiers[0]) ? ` (${c.qualifiers.join(', ')})` : ''}
                        </div>
                      ))
                    : 'Not in the plan data'}
                </td>
                <td>{b.limits.map(formatLimit).join('; ') || '—'}</td>
                <td>
                  {[requirementText(b.requirement), b.coverageBasis === 'medicare_covered' ? 'Medicare-covered service' : '']
                    .filter(Boolean)
                    .join('; ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {plan.excluded.length > 0 && (
        <>
          <h4>Services the plan excludes</h4>
          <p>{plan.excluded.join(', ')}</p>
        </>
      )}
      {listedOnly.length > 0 && (
        <>
          <h4>Other benefits the plan lists (no cost data in the FHIR profile yet)</h4>
          <p>{listedOnly.map((x) => x.name).join(', ')}</p>
        </>
      )}
    </div>
  )
}
