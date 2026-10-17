// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RtbPanel from './RtbPanel'
import { MEDICAL_RTB, PHARMACY_RTB } from '../lib/rtb/useCases'

describe('RtbPanel', () => {
  it('shows only the medical use cases on the medical tab', () => {
    render(<RtbPanel program={MEDICAL_RTB} />)
    expect(screen.getByText(/Does my plan cover hearing aids/)).toBeTruthy()
    expect(screen.queryByText(/Choosing between pharmacies/)).toBeNull()
  })

  it('shows only the pharmacy use cases on the pharmacy tab', () => {
    render(<RtbPanel program={PHARMACY_RTB} />)
    expect(screen.getByText(/Choosing between pharmacies/)).toBeTruthy()
    expect(screen.queryByText(/Does my plan cover hearing aids/)).toBeNull()
  })
})
