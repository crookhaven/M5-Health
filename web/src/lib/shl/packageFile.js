import { decryptJwe } from './crypto'
import { parseShlUri } from './parse'
import { DOMAINS } from '../domains'

// M5 Health has no server, so "Create SMART Health Link package" can't host the
// encrypted file at a URL. Instead the link (or its QR code) and a package file
// travel together: the package holds the encrypted content, the link holds the
// key. Neither is readable alone.

export const PACKAGE_URL = 'local://m5-health/no-hosting-available'
// M5's own share format (records by domain), not a FHIR Bundle.
export const SHARE_CONTENT_TYPE = 'application/vnd.m5-health.share+json'

export function isPackageOnlyLink(payload) {
  return typeof payload?.url === 'string' && payload.url.startsWith('local://')
}

// What "Download package" saves: the encrypted files and the label, but not the key.
export function packageFileContent({ manifest, payload }) {
  return { m5HealthShlPackage: 1, label: payload.label, manifest }
}

// Decrypts a package file. The key comes from the pasted link, or from the file
// itself for packages saved by older versions, which included it.
export async function openPackageFile(fileText, shlUri) {
  let parsed
  try {
    parsed = JSON.parse(fileText)
  } catch {
    throw new Error('That file is not a SMART Health Link package (not JSON).')
  }
  const files = parsed?.manifest?.files
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('That file is not a SMART Health Link package (no encrypted files in it).')
  }
  const key = (shlUri?.trim() ? parseShlUri(shlUri).key : null) ?? parsed.payload?.key
  if (!key) {
    throw new Error('Paste the SMART Health Link that came with this package first; it holds the key.')
  }
  const contents = []
  for (const file of files) {
    if (!file.embedded) continue
    const plaintext = await decryptJwe(file.embedded, key)
    contents.push(JSON.parse(plaintext))
  }
  return { label: parsed.label ?? parsed.payload?.label, contents }
}

// Records from M5's share format, ready to add to the workspace. Unknown
// domains are skipped.
export function recordsFromShareContent(content) {
  const out = []
  for (const [domain, records] of Object.entries(content?.records ?? {})) {
    if (!DOMAINS[domain] || !Array.isArray(records)) continue
    for (const r of records) if (r?.data) out.push({ domain, data: r.data })
  }
  return out
}
