import { createContext, useContext, useEffect, useReducer } from 'react'

const STORAGE_KEY = 'm5-health-workspace-v1'

const initialState = {
  sourceRecords: [],
  assertions: [],
  findingDecisions: {},
  sharingSelection: {},
}

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw)
    return { ...initialState, ...parsed }
  } catch {
    return initialState
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_RECORDS':
      return {
        ...state,
        sourceRecords: [...state.sourceRecords, ...action.records],
      }
    case 'ADD_ASSERTION':
      return { ...state, assertions: [...state.assertions, action.assertion] }
    case 'SET_FINDING_DECISION':
      return {
        ...state,
        findingDecisions: {
          ...state.findingDecisions,
          [action.findingId]: {
            status: action.status,
            decidedAt: new Date().toISOString(),
          },
        },
      }
    case 'SET_SHARING':
      return {
        ...state,
        sharingSelection: {
          ...state.sharingSelection,
          [action.domain]: action.value,
        },
      }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Quota exceeded -- state still works this session, just won't persist.
    }
  }, [state])

  const api = {
    ...state,
    addRecords: (records) => dispatch({ type: 'ADD_RECORDS', records }),
    addAssertion: (assertion) => dispatch({ type: 'ADD_ASSERTION', assertion }),
    setFindingDecision: (findingId, status) =>
      dispatch({ type: 'SET_FINDING_DECISION', findingId, status }),
    setSharing: (domain, value) => dispatch({ type: 'SET_SHARING', domain, value }),
    reset: () => dispatch({ type: 'RESET' }),
  }

  return (
    <WorkspaceContext.Provider value={api}>{children}</WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
