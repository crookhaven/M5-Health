import { describe, it, expect } from 'vitest'
import { specialtyOf, filterBySpecialty } from './specialty'
import { codeableConcept, coding } from './piqi/attributeTypes'

const record = (domain, data) => ({ id: Math.random().toString(36), domain, data, source: { type: 'sample' } })
const cc = (text, system, code) => codeableConcept({ text, codings: code ? [coding({ system, code, display: text })] : [] })

describe('specialtyOf', () => {
  it('uses codes first: CDT, ICD-10 chapters and CPT ranges', () => {
    expect(specialtyOf(record('procedures', { procedure: cc('Periodic exam', 'http://www.ada.org/cdt', 'D0120') }))).toBe('dental')
    expect(specialtyOf(record('conditions', { condition: cc('POAG, bilateral', 'http://hl7.org/fhir/sid/icd-10-cm', 'H40.1133') }))).toBe('vision')
    expect(specialtyOf(record('conditions', { condition: cc('Sensorineural loss', 'http://hl7.org/fhir/sid/icd-10-cm', 'H90.3') }))).toBe('hearing')
    expect(specialtyOf(record('conditions', { condition: cc('Psoriasis vulgaris', 'http://hl7.org/fhir/sid/icd-10-cm', 'L40.0') }))).toBe('dermatology')
    expect(specialtyOf(record('procedures', { procedure: cc('Comprehensive audiometry', 'http://www.ama-assn.org/go/cpt', '92557') }))).toBe('hearing')
  })

  it('falls back to keywords in the name and context fields', () => {
    expect(specialtyOf(record('medicalDevices', { deviceType: cc('Hearing aid, behind the ear') }))).toBe('hearing')
    expect(specialtyOf(record('medications', { medication: cc('latanoprost 0.05 MG/ML Ophthalmic Solution') }))).toBe('vision')
    expect(specialtyOf(record('medications', { medication: cc('clobetasol propionate 0.5 MG/ML Topical Solution') }))).toBe('dermatology')
    expect(specialtyOf(record('medications', { medication: cc('chlorhexidine gluconate 1.2 MG/ML Mouthwash') }))).toBe('dental')
    expect(specialtyOf(record('clinicalNotes', { title: 'Consultation', organization: 'Atlas Dental Group' }))).toBe('dental')
    expect(specialtyOf(record('imaging', { title: 'Study', modality: 'Ophthalmic Tomography' }))).toBe('vision')
  })

  it('does not mistake lab units for skin findings', () => {
    expect(specialtyOf(record('labResults', { test: cc('Sodium [Moles/volume] in Serum or Plasma') }))).toBe('medical')
  })

  it('ignores incidental details such as an allergy reaction', () => {
    expect(specialtyOf(record('allergies', { substance: cc('Penicillin'), reaction: cc('Rash') }))).toBe('medical')
    expect(specialtyOf(record('conditions', { condition: cc('Type 2 diabetes', 'http://hl7.org/fhir/sid/icd-10-cm', 'E11.9') }))).toBe('medical')
  })
})

describe('filterBySpecialty', () => {
  it('returns everything for "all" and only matching records otherwise', () => {
    const records = [
      record('medicalDevices', { deviceType: cc('Hearing aid') }),
      record('conditions', { condition: cc('Hypertension') }),
    ]
    expect(filterBySpecialty(records, 'all')).toHaveLength(2)
    expect(filterBySpecialty(records, 'hearing').map((r) => r.domain)).toEqual(['medicalDevices'])
  })
})
