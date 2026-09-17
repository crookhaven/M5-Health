import { describe, it, expect, vi, afterEach } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { retrieveShl, extractFhirBundles } from './retrieve'
import { generateKey, encryptJwe } from './crypto'
import { bytesToBase64Url } from '../base64url'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('retrieveShl', () => {
  it('posts to the manifest URL and decrypts embedded files', async () => {
    const key = generateKey()
    const jwe = await encryptJwe(JSON.stringify({ resourceType: 'Bundle', entry: [] }), key)
    const manifest = { files: [{ contentType: 'application/fhir+json', embedded: jwe }] }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => manifest })
    vi.stubGlobal('fetch', fetchMock)

    const result = await retrieveShl({ url: 'https://example.org/manifest', key })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.org/manifest',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.files).toHaveLength(1)
    expect(JSON.parse(result.files[0].plaintext)).toEqual({ resourceType: 'Bundle', entry: [] })
  })

  it('fetches a file by location when it is not embedded', async () => {
    const key = generateKey()
    const jwe = await encryptJwe('{"resourceType":"Bundle"}', key)
    const manifest = {
      files: [{ contentType: 'application/fhir+json', location: 'https://example.org/file1' }],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => manifest })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => jwe })
    vi.stubGlobal('fetch', fetchMock)

    const result = await retrieveShl({ url: 'https://example.org/manifest', key })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.files[0].plaintext).toBe('{"resourceType":"Bundle"}')
  })

  it('throws a passcode-required error on a 401 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    await expect(
      retrieveShl({ url: 'https://example.org/manifest', key: 'x' }),
    ).rejects.toThrow(/requires a passcode/i)
  })

  it('throws a status-specific error for other non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(
      retrieveShl({ url: 'https://example.org/manifest', key: 'x' }),
    ).rejects.toThrow(/responded 500/)
  })

  it('throws a friendly error when the network request fails outright', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(
      retrieveShl({ url: 'https://example.org/manifest', key: 'x' }),
    ).rejects.toThrow(/could not reach/i)
  })
})

describe('extractFhirBundles', () => {
  it('parses application/fhir+json files directly', async () => {
    const bundle = { resourceType: 'Bundle', entry: [] }
    const result = await extractFhirBundles([
      { contentType: 'application/fhir+json', plaintext: JSON.stringify(bundle) },
    ])
    expect(result).toEqual([bundle])
  })

  it('decodes application/smart-health-card files', async () => {
    const bundle = { resourceType: 'Bundle', entry: [] }
    const compressed = deflateRawSync(
      Buffer.from(JSON.stringify({ vc: { credentialSubject: { fhirBundle: bundle } } })),
    )
    const jws = `fakeheader.${bytesToBase64Url(new Uint8Array(compressed))}.fakesig`
    const plaintext = JSON.stringify({ verifiableCredential: [jws] })

    const result = await extractFhirBundles([
      { contentType: 'application/smart-health-card', plaintext },
    ])
    expect(result).toEqual([bundle])
  })

  it('ignores unknown content types', async () => {
    const result = await extractFhirBundles([{ contentType: 'text/plain', plaintext: 'hi' }])
    expect(result).toEqual([])
  })
})
