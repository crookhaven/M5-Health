import { SERVICES } from './estimate'

const money = (n) => (n === null || n === undefined ? 'not listed' : `$${Math.round(n).toLocaleString('en-US')}`)

// Builds the text a patient can paste into Claude. It contains only what the
// patient chose to include: no name, birth date, address or identifiers.
// `include` is { conditions: [names], medications: [names], procedures: [names] }.
export function buildAdvisorPrompt({ include, usage, rows, budget }) {
  const list = (items) => (items.length ? items.map((x) => `- ${x}`).join('\n') : '- (none shared)')

  const usageLines = SERVICES.filter((s) => Number(usage[s.key]) > 0).map(
    (s) => `- ${s.label}: ${usage[s.key]}`,
  )

  const planBlocks = rows.map(({ plan, est, med, score }, i) => {
    const lines = [
      `Plan ${i + 1}: ${plan.name}${plan.issuer ? ` (${plan.issuer})` : ''}`,
      `- Metal level / type: ${plan.metalLevel ?? 'not listed'} / ${plan.type ?? 'not listed'}`,
      `- Monthly premium: ${money(plan.premium)}`,
      `- Deductible (you, in-network): ${money(plan.deductible)}`,
      `- Out-of-pocket maximum (you, in-network): ${money(plan.moop)}`,
    ]
    for (const [key, label] of [
      ['primaryCare', 'Primary care visit'],
      ['specialist', 'Specialist visit'],
      ['urgentCare', 'Urgent care'],
      ['emergency', 'Emergency room'],
      ['genericDrugs', 'Generic drugs'],
      ['mentalHealth', 'Mental health visit'],
    ]) {
      lines.push(`- ${label}: ${plan.benefits[key] ?? 'not listed'}`)
    }
    lines.push(
      med.checked
        ? `- Your medicines covered: ${med.covered} of ${med.total}${med.missing.length ? ` (not covered: ${med.missing.join(', ')})` : ''}`
        : '- Your medicines covered: not checked',
    )
    lines.push(`- App estimate of total yearly cost with the usage above: ${money(est.total)}`)
    lines.push(`- App coverage score (0-100, relative to these plans): ${score.total}`)
    return lines.join('\n')
  })

  return [
    'I am comparing US health insurance Marketplace plans. Please act as a careful, plain-spoken guide. You are not my insurance broker, doctor or financial advisor, and you should say so once, briefly.',
    '',
    'What I want: the plan that gives me the best coverage for the least cost, with your reasoning.',
    '',
    '## My health information (shared on purpose, nothing else is included)',
    'Conditions:',
    list(include.conditions),
    'Medicines:',
    list(include.medications),
    'Past procedures:',
    list(include.procedures),
    '',
    '## Care I expect in a year (assumptions I can change)',
    usageLines.length ? usageLines.join('\n') : '- (no usage entered)',
    budget !== null && budget !== undefined ? `\nMy estimated yearly budget: ${money(budget)}` : '',
    '',
    '## Plans to compare (numbers from the CMS Marketplace API; estimates from my app)',
    planBlocks.join('\n\n'),
    '',
    '## What to give me',
    '1. Your top pick for lowest total cost, and why.',
    '2. Your top pick for best coverage, and why.',
    '3. Possible future needs: based only on my conditions, name a few things I might need more of over time (for example specialist visits, tests, supplies or procedures), and say when paying a higher premium for a lower out-of-pocket maximum or stronger specialist coverage could be worth it. Word these as possibilities to consider, never as predictions or diagnoses, and say what each one is based on.',
    '4. The main trade-offs between your two picks.',
    '5. Anything you could not judge from this information (for example whether my doctors are in-network), so I know what to check.',
    '',
    'Use only the plan numbers above. Do not invent prices or benefits. If something is missing, say so.',
  ]
    .filter((x) => x !== undefined)
    .join('\n')
}
