import { useWorkspace } from '../state/WorkspaceContext'
import { claimLabel } from '../lib/claims/extract'
import { hasClaims } from '../lib/claims/message'
import { displayText } from '../lib/piqi/attributeTypes'

function money(value) {
  return typeof value === 'number'
    ? value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
    : '–'
}

function ClaimCard({ claim }) {
  const mc = claim.medicalClaim ?? {}
  const period =
    mc.statementFromDate && mc.statementThruDate && mc.statementFromDate !== mc.statementThruDate
      ? `${mc.statementFromDate} to ${mc.statementThruDate}`
      : (mc.statementFromDate ?? 'date not listed')
  return (
    <details className="claim-card">
      <summary>
        <strong>{claimLabel(claim)}</strong>
        <span className="claim-summary">
          {displayText(mc.claimSubType) ? `${displayText(mc.claimSubType)} · ` : ''}
          {period} · billed {money(mc.claimTotalSubmittedAmount)}, paid {money(mc.claimPaymentAmount)}
        </span>
      </summary>
      <dl className="claim-details">
        <dt>Claim ID</dt>
        <dd>{mc.payerClaimUniqueIdentifier ?? '–'}</dd>
        <dt>Status</dt>
        <dd>{displayText(mc.processingStatusCode) ?? '–'}</dd>
        <dt>Paid by patient</dt>
        <dd>{money(mc.amountPaidByPatient)}</dd>
      </dl>
      <h3>Diagnoses ({claim.diagnoses.length})</h3>
      <p>{claim.diagnoses.map((d) => displayText(d.diagnosisCode)).join(', ') || 'None listed'}</p>
      <h3>Procedures ({claim.procedures.length})</h3>
      <p>{claim.procedures.map((p) => displayText(p.procedureCode)).join(', ') || 'None listed'}</p>
      <h3>Service lines ({claim.lines.length})</h3>
      <p>
        {claim.lines
          .map((l) => displayText(l.lineProcedureCode) ?? displayText(l.nationalDrugCode) ?? `line ${l.lineNumber}`)
          .join(', ') || 'None listed'}
      </p>
    </details>
  )
}

export default function ClaimsPanel() {
  const { claimsData } = useWorkspace()

  if (!hasClaims(claimsData)) {
    return (
      <p className="empty-state">
        No insurance claims yet. Import a FHIR Bundle of ExplanationOfBenefit claims, for
        example from CMS Blue Button, and they will appear here.
      </p>
    )
  }

  const { claims, coverage } = claimsData
  return (
    <div className="claims-panel">
      <section>
        <h2>Coverage ({coverage.length})</h2>
        {coverage.map((c) => (
          <p key={c.planName}>
            {c.planName}
            {c.startDate ? ` · since ${c.startDate}` : ''}
          </p>
        ))}
      </section>
      <section>
        <h2>Claims ({claims.length})</h2>
        {claims.map((claim) => (
          <ClaimCard key={claim.id} claim={claim} />
        ))}
      </section>
    </div>
  )
}
