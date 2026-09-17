const NETWORK_TIERS = ['In-Network', 'Out-of-Network']
const FAMILY_COSTS = ['Individual', 'Family']

function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '—'
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function buildAmountLookup(entries) {
  const lookup = {}
  for (const entry of entries) {
    lookup[`${entry.network_tier}|${entry.family_cost}`] = entry.amount
  }
  return lookup
}

function AmountTable({ title, entries }) {
  const lookup = buildAmountLookup(entries)
  return (
    <div className="amount-card">
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th scope="col"></th>
            {NETWORK_TIERS.map((tier) => (
              <th scope="col" key={tier}>
                {tier}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FAMILY_COSTS.map((familyCost) => (
            <tr key={familyCost}>
              <th scope="row">{familyCost}</th>
              {NETWORK_TIERS.map((tier) => (
                <td key={tier}>
                  {formatCurrency(lookup[`${tier}|${familyCost}`])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function costSharingFor(benefit, tier) {
  return benefit.cost_sharings.find((cs) => cs.network_tier === tier)
}

function BenefitsTable({ benefits }) {
  return (
    <div className="benefits-table-wrap">
      <table className="benefits-table">
        <thead>
          <tr>
            <th scope="col">Benefit</th>
            {NETWORK_TIERS.map((tier) => (
              <th scope="col" key={tier}>
                {tier}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {benefits.map((benefit) => (
            <tr key={benefit.name}>
              <th scope="row">
                <div className="benefit-name">{benefit.name}</div>
                {benefit.explanation && (
                  <div className="benefit-note">{benefit.explanation}</div>
                )}
                {benefit.has_limits && (
                  <div className="benefit-note">
                    Limit: {benefit.limit_quantity} {benefit.limit_unit}
                    {benefit.limit_quantity === 1 ? '' : 's'} per year
                  </div>
                )}
              </th>
              {NETWORK_TIERS.map((tier) => {
                const cs = costSharingFor(benefit, tier)
                return (
                  <td key={tier}>
                    {cs ? cs.display_string : 'Not covered'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const SOURCE_TYPE_LABELS = {
  sample: 'Sample data',
  'file-upload': 'Uploaded file',
}

export default function CoverageScreen({ record }) {
  const plan = record.data
  const { source } = record

  return (
    <div className="coverage-screen">
      <header className="plan-header">
        <h1>{plan.plan_name ?? 'Untitled plan'}</h1>
        <dl className="plan-meta">
          <div>
            <dt>Group</dt>
            <dd>
              {plan.group_name ?? '—'}
              {plan.group_number ? ` (${plan.group_number})` : ''}
            </dd>
          </div>
          <div>
            <dt>Plan type</dt>
            <dd>
              {plan.type ?? '—'}
              {plan.hsa_eligible ? ' · HSA-eligible' : ''}
            </dd>
          </div>
          <div>
            <dt>Effective date</dt>
            <dd>{plan.effective_date ?? '—'}</dd>
          </div>
        </dl>
      </header>

      <section className="summary-grid">
        <AmountTable title="Deductible" entries={plan.deductibles ?? []} />
        <AmountTable
          title="Out-of-Pocket Maximum"
          entries={plan.moops ?? []}
        />
      </section>

      <section>
        <h2>Benefits</h2>
        <BenefitsTable benefits={plan.benefits ?? []} />
      </section>

      <footer className="source-note">
        <div>
          {SOURCE_TYPE_LABELS[source.type] ?? source.type} ·{' '}
          {source.documentName} · imported{' '}
          {new Date(source.importedAt).toLocaleString()}
        </div>
        {plan.source_document && <div>Document: {plan.source_document}</div>}
      </footer>
    </div>
  )
}
