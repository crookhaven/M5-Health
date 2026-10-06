import { describe, it, expect, vi, afterEach } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { retrieveShl, extractFhirBundles } from './retrieve'
import { generateKey, encryptJwe } from './crypto'
import { encryptJweWithHeader } from '../../test/jwe'
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

describe('retrieveShl with the U (direct file) flag', () => {
  it('GETs the file with a recipient parameter instead of POSTing to a manifest', async () => {
    const key = generateKey()
    const jwe = await encryptJwe('{"resourceType":"Bundle"}', key)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => `${jwe}\n` })
    vi.stubGlobal('fetch', fetchMock)

    const result = await retrieveShl(
      { url: 'https://example.org/file.jwe', key, flag: 'U' },
      { recipient: 'Dr. Test' },
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('https://example.org/file.jwe?recipient=Dr.%20Test')
    expect(result.files).toEqual([{ contentType: 'application/fhir+json', plaintext: '{"resourceType":"Bundle"}' }])
    expect(result.manifest.files[0].location).toBe('https://example.org/file.jwe')
  })

  it('appends recipient with & when the url already has a query string', async () => {
    const key = generateKey()
    const jwe = await encryptJwe('{}', key)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => jwe })
    vi.stubGlobal('fetch', fetchMock)

    await retrieveShl({ url: 'https://example.org/f?id=1', key, flag: 'LU' })
    expect(fetchMock).toHaveBeenCalledWith('https://example.org/f?id=1&recipient=M5%20Health')
  })

  it('takes the content type from the JWE cty header and inflates zip DEF files', async () => {
    const key = generateKey()
    const jwe = await encryptJweWithHeader(
      deflateRawSync(Buffer.from('{"verifiableCredential":[]}')),
      key,
      { alg: 'dir', enc: 'A256GCM', cty: 'application/smart-health-card', zip: 'DEF' },
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => jwe }))

    const result = await retrieveShl({ url: 'https://example.org/f', key, flag: 'U' })
    expect(result.files).toEqual([
      { contentType: 'application/smart-health-card', plaintext: '{"verifiableCredential":[]}' },
    ])
  })

  it('throws a status-specific error when the file is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(
      retrieveShl({ url: 'https://example.org/file.jwe', key: 'x', flag: 'U' }),
    ).rejects.toThrow(/responded 404/)
  })

  it('throws a friendly error when the file host is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(
      retrieveShl({ url: 'https://example.org/file.jwe', key: 'x', flag: 'U' }),
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

  it('accepts content types with media type parameters', async () => {
    const bundle = { resourceType: 'Bundle', entry: [] }
    const result = await extractFhirBundles([
      { contentType: 'application/fhir+json;fhirVersion=4.0.1', plaintext: JSON.stringify(bundle) },
    ])
    expect(result).toEqual([bundle])
  })

  it('ignores unknown content types', async () => {
    const result = await extractFhirBundles([{ contentType: 'text/plain', plaintext: 'hi' }])
    expect(result).toEqual([])
  })
})
