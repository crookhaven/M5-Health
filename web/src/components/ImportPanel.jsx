import { useState } from 'react'
import { useWorkspace } from '../state/WorkspaceContext'
import { createSourceRecord, validateCoveragePlan } from '../lib/sourceRecord'
import { normalizeFhirBundle } from '../lib/fhir/normalize'
import { parseShlUri, requiresPasscode } from '../lib/shl/parse'
import { REQUIRED_FIELDS, FIELD_LABELS } from '../lib/piqi/rules'
import { wrapAssertionValue } from '../lib/piqi/engine'
import { DOMAINS } from '../lib/domains'
import samplePatient from '../data/sample_fhir_bundle.json'
import samplePlan from '../data/sample_plan_data.json'

const MAX_STORED_PDF_BYTES = 500 * 1024

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

function SampleImport() {
  const { addRecords } = useWorkspace()
  const [message, setMessage] = useState(null)

  function loadSampleRecord() {
    const normalized = normalizeFhirBundle(samplePatient)
    const records = normalized.map(({ domain, data }) =>
      createSourceRecord({
        sourceType: 'sample',
        documentName: 'sample_fhir_bundle.json',
        domain,
        data,
      }),
    )
    addRecords(records)
    setMessage(`Loaded ${records.length} records from the sample health record.`)
  }

  function loadSamplePlan() {
    addRecords([
      createSourceRecord({
        sourceType: 'sample',
        documentName: 'sample_plan_data.json',
        domain: 'coverage',
        data: samplePlan,
      }),
    ])
    setMessage('Loaded the sample coverage plan.')
  }

  return (
    <section className="import-section">
      <h2>Sample data</h2>
      <p>No real data on hand yet? Load bundled samples to try the app.</p>
      <div className="button-row">
        <button type="button" onClick={loadSampleRecord}>
          Load sample health record
        </button>
        <button type="button" onClick={loadSamplePlan}>
          Load sample coverage plan
        </button>
      </div>
      {message && <p className="import-message">{message}</p>}
    </section>
  )
}

function CoverageImport() {
  const { addRecords } = useWorkspace()
  const [error, setError] = useState(null)

  function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = validateCoveragePlan(JSON.parse(reader.result))
        addRecords([
          createSourceRecord({
            sourceType: 'file-upload',
            documentName: file.name,
            domain: 'coverage',
            data: parsed,
          }),
        ])
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
    <section className="import-section">
      <h2>Coverage plan (JSON)</h2>
      <label className="file-label">
        Choose coverage plan JSON file
        <input type="file" accept="application/json,.json" onChange={handleFile} />
      </label>
      {error && <p className="import-error">{error}</p>}
    </section>
  )
}

function FhirBundleImport() {
  const { addRecords } = useWorkspace()
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const bundle = JSON.parse(reader.result)
        const normalized = normalizeFhirBundle(bundle)
        if (normalized.length === 0) {
          throw new Error(
            'No recognized FHIR resources found. This importer expects a single Bundle (not a bulk-export NDJSON file).',
          )
        }
        const records = normalized.map(({ domain, data }) =>
          createSourceRecord({
            sourceType: 'fhir-bundle-upload',
            documentName: file.name,
            domain,
            data,
          }),
        )
        addRecords(records)
        setStatus(`Imported ${records.length} records from ${file.name}.`)
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
    <section className="import-section">
      <h2>FHIR Bundle (JSON)</h2>
      <p>
        Upload a single FHIR Bundle -- for example a per-patient sample from
        Synthea-generated test data or another synthetic dataset. This is not
        for real patient records: prefer the SMART Health Link importer above
        for those, and never upload files containing PHI to a third party.
      </p>
      <label className="file-label">
        Choose FHIR Bundle JSON file
        <input type="file" accept="application/json,.json" onChange={handleFile} />
      </label>
      {status && <p className="import-message">{status}</p>}
      {error && <p className="import-error">{error}</p>}
    </section>
  )
}

const PDF_DOMAINS = [
  'demographics',
  'allergies',
  'conditions',
  'immunizations',
  'labResults',
  'medications',
  'procedures',
  'vitalSigns',
  'medicalDevices',
  'healthAssessments',
]

function PdfImport() {
  const { addRecords } = useWorkspace()
  const [fileName, setFileName] = useState(null)
  const [text, setText] = useState('')
  const [dataUrl, setDataUrl] = useState(null)
  const [domain, setDomain] = useState('medications')
  const [fields, setFields] = useState({})
  const [error, setError] = useState(null)
  const [addedCount, setAddedCount] = useState(0)
  const [extracting, setExtracting] = useState(false)

  async function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    setAddedCount(0)
    setExtracting(true)
    try {
      const buffer = await file.arrayBuffer()
      const { extractPdfText } = await import('../lib/pdf/extractText')
      const extracted = await extractPdfText(buffer)
      setText(extracted)
      setFileName(file.name)
      setDataUrl(file.size <= MAX_STORED_PDF_BYTES ? await fileToDataUrl(file) : null)
    } catch {
      setError('Could not read that PDF.')
    } finally {
      setExtracting(false)
    }
    event.target.value = ''
  }

  function updateField(field, value) {
    setFields((prev) => ({ ...prev, [field]: value }))
  }

  function handleAddRecord() {
    const wrapped = Object.fromEntries(
      Object.entries(fields).map(([field, value]) => [field, wrapAssertionValue(domain, field, value)]),
    )
    addRecords([
      createSourceRecord({
        sourceType: 'pdf-upload',
        documentName: fileName,
        domain,
        data: wrapped,
        raw: { extractedText: text, fileDataUrl: dataUrl },
      }),
    ])
    setFields({})
    setAddedCount((n) => n + 1)
  }

  return (
    <section className="import-section">
      <h2>Health PDF</h2>
      <p>
        Upload a health-related PDF (visit summary, lab report, Apple Health
        export, plan document). Text is extracted automatically; structured
        fields still need your confirmation since PDFs vary too much to parse
        reliably.
      </p>
      <label className="file-label">
        Choose health PDF file
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFile}
          disabled={extracting}
        />
      </label>
      {extracting && <p className="import-message">Extracting text...</p>}
      {error && <p className="import-error">{error}</p>}

      {fileName && (
        <div className="pdf-result">
          <h3>Extracted text: {fileName}</h3>
          <textarea readOnly value={text} rows={8} />

          <h3>Add information from this document</h3>
          {addedCount > 0 && (
            <p className="import-message">Added {addedCount} record(s) so far.</p>
          )}
          <label>
            Domain
            <select value={domain} onChange={(e) => { setDomain(e.target.value); setFields({}) }}>
              {PDF_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {DOMAINS[d]?.label ?? d}
                </option>
              ))}
            </select>
          </label>
          <div className="pdf-field-grid">
            {(REQUIRED_FIELDS[domain] ?? []).map((field) => (
              <label key={field}>
                {FIELD_LABELS[field] ?? field}
                <input
                  type="text"
                  value={fields[field] ?? ''}
                  onChange={(e) => updateField(field, e.target.value)}
                />
              </label>
            ))}
          </div>
          <button type="button" onClick={handleAddRecord}>
            Add record
          </button>
        </div>
      )}
    </section>
  )
}

function ShlImport() {
  const { addRecords } = useWorkspace()
  const [url, setUrl] = useState('')
  const [passcode, setPasscode] = useState('')
  const [needsPasscode, setNeedsPasscode] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleRetrieve() {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const { retrieveShl, extractFhirBundles } = await import('../lib/shl/retrieve')
      const payload = parseShlUri(url)
      if (requiresPasscode(payload)) setNeedsPasscode(true)
      const { manifest, files } = await retrieveShl(payload, {
        passcode: passcode || undefined,
      })
      const bundles = await extractFhirBundles(files)
      const normalized = bundles.flatMap((bundle) => normalizeFhirBundle(bundle))
      const records = normalized.map(({ domain, data }) =>
        createSourceRecord({
          sourceType: 'smart-health-link',
          documentName: payload.label || payload.url,
          domain,
          data,
          raw: { shlUri: url, manifest },
        }),
      )
      addRecords(records)
      setStatus(`Retrieved and imported ${records.length} records.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleQrFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const { decodeQrFromImageFile } = await import('../lib/qr/decodeImage')
      const decoded = await decodeQrFromImageFile(file)
      setUrl(decoded)
    } catch (err) {
      setError(err.message)
    }
    event.target.value = ''
  }

  return (
    <section className="import-section">
      <h2>SMART Health Link</h2>
      <p>Paste an SHL URL, or upload an image of its QR code.</p>
      <label className="file-label">
        SMART Health Link URL
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="shlink:/... or https://...#shlink:/..."
        />
      </label>
      <label className="file-label">
        Upload QR code image
        <input type="file" accept="image/*" onChange={handleQrFile} />
      </label>
      {needsPasscode && (
        <label className="file-label">
          Passcode
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode"
          />
        </label>
      )}
      <button type="button" onClick={handleRetrieve} disabled={!url || busy}>
        {busy ? 'Retrieving...' : 'Retrieve'}
      </button>
      {status && <p className="import-message">{status}</p>}
      {error && <p className="import-error">{error}</p>}
    </section>
  )
}

export default function ImportPanel() {
  return (
    <div className="import-panel">
      <SampleImport />
      <CoverageImport />
      <FhirBundleImport />
      <PdfImport />
      <ShlImport />
    </div>
  )
}
