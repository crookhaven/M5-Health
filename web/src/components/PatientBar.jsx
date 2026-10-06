import { useState } from 'react'
import { useWorkspace } from '../state/WorkspaceContext'

// Chooses which patient every other screen is showing, and adds, renames,
// reorders or removes patients. Forms are inline (no browser pop-ups).
export default function PatientBar() {
  const { patients, activeId, activePatient, selectPatient, addPatient, renamePatient, movePatient, removePatient } =
    useWorkspace()
  const position = patients.findIndex((p) => p.id === activeId)
  const [mode, setMode] = useState(null) // 'add' | 'rename' | 'remove' | null
  const [name, setName] = useState('')

  function open(nextMode) {
    setMode(nextMode)
    setName(nextMode === 'rename' ? activePatient?.name ?? '' : '')
  }

  function submit(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (mode === 'add') addPatient(trimmed)
    if (mode === 'rename') renamePatient(activeId, trimmed)
    setMode(null)
  }

  return (
    <section className="patient-bar" aria-label="Patient">
      <label>
        Patient{' '}
        <select value={activeId} onChange={(e) => selectPatient(e.target.value)}>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="button-row">
        <button
          type="button"
          onClick={() => movePatient(activeId, -1)}
          disabled={position <= 0}
          aria-label={`Move ${activePatient?.name} up`}
          title="Move up in the list"
        >
          ↑ Move up
        </button>
        <button
          type="button"
          onClick={() => movePatient(activeId, 1)}
          disabled={position === -1 || position >= patients.length - 1}
          aria-label={`Move ${activePatient?.name} down`}
          title="Move down in the list"
        >
          ↓ Move down
        </button>
        <button type="button" onClick={() => open('add')}>Add patient</button>
        <button type="button" onClick={() => open('rename')}>Rename</button>
        <button type="button" onClick={() => open('remove')}>
          {patients.length > 1 ? 'Remove' : 'Clear'}
        </button>
      </div>
      {(mode === 'add' || mode === 'rename') && (
        <form className="patient-form" onSubmit={submit}>
          <label>
            {mode === 'add' ? 'New patient name' : 'New name'}{' '}
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <button type="submit">{mode === 'add' ? 'Add' : 'Save'}</button>
          <button type="button" onClick={() => setMode(null)}>Cancel</button>
        </form>
      )}
      {mode === 'remove' && (
        <div className="patient-form" role="alert">
          <span>
            {patients.length > 1
              ? `Remove ${activePatient?.name} and all of their data from this browser?`
              : `Clear all data for ${activePatient?.name}?`}
          </span>
          <button
            type="button"
            onClick={() => {
              removePatient(activeId)
              setMode(null)
            }}
          >
            Yes, {patients.length > 1 ? 'remove' : 'clear'}
          </button>
          <button type="button" onClick={() => setMode(null)}>Cancel</button>
        </div>
      )}
    </section>
  )
}
