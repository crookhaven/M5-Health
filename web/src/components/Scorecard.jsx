const DIMENSION_LABELS = {
  completeness: 'Completeness',
  consistency: 'Consistency',
  provenance: 'Provenance',
  timeliness: 'Timeliness',
  patientReviewStatus: 'Patient Review Status',
}

const DIMENSION_ORDER = [
  'completeness',
  'consistency',
  'provenance',
  'timeliness',
  'patientReviewStatus',
]

export default function Scorecard({ scorecard }) {
  return (
    <div className="scorecard">
      <div className="scorecard-overall">
        <div className="scorecard-overall-value">
          {Math.round(scorecard.overall * 100)}%
        </div>
        <div className="scorecard-overall-label">Overall Readiness</div>
      </div>

      <div className="scorecard-dimensions">
        {DIMENSION_ORDER.map((dimension) => {
          const value = scorecard.dimensionScores[dimension]
          return (
            <div className="scorecard-dimension" key={dimension}>
              <div className="scorecard-dimension-label">
                <span>{DIMENSION_LABELS[dimension]}</span>
                <span>{Math.round(value * 100)}%</span>
              </div>
              <div className="scorecard-bar">
                <div
                  className="scorecard-bar-fill"
                  style={{ width: `${Math.round(value * 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <p className="scorecard-disclaimer">
        This is NOT a health score. This is a data quality score.
      </p>
    </div>
  )
}
