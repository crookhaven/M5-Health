import { describe, it, expect } from 'vitest'
import { parseShlUri, requiresPasscode } from './parse'
import { stringToBase64Url } from '../base64url'

function shlUri(payload) {
  return 'shlink:/' + stringToBase64Url(JSON.stringify(payload))
}

describe('parseShlUri', () => {
  it('parses a bare shlink URI', () => {
    const payload = { url: 'https://example.org/manifest', key: 'k'.repeat(43) }
    expect(parseShlUri(shlUri(payload))).toEqual(payload)
  })

  it('parses a shlink URI embedded after a viewer URL fragment', () => {
    const payload = { url: 'https://example.org/manifest', key: 'k'.repeat(43) }
    const embedded = `https://viewer.example/#${shlUri(payload)}`
    expect(parseShlUri(embedded)).toEqual(payload)
  })

  it('trims surrounding whitespace', () => {
    const payload = { url: 'https://example.org/manifest', key: 'k'.repeat(43) }
    expect(parseShlUri(`  ${shlUri(payload)}  `)).toEqual(payload)
  })

  it('throws when the shlink: marker is missing', () => {
    expect(() => parseShlUri('https://example.org/not-a-link')).toThrow(/shlink:\//)
  })

  it('throws on invalid base64/JSON payloads', () => {
    expect(() => parseShlUri('shlink:/not-valid-base64url-json')).toThrow(/decode/i)
  })

  it('throws when required fields are missing', () => {
    const missingKey = 'shlink:/' + stringToBase64Url(JSON.stringify({ url: 'https://example.org' }))
    expect(() => parseShlUri(missingKey)).toThrow(/missing required fields/i)
  })
})

describe('requiresPasscode', () => {
  it('returns true when the flag string contains P', () => {
    expect(requiresPasscode({ flag: 'LP' })).toBe(true)
  })

  it('returns false when the flag is absent or does not contain P', () => {
    expect(requiresPasscode({})).toBe(false)
    expect(requiresPasscode({ flag: 'L' })).toBe(false)
  })
})
