import { describe, it, expect } from 'vitest'
import {
  STATE_VERSION,
  activeSlice,
  createInitialState,
  loadState,
  migrateLegacy,
  nameFromRecords,
  reducer,
} from './workspaceState'

const demographics = (first, last) => ({
  id: 'd',
  domain: 'demographics',
  data: { firstName: first, lastName: last },
  source: {},
})
const med = (id) => ({ id, domain: 'medications', data: { medication: 'Aspirin' }, source: {} })

describe('workspaceState', () => {
  it('starts with one empty patient', () => {
    const s = createInitialState()
    expect(s.patients).toHaveLength(1)
    expect(activeSlice(s).sourceRecords).toEqual([])
  })

  it('keeps each patient data separate', () => {
    let s = createInitialState()
    const first = s.activeId
    s = reducer(s, { type: 'ADD_RECORDS', records: [med('a')] })
    s = reducer(s, { type: 'ADD_PATIENT', name: 'Sam' })
    expect(s.activeId).not.toBe(first)
    expect(activeSlice(s).sourceRecords).toEqual([])
    s = reducer(s, { type: 'ADD_RECORDS', records: [med('b'), med('c')] })
    expect(activeSlice(s).sourceRecords).toHaveLength(2)
    s = reducer(s, { type: 'SELECT_PATIENT', id: first })
    expect(activeSlice(s).sourceRecords.map((r) => r.id)).toEqual(['a'])
  })

  it('keeps PIQI results and claims per patient', () => {
    let s = createInitialState()
    s = reducer(s, { type: 'SET_GATEWAY_RESULT', dataset: 'ips', result: { score: 80 } })
    const first = s.activeId
    s = reducer(s, { type: 'ADD_PATIENT', name: 'Sam' })
    expect(activeSlice(s).gatewayResults).toEqual({})
    s = reducer(s, { type: 'SELECT_PATIENT', id: first })
    expect(activeSlice(s).gatewayResults.ips.score).toBe(80)
  })

  it('names an unnamed patient from imported demographics only', () => {
    let s = createInitialState()
    s = reducer(s, { type: 'ADD_RECORDS', records: [demographics('Ana', 'Lopez')] })
    expect(s.patients[0].name).toBe('Ana Lopez')
    s = reducer(s, { type: 'ADD_RECORDS', records: [demographics('Other', 'Person')] })
    expect(s.patients[0].name).toBe('Ana Lopez')
  })

  it('reads a name from demographics', () => {
    expect(nameFromRecords([med('a')])).toBeUndefined()
    expect(nameFromRecords([demographics('Ana', 'Lopez')])).toBe('Ana Lopez')
  })

  it('renames and ignores blank names', () => {
    let s = createInitialState()
    s = reducer(s, { type: 'RENAME_PATIENT', id: s.activeId, name: '  Dad ' })
    expect(s.patients[0].name).toBe('Dad')
    s = reducer(s, { type: 'RENAME_PATIENT', id: s.activeId, name: '   ' })
    expect(s.patients[0].name).toBe('Dad')
  })

  it('removes a patient and picks another as active', () => {
    let s = createInitialState()
    const first = s.activeId
    s = reducer(s, { type: 'ADD_PATIENT', name: 'Sam' })
    const second = s.activeId
    s = reducer(s, { type: 'REMOVE_PATIENT', id: second })
    expect(s.patients).toHaveLength(1)
    expect(s.activeId).toBe(first)
    expect(s.data[second]).toBeUndefined()
  })

  it('clears the last patient instead of removing it', () => {
    let s = createInitialState()
    s = reducer(s, { type: 'ADD_RECORDS', records: [med('a')] })
    s = reducer(s, { type: 'REMOVE_PATIENT', id: s.activeId })
    expect(s.patients).toHaveLength(1)
    expect(activeSlice(s).sourceRecords).toEqual([])
  })

  it('gives new patients unique default names', () => {
    let s = createInitialState()
    s = reducer(s, { type: 'ADD_PATIENT', name: '' })
    s = reducer(s, { type: 'ADD_PATIENT', name: '' })
    expect(new Set(s.patients.map((p) => p.name)).size).toBe(3)
  })

  it('migrates the old single workspace into one patient', () => {
    const s = migrateLegacy({
      sourceRecords: [demographics('Ana', 'Lopez'), med('a')],
      gatewayResult: { score: 70 },
    })
    expect(s.version).toBe(STATE_VERSION)
    expect(s.patients[0].name).toBe('Ana Lopez')
    expect(activeSlice(s).sourceRecords).toHaveLength(2)
    expect(activeSlice(s).gatewayResults.clinical.score).toBe(70)
  })

  it('loads saved state, legacy state, and bad input', () => {
    const saved = reducer(createInitialState(), { type: 'ADD_RECORDS', records: [med('a')] })
    expect(activeSlice(loadState(JSON.stringify(saved))).sourceRecords).toHaveLength(1)
    expect(activeSlice(loadState(JSON.stringify({ sourceRecords: [med('z')] }))).sourceRecords).toHaveLength(1)
    expect(loadState('not json').patients).toHaveLength(1)
    expect(loadState(null).patients).toHaveLength(1)
  })
})
