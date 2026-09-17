import { describe, it, expect } from 'vitest'
import { computeScorecard } from './scorecard'

describe('computeScorecard', () => {
  it('scores 100% across the board with no records and no findings', () => {
    const result = computeScorecard([], 0)
    expect(result.overall).toBe(1)
    expect(result.dimensionScores).toEqual({
      completeness: 1,
      consistency: 1,
      provenance: 1,
      timeliness: 1,
      patientReviewStatus: 1,
    })
  })

  it('reduces a dimension score in proportion to findings vs total records', () => {
    const findings = [{ dimension: 'completeness', decision: null }]
    const result = computeScorecard(findings, 4)
    expect(result.dimensionScores.completeness).toBeCloseTo(0.75)
  })

  it('never goes below zero even with more findings than records', () => {
    const findings = [
      { dimension: 'completeness', decision: null },
      { dimension: 'completeness', decision: null },
      { dimension: 'completeness', decision: null },
    ]
    const result = computeScorecard(findings, 1)
    expect(result.dimensionScores.completeness).toBe(0)
  })

  it('computes patient review status as the share of decided findings', () => {
    const findings = [
      { dimension: 'completeness', decision: { status: 'reviewed' } },
      { dimension: 'completeness', decision: null },
    ]
    const result = computeScorecard(findings, 2)
    expect(result.dimensionScores.patientReviewStatus).toBe(0.5)
  })

  it('excludes duplication findings from the scorecard dimensions', () => {
    const findings = [{ dimension: 'duplication', decision: null }]
    const result = computeScorecard(findings, 2)
    expect(result.dimensionScores.completeness).toBe(1)
    expect(result.dimensionScores.consistency).toBe(1)
  })

  it('averages the five named dimensions for the overall score', () => {
    const findings = [{ dimension: 'completeness', decision: { status: 'reviewed' } }]
    const result = computeScorecard(findings, 1)
    const values = Object.values(result.dimensionScores)
    const expected = values.reduce((sum, v) => sum + v, 0) / values.length
    expect(result.overall).toBeCloseTo(expected)
  })
})
