import { inflateRaw } from 'pako'
import { base64UrlToBytes } from '../base64url'

export function decodeHealthCardPayload(jsonText) {
  const parsed = JSON.parse(jsonText)
  const vcJws = parsed.verifiableCredential?.[0]
  if (!vcJws) {
    throw new Error('SMART Health Card payload had no verifiable credential.')
  }
  const payloadB64 = vcJws.split('.')[1]
  if (!payloadB64) {
    throw new Error('SMART Health Card credential is not a valid JWS.')
  }
  const inflated = inflateRaw(base64UrlToBytes(payloadB64))
  const vc = JSON.parse(new TextDecoder().decode(inflated))
  return vc.vc?.credentialSubject?.fhirBundle
}
