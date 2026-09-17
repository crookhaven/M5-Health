import { describe, it, expect } from 'vitest'
import {
  base64UrlToBytes,
  bytesToBase64Url,
  base64UrlDecodeToString,
  stringToBase64Url,
} from './base64url'

describe('base64url', () => {
  it('round-trips bytes through bytesToBase64Url/base64UrlToBytes', () => {
    const original = crypto.getRandomValues(new Uint8Array(32))
    const encoded = bytesToBase64Url(original)
    const decoded = base64UrlToBytes(encoded)
    expect(Array.from(decoded)).toEqual(Array.from(original))
  })

  it('round-trips a string through stringToBase64Url/base64UrlDecodeToString', () => {
    const original = '{"hello":"world","emoji":"🏥"}'
    expect(base64UrlDecodeToString(stringToBase64Url(original))).toBe(original)
  })

  it('produces URL-safe output with no +, /, or padding', () => {
    // Bytes chosen so standard base64 would contain '+' and '/'.
    const bytes = new Uint8Array([0xfb, 0xff, 0xbe, 0x3e])
    const encoded = bytesToBase64Url(bytes)
    expect(encoded).not.toMatch(/[+/=]/)
  })

  it('decodes both -/_ url-safe characters correctly', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbe, 0x3e])
    const encoded = bytesToBase64Url(bytes)
    expect(Array.from(base64UrlToBytes(encoded))).toEqual(Array.from(bytes))
  })
})
