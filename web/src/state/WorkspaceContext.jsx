import { createContext, useContext, useEffect, useReducer } from 'react'
import { STORAGE_KEY, activeSlice, loadState, reducer } from './workspaceState'

const WorkspaceContext = createContext(null)

function readStored() {
  try {
    return loadState(localStorage.getItem(STORAGE_KEY))
  } catch {
    return loadState(null)
  }
}

export function WorkspaceProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, readStored)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Quota exceeded -- state still works this session, just won't persist.
    }
  }, [state])

  // Everything below the patient bar sees only the active patient's data.
  const api = {
    ...activeSlice(state),
    patients: state.patients,
    activeId: state.activeId,
    activePatient: state.patients.find((p) => p.id === state.activeId),
    allData: state.data,
    addPatient: (name) => dispatch({ type: 'ADD_PATIENT', name }),
    selectPatient: (id) => dispatch({ type: 'SELECT_PATIENT', id }),
    renamePatient: (id, name) => dispatch({ type: 'RENAME_PATIENT', id, name }),
    removePatient: (id) => dispatch({ type: 'REMOVE_PATIENT', id }),
    addRecords: (records) => dispatch({ type: 'ADD_RECORDS', records }),
    addAssertion: (assertion) => dispatch({ type: 'ADD_ASSERTION', assertion }),
    setFindingDecision: (findingId, status) =>
      dispatch({ type: 'SET_FINDING_DECISION', findingId, status }),
    setGatewayResult: (dataset, result) => dispatch({ type: 'SET_GATEWAY_RESULT', dataset, result }),
    addClaims: (claimsData) => dispatch({ type: 'ADD_CLAIMS', claimsData }),
    setSharing: (domain, value) => dispatch({ type: 'SET_SHARING', domain, value }),
    reset: () => dispatch({ type: 'RESET' }),
  }

  return <WorkspaceContext.Provider value={api}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
