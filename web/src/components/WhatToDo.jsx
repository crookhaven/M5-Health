import { useState } from 'react'
import { useWorkspace } from '../state/WorkspaceContext'
import { wrapAssertionValue } from '../lib/piqi/engine'
import { guidanceForCheck, checkTitle, attributeLabel, buildCheckProviderNote } from '../lib/piqi/checkGuidance'
import { ROUTE_FIX } from '../lib/piqi/guidance'
import { addedValueFor, ADDED_LABEL } from '../lib/piqi/checkKind'
import { downloadText } from '../lib/download'

function ValueForm({ check, onSubmit, onCancel }) {
  const [value, setValue] = useState('')
  const label = attributeLabel(check)
  return (
    <form
      className="review-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(value.trim())
      }}
    >
      <label className="visually-hidden" htmlFor={`value-${check.id}`}>
        {label}
      </label>
      <input
        id={`value-${check.id}`}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Enter ${label}`}
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

function CheckRow({ check, added, decision }) {
  const { addAssertion, setFindingDecision } = useWorkspace()
  const [entering, setEntering] = useState(false)
  const guidance = guidanceForCheck(check)
  const canFix = guidance.route === ROUTE_FIX
  const canEnter = canFix && Boolean(check.recordId)
  const flagged = decision?.status === 'flag_provider'
  const ignored = decision?.status === 'ignore_for_now'

  function save(value) {
    addAssertion({
      id: crypto.randomUUID(),
      kind: 'field',
      sourceRecordId: check.recordId,
      domain: check.domain,
      field: check.attribute,
      value: wrapAssertionValue(check.domain, check.attribute, value),
      createdAt: new Date().toISOString(),
    })
    setFindingDecision(check.id, 'reviewed')
    setEntering(false)
  }

  return (
    <div className="finding-row">
      <div className="finding-main">
        <div className="finding-title">
          {checkTitle(check)}
          {check.critical && <span className="route-badge critical">Critical</span>}
          {added && <span className="route-badge route-fix">{ADDED_LABEL}</span>}
        </div>
        <div className="finding-description">{guidance.explanation}</div>
        <div className="finding-next-step">
          <strong>What to do:</strong> {guidance.nextStep}
        </div>
        <div className="finding-next-step">
          PIQI check: {check.assessment}
          {check.reason ? ` (${check.reason})` : ''}
        </div>
        {flagged && <div className="finding-decision">Flagged for your provider</div>}
        {ignored && <div className="finding-decision">Ignored for now</div>}
        {canFix && !check.recordId && (
          <div className="finding-decision">
            This result no longer lines up with your current records, so it can&apos;t be edited
            here. Re-export your PIQI message and load a fresh result.
          </div>
        )}
      </div>
      {entering ? (
        <ValueForm check={check} onSubmit={save} onCancel={() => setEntering(false)} />
      ) : (
        <div className="finding-actions">
          {canEnter && (
            <button type="button" onClick={() => setEntering(true)}>
              {added ? 'Change value' : 'Add info'}
            </button>
          )}
          {!flagged && !ignored && (
            <button type="button" onClick={() => setFindingDecision(check.id, 'flag_provider')}>
              Flag for my provider
            </button>
          )}
          {ignored ? (
            <button type="button" onClick={() => setFindingDecision(check.id, 'open')}>
              Put back
            </button>
          ) : (
            <button type="button" onClick={() => setFindingDecision(check.id, 'ignore_for_now')}>
              Ignore for now
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function ProviderNote({ flagged }) {
  const [copied, setCopied] = useState(false)
  if (flagged.length === 0) return null
  const note = buildCheckProviderNote(flagged)

  async function copy() {
    try {
      await navigator.clipboard.writeText(note)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section aria-label="Questions for your provider">
      <h2>Questions for your provider</h2>
      <p>
        You flagged {flagged.length} {flagged.length === 1 ? 'item' : 'items'}. Copy or download
        this note to bring to your next visit or send through your patient portal.
      </p>
      <pre className="provider-note">{note}</pre>
      <div className="finding-actions">
        <button type="button" onClick={copy}>
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

export default function WhatToDo({ dataset = 'clinical' }) {
  const { gatewayResults, assertions, findingDecisions } = useWorkspace()
  const gatewayResult = gatewayResults[dataset]

  if (!gatewayResult) {
    return (
      <p className="empty-state">
        Run your PIQI score first. This tab only works from a real PIQI Gateway result: load one
        on the PIQI score tab, and it will then explain each check that did not pass and what you
        or your provider can do about it. This app does not make up its own checks.
      </p>
    )
  }

  const r = gatewayResult
  const statusOf = (check) => findingDecisions[check.id]?.status

  const rows = r.checks.map((check) => ({
    check,
    guidance: guidanceForCheck(check),
    added: Boolean(addedValueFor(check, assertions, r.loadedAt)),
  }))

  const ignored = rows.filter((x) => statusOf(x.check) === 'ignore_for_now')
  const open = rows.filter((x) => statusOf(x.check) !== 'ignore_for_now')
  const fixable = open.filter((x) => x.guidance.route === ROUTE_FIX)
  const provider = open.filter((x) => x.guidance.route !== ROUTE_FIX && !x.guidance.technical)
  const technical = open.filter((x) => x.guidance.technical)
  const addedCount = rows.filter((x) => x.added).length
  const flagged = r.checks.filter((c) => statusOf(c) === 'flag_provider')

  const renderRows = (list) =>
    list.map(({ check, added }) => (
      <CheckRow key={check.id} check={check} added={added} decision={findingDecisions[check.id]} />
    ))

  return (
    <div className="what-to-do">
      <section className="score-card" aria-label="Score summary">
        <div>
          <div className="score-profile">{r.profileName}</div>
          <div className="score-meta">
            {r.checks.length} checks did not pass in the PIQI Gateway result. Values you add here
            never change the score. Only a new PIQI audit can do that.
          </div>
        </div>
        <div className="score-stats">
          <div className="stat">
            <div className="stat-value">{r.score ?? '–'}</div>
            <div className="stat-label">Official score</div>
          </div>
        </div>
      </section>

      {addedCount > 0 && (
        <p className="local-note">
          You added {addedCount} {addedCount === 1 ? 'value' : 'values'}. To see whether{' '}
          {addedCount === 1 ? 'it passes' : 'they pass'}, export a new PIQI message, run it through
          the Gateway, and load the new result on the PIQI score tab.
        </p>
      )}

      <section>
        <h2>You can fix these ({fixable.length})</h2>
        {fixable.length === 0 && <p className="empty-state">Nothing here for you to fix.</p>}
        {renderRows(fixable)}
      </section>

      <section>
        <h2>Ask your provider ({provider.length})</h2>
        {provider.length === 0 && <p className="empty-state">Nothing here.</p>}
        {renderRows(provider)}
      </section>

      {technical.length > 0 && (
        <details className="technical-group">
          <summary>
            Technical data-format issues ({technical.length}) &ndash; nothing to type in, for the
            data source
          </summary>
          {renderRows(technical)}
        </details>
      )}

      {ignored.length > 0 && (
        <details className="technical-group">
          <summary>Ignored for now ({ignored.length})</summary>
          {renderRows(ignored)}
        </details>
      )}

      <ProviderNote flagged={flagged} />
    </div>
  )
}
