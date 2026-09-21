import { mergeClaimsData } from '../lib/claims/extract'
import { displayText } from '../lib/piqi/attributeTypes'

// The workspace holds several patients (for example a family). Each patient has
// a completely separate set of records, assertions, decisions, sharing choices,
// PIQI results and claims. The rest of the app only ever sees the active
// patient's slice, so screens do not need to know about the others.

export const STORAGE_KEY = 'm5-health-workspace-v1'
export const STATE_VERSION = 2

export function emptySlice() {
  return {
    sourceRecords: [],
    assertions: [],
    findingDecisions: {},
    sharingSelection: {},
    // Parsed PIQI Gateway results the patient pasted in, one per data set
    // (clinical, ips, claims), linked to records where the data set has them.
    gatewayResults: {},
    // Insurance claims (PIQI PAT_EOB_V1 shape), kept apart from clinical records.
    claimsData: null,
  }
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `p-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createInitialState() {
  const id = newId()
  return { version: STATE_VERSION, patients: [{ id, name: 'Patient 1' }], activeId: id, data: { [id]: emptySlice() } }
}

const DEFAULT_NAME = /^Patient \d+$/

// A person's name from imported demographics, if the records carry one.
export function nameFromRecords(records) {
  const demographics = records.find((r) => r.domain === 'demographics')
  if (!demographics) return undefined
  const first = displayText(demographics.data?.firstName)
  const last = displayText(demographics.data?.lastName)
  const name = [first, last].filter(Boolean).join(' ')
  return name || undefined
}

// Older versions kept a single flat workspace, which becomes the first patient.
export function migrateLegacy(parsed) {
  const { gatewayResult, ...rest } = parsed
  const slice = {
    ...emptySlice(),
    sourceRecords: rest.sourceRecords ?? [],
    assertions: rest.assertions ?? [],
    findingDecisions: rest.findingDecisions ?? {},
    sharingSelection: rest.sharingSelection ?? {},
    gatewayResults: rest.gatewayResults ?? (gatewayResult ? { clinical: gatewayResult } : {}),
    claimsData: rest.claimsData ?? null,
  }
  const id = newId()
  const name = nameFromRecords(slice.sourceRecords) ?? 'Patient 1'
  return { version: STATE_VERSION, patients: [{ id, name }], activeId: id, data: { [id]: slice } }
}

export function loadState(raw) {
  if (!raw) return createInitialState()
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.version === STATE_VERSION && Array.isArray(parsed.patients) && parsed.patients.length > 0) {
      const activeId = parsed.patients.some((p) => p.id === parsed.activeId) ? parsed.activeId : parsed.patients[0].id
      const data = {}
      for (const p of parsed.patients) data[p.id] = { ...emptySlice(), ...(parsed.data?.[p.id] ?? {}) }
      return { version: STATE_VERSION, patients: parsed.patients, activeId, data }
    }
    return migrateLegacy(parsed ?? {})
  } catch {
    return createInitialState()
  }
}

export function activeSlice(state) {
  return state.data[state.activeId]
}

function updateActive(state, fn) {
  return { ...state, data: { ...state.data, [state.activeId]: fn(activeSlice(state)) } }
}

function nextDefaultName(patients) {
  let n = patients.length + 1
  while (patients.some((p) => p.name === `Patient ${n}`)) n++
  return `Patient ${n}`
}

export function reducer(state, action) {
  switch (action.type) {
    case 'ADD_RECORDS': {
      const next = updateActive(state, (s) => ({ ...s, sourceRecords: [...s.sourceRecords, ...action.records] }))
      // An unnamed patient takes the name found in imported demographics.
      const active = state.patients.find((p) => p.id === state.activeId)
      const found = active && DEFAULT_NAME.test(active.name) ? nameFromRecords(action.records) : undefined
      if (!found) return next
      return { ...next, patients: next.patients.map((p) => (p.id === active.id ? { ...p, name: found } : p)) }
    }
    case 'ADD_ASSERTION':
      return updateActive(state, (s) => ({ ...s, assertions: [...s.assertions, action.assertion] }))
    case 'SET_FINDING_DECISION':
      return updateActive(state, (s) => ({
        ...s,
        findingDecisions: {
          ...s.findingDecisions,
          [action.findingId]: { status: action.status, decidedAt: new Date().toISOString() },
        },
      }))
    case 'SET_SHARING':
      return updateActive(state, (s) => ({ ...s, sharingSelection: { ...s.sharingSelection, [action.domain]: action.value } }))
    case 'SET_GATEWAY_RESULT':
      return updateActive(state, (s) => ({ ...s, gatewayResults: { ...s.gatewayResults, [action.dataset]: action.result } }))
    case 'ADD_CLAIMS':
      return updateActive(state, (s) => ({ ...s, claimsData: mergeClaimsData(s.claimsData, action.claimsData) }))
    case 'ADD_PATIENT': {
      const id = newId()
      const name = action.name?.trim() || nextDefaultName(state.patients)
      return {
        ...state,
        patients: [...state.patients, { id, name }],
        activeId: id,
        data: { ...state.data, [id]: emptySlice() },
      }
    }
    case 'SELECT_PATIENT':
      return state.data[action.id] ? { ...state, activeId: action.id } : state
    case 'RENAME_PATIENT': {
      const name = action.name?.trim()
      if (!name) return state
      return { ...state, patients: state.patients.map((p) => (p.id === action.id ? { ...p, name } : p)) }
    }
    case 'REMOVE_PATIENT': {
      if (!state.data[action.id]) return state
      if (state.patients.length === 1) {
        // The last patient is cleared rather than removed.
        return { ...state, data: { [action.id]: emptySlice() } }
      }
      const patients = state.patients.filter((p) => p.id !== action.id)
      const data = { ...state.data }
      delete data[action.id]
      return { ...state, patients, data, activeId: state.activeId === action.id ? patients[0].id : state.activeId }
    }
    case 'RESET':
      return createInitialState()
    default:
      return state
  }
}
