import { IDENTITY_FIELDS, normalizeText, recordLabel } from './rules'
import { effectiveData } from './engine'
import { CLAIMS_IDENTITY_FIELDS, CLAIMS_ONLY_CLASSES, claimsClassKey } from '../claims/model'

// Parses the JSON result returned by the PIQI Gateway's audit endpoint (the
// Test Client's "Audit PIQI File"), for example
// https://github.com/piqiframework/reference_application/blob/main/PIQI.Service.Test/TestData/ExpectedOutput/Test5_Result.json
//
// Shape used here:
//   scoringData.evaluationRubric            profile name, e.g. "USCDI v3.1 Aligned Rubric"
//   scoringData.messageResults              overall numerator / denominator / score
//   scoringData.dataClassResults[]          per-class scores
//   auditedMessage.root.classes[].elements[].attributes[].attributeAudit
//       .assessmentItems[]                  one entry per check: passed, failed or skipped

export class GatewayResultError extends Error {}

function dataText(data) {
  if (data === undefined || data === null) return undefined
  if (typeof data === 'string' || typeof data === 'number') return String(data)
  return data.text || data.codings?.[0]?.display || undefined
}

function unwrap(input) {
  let obj = input
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj)
    } catch {
      throw new GatewayResultError('That is not valid JSON. Paste the full result from the Gateway.')
    }
  }
  if (!obj || typeof obj !== 'object') {
    throw new GatewayResultError('That does not look like a PIQI Gateway result.')
  }
  for (const key of ['result', 'data']) {
    if (!obj.auditedMessage && obj[key]?.auditedMessage) return obj[key]
  }
  return obj
}

function elementLabel(domain, element, claims) {
  const identity = claims ? CLAIMS_IDENTITY_FIELDS[domain] : IDENTITY_FIELDS[domain]
  if (!identity) return undefined
  const attr = element.attributes?.find((a) => a.attributeName === identity)
  return dataText(attr?.data)
}

export function parseGatewayResult(input) {
  const result = unwrap(input)
  const classes = result.auditedMessage?.root?.classes
  if (!Array.isArray(classes)) {
    throw new GatewayResultError(
      'This result has no per-check details (auditedMessage). Use the audit result, not just the score.',
    )
  }

  const scoring = result.scoringData ?? {}
  const audit = result.auditedMessage.audit ?? {}
  const message = scoring.messageResults ?? {}

  const checks = []
  let passed = 0
  let skipped = 0

  // A claims (PAT_EOB_V1) result is recognised by its claims-only classes;
  // "coverage" alone is ambiguous because M5 Health also has coverage records.
  const claims = classes.some((c) => CLAIMS_ONLY_CLASSES.has(claimsClassKey(c.className)))

  for (const cls of classes) {
    const domain = claims ? (claimsClassKey(cls.className) ?? cls.className) : cls.className
    ;(cls.elements ?? []).forEach((element, elementIndex) => {
      const label = elementLabel(domain, element, claims)
      for (const attribute of element.attributes ?? []) {
        const items = attribute.attributeAudit?.assessmentItems ?? []
        const critical = (attribute.attributeAudit?.scoringData?.attributeCriticalFailureCount ?? 0) > 0
        for (const item of items) {
          if (item.status === 'Passed') passed++
          else if (item.status === 'Skipped') skipped++
          else if (item.status === 'Failed') {
            checks.push({
              id: `${domain}:${elementIndex}:${attribute.attributeName}:${item.attributeMnemonic}`,
              domain,
              claims,
              elementIndex,
              elementLabel: label,
              attribute: attribute.attributeName,
              mnemonic: item.attributeMnemonic,
              assessment: item.assessment,
              reason: item.reason,
              effect: item.effect,
              critical,
            })
          }
        }
      }
    })
  }

  const numerator = message.numerator ?? audit.messageNumerator ?? passed
  const denominator = message.denominator ?? audit.messageDenominator ?? passed + checks.length

  return {
    profileName:
      scoring.evaluationRubric ?? result.evaluationRubric ?? 'Unknown evaluation profile',
    contributorID: scoring.contributorID ?? result.auditedMessage.contributorID ?? null,
    messageID: scoring.messageID ?? result.auditedMessage.messageID ?? null,
    score: message.piqiScore ?? audit.messageScore ?? null,
    weightedScore: message.weightedPIQIScore ?? audit.messageScoreWeighted ?? null,
    numerator,
    denominator,
    criticalFailureCount: message.criticalFailureCount ?? audit.messageCriticalFailureCount ?? 0,
    passedCount: passed,
    skippedCount: skipped,
    classResults: (scoring.dataClassResults ?? [])
      .filter((c) => c.denominator > 0)
      .map((c) => ({
        name: c.dataClassName,
        score: c.piqiScore,
        criticalFailureCount: c.criticalFailureCount,
        instanceCount: c.instanceCount,
      })),
    checks,
  }
}

// Ties each failed check to the app record it came from. The Gateway reports
// an element's position within its class, and the app's PIQI message lists
// records of a domain in stored order, so element N is the Nth record of that
// domain. That only holds if the result was produced from the current records,
// so the identity label is compared too; a mismatch leaves recordId null and
// the check can only be flagged for a provider, never edited here.
export function linkChecksToRecords(parsed, sourceRecords, assertions) {
  const byDomain = new Map()
  for (const record of sourceRecords) {
    if (!byDomain.has(record.domain)) byDomain.set(record.domain, [])
    byDomain.get(record.domain).push(record)
  }

  const checks = parsed.checks.map((check) => {
    // Claims come from the health plan and are not editable app records.
    if (check.claims) return { ...check, recordId: null }
    const record = byDomain.get(check.domain)?.[check.elementIndex]
    if (!record) return { ...check, recordId: null }
    if (check.domain !== 'demographics' && check.elementLabel) {
      const appLabel = normalizeText(recordLabel(check.domain, effectiveData(record, assertions).merged))
      const auditLabel = normalizeText(check.elementLabel)
      if (appLabel && auditLabel && !appLabel.includes(auditLabel) && !auditLabel.includes(appLabel)) {
        return { ...check, recordId: null }
      }
    }
    return { ...check, recordId: record.id }
  })

  return { ...parsed, checks }
}
