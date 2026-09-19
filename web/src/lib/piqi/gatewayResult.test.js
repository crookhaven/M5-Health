import { describe, it, expect } from 'vitest'
import { parseGatewayResult, linkChecksToRecords, GatewayResultError } from './gatewayResult'

const item = (mnemonic, attributeName, assessment, status, reason = '') => ({
  attributeMnemonic: mnemonic, attributeName, assessment, effect: 'Scoring', status, reason,
})

function fixture() {
  return {
    succeeded: true,
    scoringData: {
      evaluationRubric: 'USCDI v3.1 Aligned Rubric',
      messageID: 'Msg1',
      messageResults: { numerator: 3, denominator: 5, piqiScore: 60, weightedPIQIScore: 60, criticalFailureCount: 1 },
      dataClassResults: [{ dataClassName: 'Medications', piqiScore: 60, criticalFailureCount: 1, instanceCount: 1, denominator: 5 }],
    },
    auditedMessage: {
      root: {
        classes: [
          {
            className: 'medications',
            elements: [
              {
                attributes: [
                  { attributeName: 'medication', data: { text: 'Lisinopril 10 MG Oral Tablet' } },
                  {
                    attributeName: 'doseAmount',
                    attributeAudit: {
                      scoringData: { attributeCriticalFailureCount: 1 },
                      assessmentItems: [item('MED_DOSEAMT', 'doseAmount', 'Medication Dose Amount is populated', 'Failed', 'Attribute is unpopulated')],
                    },
                  },
                  {
                    attributeName: 'fillStatus',
                    attributeAudit: {
                      scoringData: { attributeCriticalFailureCount: 0 },
                      assessmentItems: [item('MED_FSTAT', 'fillStatus', 'Medication Fill Status is populated', 'Passed')],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  }
}

describe('parseGatewayResult', () => {
  it('reads the profile name, score and failed checks', () => {
    const p = parseGatewayResult(JSON.stringify(fixture()))
    expect(p.profileName).toBe('USCDI v3.1 Aligned Rubric')
    expect(p.score).toBe(60)
    expect(p.passedCount).toBe(1)
    expect(p.checks).toHaveLength(1)
    expect(p.checks[0]).toMatchObject({
      domain: 'medications', attribute: 'doseAmount', mnemonic: 'MED_DOSEAMT',
      elementLabel: 'Lisinopril 10 MG Oral Tablet', critical: true,
    })
  })

  it('rejects text that is not a Gateway audit result', () => {
    expect(() => parseGatewayResult('nope')).toThrow(GatewayResultError)
    expect(() => parseGatewayResult({ scoringData: {} })).toThrow(/no per-check details/)
  })
})

describe('linkChecksToRecords', () => {
  const record = (label) => ({ id: 'r1', domain: 'medications', data: { medication: { text: label, codings: [] } }, source: {} })

  it('links a check to the record at the same position when the labels agree', () => {
    const linked = linkChecksToRecords(parseGatewayResult(fixture()), [record('Lisinopril 10 MG Oral Tablet')], [])
    expect(linked.checks[0].recordId).toBe('r1')
  })

  it('leaves the check unlinked when the record no longer matches the result', () => {
    const linked = linkChecksToRecords(parseGatewayResult(fixture()), [record('Metformin 500 MG Oral Tablet')], [])
    expect(linked.checks[0].recordId).toBeNull()
  })
})
