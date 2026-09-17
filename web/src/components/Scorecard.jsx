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
      <div
        className="scorecard-overall"
        role="progressbar"
        aria-valuenow={Math.round(scorecard.overall * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Overall Readiness"
      >
        <div className="scorecard-overall-value">
          {Math.round(scorecard.overall * 100)}%
        </div>
        <div className="scorecard-overall-label">Overall Readiness</div>
      </div>

      <div className="scorecard-dimensions">
        {DIMENSION_ORDER.map((dimension) => {
          const value = Math.round(scorecard.dimensionScores[dimension] * 100)
          return (
            <div className="scorecard-dimension" key={dimension}>
              <div className="scorecard-dimension-label">
                <span>{DIMENSION_LABELS[dimension]}</span>
                <span>{value}%</span>
              </div>
              <div
                className="scorecard-bar"
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={DIMENSION_LABELS[dimension]}
              >
                <div className="scorecard-bar-fill" style={{ width: `${value}%` }} />
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
