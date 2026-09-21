import { useMemo, useState } from 'react'
import { buildAdvisorPrompt } from '../lib/marketplace/advisorPrompt'
import { downloadText } from '../lib/download'

const MAX_PLANS = 12

// Opt-in step: builds a short summary the patient can paste into Claude. The
// patient sees and controls exactly what is in it. Nothing is sent from here.
export default function PlanAdvisor({ summary, usage, rows, budget }) {
  const [open, setOpen] = useState(false)
  const [skipped, setSkipped] = useState(() => new Set())
  const [copied, setCopied] = useState(false)

  const toggle = (id) =>
    setSkipped((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const shown = rows.slice(0, MAX_PLANS)
  const prompt = useMemo(() => {
    const keep = (items) => items.filter((i) => !skipped.has(i.id)).map((i) => i.name)
    return buildAdvisorPrompt({
      include: {
        conditions: keep(summary.conditions),
        medications: keep(summary.medications),
        procedures: keep(summary.procedures),
      },
      usage,
      rows: shown,
      budget,
    })
  }, [summary, skipped, usage, shown, budget])

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (!open) {
    return (
      <section className="plan-advisor">
        <h3>Want Claude to look at your records and recommend plans?</h3>
        <p>
          This is optional. You choose what is included, and nothing leaves this app until you
          paste it into Claude yourself.
        </p>
        <button type="button" onClick={() => setOpen(true)}>
          Prepare my summary for Claude
        </button>
      </section>
    )
  }

  const groups = [
    ['Conditions', summary.conditions],
    ['Medicines', summary.medications],
    ['Past procedures', summary.procedures],
  ]

  return (
    <section className="plan-advisor">
      <h3>Prepare a summary for Claude</h3>
      <p>
        <strong>Included only if ticked:</strong> the items below, your expected care, and the
        plans you chose. <strong>Never included:</strong> your name, birth date, address or ID
        numbers.
      </p>
      {groups.map(([title, items]) => (
        <fieldset key={title} className="plan-picker">
          <legend>{title}</legend>
          {items.length === 0 && <p className="empty-state">Nothing in your records.</p>}
          {items.map((item) => (
            <label key={item.id} className="plan-option">
              <input type="checkbox" checked={!skipped.has(item.id)} onChange={() => toggle(item.id)} />{' '}
              {item.name}
            </label>
          ))}
        </fieldset>
      ))}
      {rows.length === 0 && <p className="empty-state">Choose at least one plan above first.</p>}
      {rows.length > MAX_PLANS && (
        <p className="local-note">Only the first {MAX_PLANS} chosen plans are included, to keep the summary short.</p>
      )}
      <label>
        What will be copied
        <textarea className="provider-note" readOnly rows={12} value={prompt} />
      </label>
      <div className="button-row">
        <button type="button" onClick={copy} disabled={rows.length === 0}>
          {copied ? 'Copied' : 'Copy summary'}
        </button>
        <button
          type="button"
          disabled={rows.length === 0}
          onClick={() => downloadText(prompt, 'plan-question-for-claude.txt', 'text/plain')}
        >
          Download as a file
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <p className="local-note">
        Paste it into a chat with Claude. Its answer is a starting point for your own decision, not
        insurance, medical or financial advice. Possible future needs are things to consider, not
        predictions.
      </p>
    </section>
  )
}
