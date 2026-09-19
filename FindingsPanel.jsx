import { useState } from 'react'
import { useWorkspace } from '../state/WorkspaceContext'
import { FIELD_LABELS } from '../lib/piqi/rules'
import { wrapAssertionValue } from '../lib/piqi/engine'
import { withGuidance, buildProviderNote, ROUTE_FIX } from '../lib/piqi/guidance'
import { downloadText } from '../lib/download'

const DIMENSION_LABELS = {
  completeness: 'Completeness',
  duplication: 'Duplication',
  consistency: 'Consistency',
  provenance: 'Provenance',
  timeliness: 'Timeliness',
}

const DIMENSION_ORDER = ['completeness', 'duplication', 'consistency', 'provenance', 'timeliness']

const DECISION_LABELS = {
  reviewed: 'Reviewed',
  ignore_for_now: 'Ignored for now',
  remind_later: 'Remind me later',
  flag_provider: 'Flagged for your provider',
}

function ReviewForm({ finding, onSubmit, onCancel }) {
  const [value, setValue] = useState('')
  const fieldLabel = FIELD_LABELS[finding.field] ?? finding.field ?? 'value'
  return (
    <form
      className="review-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(value)
      }}
    >
      <label className="visually-hidden" htmlFor={`review-${finding.id}`}>
        {fieldLabel}
      </label>
      <input
        id={`review-${finding.id}`}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Enter ${fieldLabel}`}
        autoFocus
      />
      <button type="submit" disabled={!value.trim()}>
        Save
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}

function FindingRow({ finding }) {
  const { addAssertion, setFindingDecision } = useWorkspace()
  const [reviewing, setReviewing] = useState(false)

  const guidance = withGuidance(finding)
  const canFix = guidance.route === ROUTE_FIX
  const canAddInfo = canFix && finding.dimension === 'completeness' && finding.field
  const flagged = finding.decision?.status === 'flag_provider'

  function handleSaveAssertion(value) {
    addAssertion({
      id: crypto.randomUUID(),
      kind: 'field',
      sourceRecordId: finding.recordIds[0],
      domain: finding.domain,
      field: finding.field,
      value: wrapAssertionValue(finding.domain, finding.field, value),
      createdAt: new Date().toISOString(),
    })
    setFindingDecision(finding.id, 'reviewed')
    setReviewing(false)
  }

  function handleConfirm() {
    addAssertion({
      id: crypto.randomUUID(),
      kind: 'confirm',
      sourceRecordId: finding.recordIds[0],
      domain: finding.domain,
      createdAt: new Date().toISOString(),
    })
    setFindingDecision(finding.id, 'reviewed')
  }

  return (
    <div className="finding-row">
      <div className="finding-main">
        <div className="finding-title">
          {finding.title}
          <span className={`route-badge route-${guidance.route}`}>
            {canFix ? 'You can fix this' : 'Ask your provider'}
          </span>
        </div>
        <div className="finding-description">{guidance.explanation}</div>
        <div className="finding-next-step">
          <strong>What to do:</strong> {guidance.nextStep}
        </div>
        {finding.decision && (
          <div className="finding-decision">
            {DECISION_LABELS[finding.decision.status]}
          </div>
        )}
      </div>
      {reviewing ? (
        <ReviewForm
          finding={finding}
          onSubmit={handleSaveAssertion}
          onCancel={() => setReviewing(false)}
        />
      ) : (
        <div className="finding-actions">
          {canAddInfo && (
            <button type="button" onClick={() => setReviewing(true)}>
              Add info
            </button>
          )}
          {canFix && !canAddInfo && (
            <button type="button" onClick={handleConfirm}>
              Mark reviewed
            </button>
          )}
          {!flagged && (
            <button
              type="button"
              onClick={() => setFindingDecision(finding.id, 'flag_provider')}
            >
              Flag for my provider
            </button>
          )}
          <button
            type="button"
            onClick={() => setFindingDecision(finding.id, 'ignore_for_now')}
          >
            Ignore for now
          </button>
          <button
            type="button"
            onClick={() => setFindingDecision(finding.id, 'remind_later')}
          >
            Remind me later
          </button>
        </div>
      )}
    </div>
  )
}

function ProviderQuestions({ flagged }) {
  const [copied, setCopied] = useState(false)
  if (flagged.length === 0) return null
  const note = buildProviderNote(flagged)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(note)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="provider-questions" aria-label="Questions for your provider">
      <h2>Questions for your provider</h2>
      <p>
        You flagged {flagged.length} {flagged.length === 1 ? 'item' : 'items'}. Copy or
        download this note to bring to your next visit or send through your patient portal.
      </p>
      <pre className="provider-note">{note}</pre>
      <div className="finding-actions">
        <button type="button" onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy note'}
        </button>
        <button
          type="button"
          onClick={() => downloadText(note, 'questions-for-my-provider.txt', 'text/plain')}
        >
          Download note
        </button>
      </div>
    </section>
  )
}

export default function FindingsPanel({ findings }) {
  const flagged = findings.filter((f) => f.decision?.status === 'flag_provider')

  if (findings.length === 0) {
    return (
      <div className="empty-state">
        No findings. Either your imported data looks complete and consistent,
        or nothing has been imported yet.
      </div>
    )
  }

  return (
    <div className="findings-panel">
      <ProviderQuestions flagged={flagged} />
      {DIMENSION_ORDER.map((dimension) => {
        const items = findings.filter((f) => f.dimension === dimension)
        if (items.length === 0) return null
        return (
          <section key={dimension}>
            <h2>{DIMENSION_LABELS[dimension]}</h2>
            {items.map((finding) => (
              <FindingRow key={finding.id} finding={finding} />
            ))}
          </section>
        )
      })}
    </div>
  )
}
