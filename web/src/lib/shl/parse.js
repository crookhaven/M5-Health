import { base64UrlDecodeToString } from '../base64url'

export function parseShlUri(input) {
  const trimmed = input.trim()
  const marker = 'shlink:/'
  const idx = trimmed.indexOf(marker)
  if (idx === -1) {
    throw new Error('That does not look like a SMART Health Link (missing "shlink:/").')
  }
  const encoded = trimmed.slice(idx + marker.length)
  let payload
  try {
    payload = JSON.parse(base64UrlDecodeToString(encoded))
  } catch {
    throw new Error('Could not decode the SMART Health Link payload.')
  }
  if (!payload.url || !payload.key) {
    throw new Error('SMART Health Link payload is missing required fields (url/key).')
  }
  return payload
}

export function requiresPasscode(payload) {
  return Boolean(payload.flag?.includes('P'))
}
