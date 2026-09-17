// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Scorecard from './Scorecard'

describe('Scorecard', () => {
  it('renders the overall percentage and the required disclaimer', () => {
    const scorecard = {
      overall: 0.82,
      dimensionScores: {
        completeness: 0.7,
        consistency: 0.9,
        provenance: 1,
        timeliness: 0.8,
        patientReviewStatus: 0.6,
      },
    }
    render(<Scorecard scorecard={scorecard} />)

    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(
      screen.getByText('This is NOT a health score. This is a data quality score.'),
    ).toBeInTheDocument()
  })

  it('renders a progressbar for the overall score and each dimension', () => {
    const scorecard = {
      overall: 0.5,
      dimensionScores: {
        completeness: 0.5,
        consistency: 0.5,
        provenance: 0.5,
        timeliness: 0.5,
        patientReviewStatus: 0.5,
      },
    }
    render(<Scorecard scorecard={scorecard} />)

    const bars = screen.getAllByRole('progressbar')
    expect(bars).toHaveLength(6) // overall + 5 named dimensions
    for (const bar of bars) {
      expect(bar).toHaveAttribute('aria-valuenow', '50')
    }
  })

  it('rounds percentages for display', () => {
    const scorecard = {
      overall: 0.666,
      dimensionScores: {
        completeness: 0.333,
        consistency: 1,
        provenance: 1,
        timeliness: 1,
        patientReviewStatus: 1,
      },
    }
    render(<Scorecard scorecard={scorecard} />)
    expect(screen.getByText('67%')).toBeInTheDocument()
    expect(screen.getByText('33%')).toBeInTheDocument()
  })
})
