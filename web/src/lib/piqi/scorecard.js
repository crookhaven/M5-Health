const SCORECARD_DIMENSIONS = ['completeness', 'consistency', 'provenance', 'timeliness']

function ratioScore(findingCount, totalRecords) {
  if (totalRecords === 0) return 1
  return Math.max(0, 1 - findingCount / totalRecords)
}

export function computeScorecard(findings, totalRecords) {
  const dimensionScores = {}
  for (const dimension of SCORECARD_DIMENSIONS) {
    const count = findings.filter((f) => f.dimension === dimension).length
    dimensionScores[dimension] = ratioScore(count, totalRecords)
  }

  const totalFindings = findings.length
  const decided = findings.filter((f) => f.decision).length
  dimensionScores.patientReviewStatus =
    totalFindings === 0 ? 1 : decided / totalFindings

  const values = Object.values(dimensionScores)
  const overall = values.reduce((sum, v) => sum + v, 0) / values.length

  return { overall, dimensionScores }
}
