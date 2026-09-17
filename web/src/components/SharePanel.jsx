import { useState } from 'react'
import { DOMAIN_ORDER, DOMAINS } from '../lib/domains'
import { useWorkspace } from '../state/WorkspaceContext'
import {
  selectedDomains,
  buildPdfSections,
  buildSharePackageBundle,
} from '../lib/exportData'
import { downloadBlob, downloadText } from '../lib/download'

export default function SharePanel({ sourceRecords, scorecard }) {
  const { assertions, sharingSelection, setSharing } = useWorkspace()
  const [shlResult, setShlResult] = useState(null)
  const [shlError, setShlError] = useState(null)
  const [building, setBuilding] = useState(false)

  const domainsWithData = DOMAIN_ORDER.filter((d) =>
    sourceRecords.some((r) => r.domain === d),
  )
  const domains = selectedDomains(sourceRecords, sharingSelection)

  async function handleExportPdf() {
    const { buildPdfSummary } = await import('../lib/export/pdfExport')
    const sections = buildPdfSections(domains, sourceRecords, assertions)
    const blob = buildPdfSummary({ sections, scorecard })
    downloadBlob(blob, 'm5-health-summary.pdf')
  }

  async function handleExportShl() {
    setBuilding(true)
    setShlError(null)
    setShlResult(null)
    try {
      const { buildShlPackage } = await import('../lib/shl/buildPackage')
      const { generateQrDataUrl } = await import('../lib/qr/generate')
      const bundle = buildSharePackageBundle(domains, sourceRecords, assertions)
      const pkg = await buildShlPackage(bundle, { label: 'M5 Health export' })
      const qr = await generateQrDataUrl(pkg.shlUri)
      setShlResult({ ...pkg, qr, bundle })
    } catch (err) {
      setShlError(err.message)
    } finally {
      setBuilding(false)
    }
  }

  function handleDownloadPackage() {
    if (!shlResult) return
    downloadText(
      JSON.stringify({ payload: shlResult.payload, manifest: shlResult.manifest }, null, 2),
      'm5-health-shl-package.json',
    )
  }

  if (domainsWithData.length === 0) {
    return (
      <div className="empty-state">
        Nothing to share yet. Import some health information first.
      </div>
    )
  }

  return (
    <div className="share-panel">
      <section>
        <h2>Select information to share</h2>
        <div className="sharing-checkboxes">
          {domainsWithData.map((domain) => (
            <label key={domain}>
              <input
                type="checkbox"
                checked={sharingSelection[domain] !== false}
                onChange={(e) => setSharing(domain, e.target.checked)}
              />
              {DOMAINS[domain].label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2>Export</h2>
        <div className="export-actions">
          <button type="button" onClick={handleExportPdf} disabled={domains.length === 0}>
            Export PDF summary
          </button>
          <button
            type="button"
            onClick={handleExportShl}
            disabled={domains.length === 0 || building}
          >
            {building ? 'Building...' : 'Create SMART Health Link package'}
          </button>
        </div>

        {shlError && <p className="import-error">{shlError}</p>}

        {shlResult && (
          <div className="shl-result">
            <p>
              This prototype has no server to host the encrypted package at a
              retrievable URL, so this SHL cannot be scanned by another app yet.
              Download the package below to inspect the real encrypted content,
              or re-import it back into M5 Health to verify it round-trips.
            </p>
            <img src={shlResult.qr} alt="QR code for the generated SMART Health Link" />
            <code className="shl-uri">{shlResult.shlUri}</code>
            <button type="button" onClick={handleDownloadPackage}>
              Download package (.json)
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
