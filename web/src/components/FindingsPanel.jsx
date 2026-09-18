import { useState } from 'react'
import { useWorkspace } from '../state/WorkspaceContext'
import { FIELD_LABELS } from '../lib/piqi/rules'
import { wrapAssertionValue } from '../lib/piqi/engine'

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

  const canAddInfo = finding.dimension === 'completeness' && finding.field

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
        <div className="finding-title">{finding.title}</div>
        <div className="finding-description">{finding.description}</div>
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
          {canAddInfo ? (
            <button type="button" onClick={() => setReviewing(true)}>
              Add info
            </button>
          ) : (
            <button type="button" onClick={handleConfirm}>
              Mark reviewed
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

export default function FindingsPanel({ findings }) {
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
