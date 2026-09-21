import { decryptJwe } from './crypto'

export async function retrieveShl(payload, { recipient = 'M5 Health', passcode } = {}) {
  const body = { recipient }
  if (passcode) body.passcode = passcode

  let res
  try {
    res = await fetch(payload.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(
      `Could not reach the SMART Health Link server at ${payload.url}. It may be offline, unreachable, or not a real manifest URL.`,
    )
  }
  if (res.status === 401) {
    throw new Error('This SMART Health Link requires a passcode.')
  }
  if (!res.ok) {
    throw new Error(`Could not retrieve the SMART Health Link (server responded ${res.status}).`)
  }
  const manifest = await res.json()
  const files = manifest.files ?? []

  const decoded = []
  for (const file of files) {
    let compact = file.embedded
    if (!compact && file.location) {
      const fileRes = await fetch(file.location)
      if (!fileRes.ok) {
        throw new Error(`Could not retrieve a file from the SMART Health Link (server responded ${fileRes.status}).`)
      }
      compact = await fileRes.text()
    }
    if (!compact) continue
    const plaintext = await decryptJwe(compact, payload.key)
    decoded.push({ contentType: file.contentType, plaintext })
  }
  return { manifest, files: decoded }
}

export async function extractFhirBundles(decodedFiles) {
  const bundles = []
  for (const file of decodedFiles) {
    if (file.contentType === 'application/fhir+json') {
      bundles.push(JSON.parse(file.plaintext))
    } else if (file.contentType === 'application/smart-health-card') {
      const { decodeHealthCardPayload } = await import('./healthCard')
      const bundle = decodeHealthCardPayload(file.plaintext)
      if (bundle) bundles.push(bundle)
    }
  }
  return bundles
}
