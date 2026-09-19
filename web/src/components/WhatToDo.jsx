import { useState } from 'react'
import { useWorkspace } from '../state/WorkspaceContext'
import { wrapAssertionValue } from '../lib/piqi/engine'
import { guidanceForCheck, checkTitle, attributeLabel, buildCheckProviderNote } from '../lib/piqi/checkGuidance'
import { ROUTE_FIX } from '../lib/piqi/guidance'
import { estimateScore, recheckLocally, isLocallyRecheckable, LOCAL_LABEL } from '../lib/piqi/localRecheck'
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

function CheckRow({ check, status, decision }) {
  const { addAssertion, setFindingDecision } = useWorkspace()
  const [entering, setEntering] = useState(false)
  const guidance = guidanceForCheck(check)
  const canFix = guidance.route === ROUTE_FIX
  const canEnter = canFix && Boolean(check.recordId)
  const flagged = decision?.status === 'flag_provider'

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
          {status === 'local-pass' && <span className="route-badge route-fix">{LOCAL_LABEL}</span>}
          {status === 'local-fail' && <span className="route-badge">Still not valid</span>}
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
              {status === 'local-pass' || status === 'local-fail' ? 'Change value' : 'Add info'}
            </button>
          )}
          {!flagged && (
            <button type="button" onClick={() => setFindingDecision(check.id, 'flag_provider')}>
              Flag for my provider
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

export default function WhatToDo() {
  const { gatewayResult, assertions, findingDecisions } = useWorkspace()

  if (!gatewayResult) {
    return (
      <p className="empty-state">
        Load your PIQI Gateway results on the PIQI Results tab first. This tab then explains
        each check that did not pass and what you or your provider can do about it.
      </p>
    )
  }

  const r = gatewayResult
  const { estimate } = estimateScore(r, assertions, r.loadedAt)

  const rows = r.checks.map((check) => {
    const local = isLocallyRecheckable(check) ? recheckLocally(check, assertions, r.loadedAt) : null
    const status = local === true ? 'local-pass' : local === false ? 'local-fail' : 'open'
    return { check, status, guidance: guidanceForCheck(check) }
  })

  const updated = rows.filter((x) => x.status === 'local-pass')
  const open = rows.filter((x) => x.status !== 'local-pass')
  const fixable = open.filter((x) => x.guidance.route === ROUTE_FIX)
  const provider = open.filter((x) => x.guidance.route !== ROUTE_FIX && !x.guidance.technical)
  const technical = open.filter((x) => x.guidance.technical)
  const flagged = r.checks.filter((c) => findingDecisions[c.id]?.status === 'flag_provider')

  const renderRows = (list) =>
    list.map(({ check, status }) => (
      <CheckRow key={check.id} check={check} status={status} decision={findingDecisions[check.id]} />
    ))

  return (
    <div className="what-to-do">
      <section className="score-card" aria-label="Score summary">
        <div>
          <div className="score-profile">{r.profileName}</div>
          <div className="score-meta">
            {r.checks.length} checks did not pass. Fixes you make here are checked on this
            screen only for simple &quot;is filled in&quot; and &quot;is a number&quot; checks.
          </div>
        </div>
        <div className="score-stats">
          <div className="stat">
            <div className="stat-value">{r.score ?? '–'}</div>
            <div className="stat-label">Official score</div>
          </div>
          {estimate !== null && (
            <div className="stat">
              <div className="stat-value">≈ {estimate}</div>
              <div className="stat-label">Estimate with your changes ({LOCAL_LABEL.toLowerCase()})</div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2>You can fix these ({fixable.length})</h2>
        {fixable.length === 0 && <p className="empty-state">Nothing here for you to fix.</p>}
        {renderRows(fixable)}
      </section>

      {updated.length > 0 && (
        <section>
          <h2>
            Updated locally ({updated.length}) &ndash; {LOCAL_LABEL.toLowerCase()}
          </h2>
          <p>
            These now look filled in on this screen. The official score does not change until
            you export a new PIQI message, run it through the Gateway, and load the new result.
          </p>
          {renderRows(updated)}
        </section>
      )}

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

      <ProviderNote flagged={flagged} />
    </div>
  )
}
