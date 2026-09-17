import { useRef, useState } from 'react'
import samplePlan from './data/sample_plan_data.json'
import CoverageScreen from './components/CoverageScreen'
import { createSourceRecord, validateCoveragePlan } from './lib/sourceRecord'
import './App.css'

function App() {
  const [record, setRecord] = useState(() =>
    createSourceRecord({
      sourceType: 'sample',
      documentName: 'sample_plan_data.json',
      data: samplePlan,
    }),
  )
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = validateCoveragePlan(JSON.parse(reader.result))
        setRecord(
          createSourceRecord({
            sourceType: 'file-upload',
            documentName: file.name,
            data: parsed,
          }),
        )
        setError(null)
      } catch (err) {
        setError(err.message)
      }
    }
    reader.onerror = () => setError('Could not read that file.')
    reader.readAsText(file)

    event.target.value = ''
  }

  return (
    <>
      <div className="import-bar">
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Import plan JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          hidden
        />
        {error && <span className="import-error">{error}</span>}
      </div>
      <CoverageScreen record={record} />
    </>
  )
}

export default App
