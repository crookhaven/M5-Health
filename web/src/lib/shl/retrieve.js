import { decryptJwe } from './crypto'
import { base64UrlDecodeToString } from '../base64url'

// "U" flag: the link's url is the encrypted file itself, fetched with GET and a
// recipient query parameter, rather than a manifest that is POSTed to.
// https://docs.smarthealthit.org/smart-health-links/spec/
async function retrieveDirectFile(payload, recipient) {
  const sep = payload.url.includes('?') ? '&' : '?'
  const fileUrl = `${payload.url}${sep}recipient=${encodeURIComponent(recipient)}`
  let res
  try {
    res = await fetch(fileUrl)
  } catch {
    throw new Error(
      `Could not reach the SMART Health Link file at ${payload.url}. It may be offline or unreachable.`,
    )
  }
  if (!res.ok) {
    throw new Error(`Could not retrieve the SMART Health Link (server responded ${res.status}).`)
  }
  const compact = (await res.text()).trim()
  let contentType = 'application/fhir+json'
  try {
    contentType = JSON.parse(base64UrlDecodeToString(compact.split('.')[0])).cty ?? contentType
  } catch {
    // decryptJwe reports a malformed file below
  }
  const plaintext = await decryptJwe(compact, payload.key)
  return {
    manifest: { files: [{ contentType, location: payload.url }] },
    files: [{ contentType, plaintext }],
  }
}

export async function retrieveShl(payload, { recipient = 'M5 Health', passcode } = {}) {
  if (payload.flag?.includes('U')) return retrieveDirectFile(payload, recipient)

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
    // Senders may add media type parameters, e.g. "application/fhir+json;fhirVersion=4.0.1".
    const mediaType = file.contentType?.split(';')[0].trim().toLowerCase()
    if (mediaType === 'application/fhir+json') {
      bundles.push(JSON.parse(file.plaintext))
    } else if (mediaType === 'application/smart-health-card') {
      const { decodeHealthCardPayload } = await import('./healthCard')
      const bundle = decodeHealthCardPayload(file.plaintext)
      if (bundle) bundles.push(bundle)
    }
  }
  return bundles
}
