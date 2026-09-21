import { describe, it, expect } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { decodeHealthCardPayload } from './healthCard'
import { bytesToBase64Url } from '../base64url'

function fakeHealthCardJson(vcPayload) {
  const compressed = deflateRawSync(Buffer.from(JSON.stringify(vcPayload)))
  const payloadB64 = bytesToBase64Url(new Uint8Array(compressed))
  const fakeJws = `fakeheader.${payloadB64}.fakesignature`
  return JSON.stringify({ verifiableCredential: [fakeJws] })
}

describe('decodeHealthCardPayload', () => {
  it('inflates and extracts the FHIR bundle from a verifiable credential', () => {
    const bundle = {
      resourceType: 'Bundle',
      entry: [{ resource: { resourceType: 'Condition', code: { text: 'Seasonal allergies' } } }],
    }
    const json = fakeHealthCardJson({ vc: { credentialSubject: { fhirBundle: bundle } } })
    expect(decodeHealthCardPayload(json)).toEqual(bundle)
  })

  it('throws when there is no verifiable credential', () => {
    expect(() => decodeHealthCardPayload(JSON.stringify({ verifiableCredential: [] }))).toThrow(
      /no verifiable credential/i,
    )
  })

  it('throws when the JWS has no payload segment', () => {
    const json = JSON.stringify({ verifiableCredential: ['not-a-jws'] })
    expect(() => decodeHealthCardPayload(json)).toThrow(/not a valid JWS/i)
  })
})
